import { supabase } from '../config/supabase.js'
import { HttpError } from '../utils/http.js'
import { create302ApiKey, get302RuntimeApiKeyByName, update302ApiKey } from './dashboard302.service.js'

const CREDENTIAL_TABLE = 'user_service_credentials'

const isMissingRelation = (error) => {
  const msg = String(error?.message || '').toLowerCase()
  return msg.includes('relation') && msg.includes('does not exist')
}

const toNumber = (value) => {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

const last4 = (value = '') => {
  const raw = String(value || '').trim()
  return raw ? raw.slice(-4) : ''
}

const runtimeUnavailableMessage = (providerApiName = '') =>
  `Runtime API key is unavailable for provider_api_name ${String(providerApiName || '').trim()}`

const summarizeDashboardAttempts = (attempts = []) => {
  const list = Array.isArray(attempts) ? attempts : []
  if (!list.length) return ''
  return list
    .map((attempt) => [
      attempt.method,
      attempt.path,
      attempt.baseHost,
      attempt.status,
      attempt.message,
      attempt.authSource ? `via ${attempt.authSource}` : ''
    ].filter((item) => item !== undefined && item !== null && String(item).trim() !== '').join(' '))
    .join('; ')
}

const summarizeCredentialFailure = (error = {}, fallback = 'Service credential creation failed') => {
  const base = String(error?.message || fallback).trim() || fallback
  const attempts = summarizeDashboardAttempts(error?.dashboard302Attempts)
  return (attempts ? `${base} | attempts: ${attempts}` : base).slice(0, 500)
}

const serviceLabelMap = {
  not_enabled: '未开通',
  active: '已开通',
  disabled: '已停用',
  create_failed: '创建失败',
  deleted: '已删除'
}

export const buildProviderApiName = (userId) => {
  const compact = String(userId || '').replace(/-/g, '').trim().toLowerCase()
  if (!compact) throw new HttpError(400, 'userId is required', 'INVALID_USER_ID')
  return `eager_user_${compact.slice(0, 16)}`
}

const buildInternalName = (providerApiName) => `svc_${providerApiName}`

const maskServiceIdentifier = (providerApiName = '') => {
  const raw = String(providerApiName || '').trim()
  if (!raw) return ''
  return `svc_****${raw.slice(-3)}`
}

export const formatServiceCredentialForAdmin = (credential = null) => {
  if (!credential) {
    return {
      serviceStatus: 'not_enabled',
      serviceLabel: serviceLabelMap.not_enabled,
      serviceIdentifier: '',
      apiKeyLast4: '',
      limitCost: 0,
      limitDailyCost: 0,
      expiredOn: 0,
      createdAt: null,
      disabledAt: null,
      deletedAt: null,
      lastError: ''
    }
  }

  const status = String(credential.status || 'not_enabled')
  return {
    id: credential.id,
    serviceStatus: status,
    serviceLabel: serviceLabelMap[status] || status,
    serviceIdentifier: maskServiceIdentifier(credential.provider_api_name),
    apiKeyLast4: String(credential.api_key_last4 || ''),
    limitCost: toNumber(credential.limit_cost),
    limitDailyCost: toNumber(credential.limit_daily_cost),
    expiredOn: Number(credential.expired_on || 0),
    createdAt: credential.created_at || null,
    disabledAt: credential.disabled_at || null,
    deletedAt: credential.deleted_at || null,
    lastError: String(credential.last_error || '')
  }
}

const createAdminLog = async (client, { operatorUserId, targetUserId, action, metadata = {} }) => {
  const { error } = await client.from('admin_operation_logs').insert({
    operator_user_id: operatorUserId || null,
    target_user_id: targetUserId || null,
    action,
    metadata
  })
  if (error && !isMissingRelation(error)) {
    throw new HttpError(500, error.message, 'ADMIN_AUDIT_WRITE_FAILED')
  }
}

const latestCredentialQuery = (client, userId) =>
  client
    .from(CREDENTIAL_TABLE)
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

const activeCredentialQuery = (client, userId) =>
  client
    .from(CREDENTIAL_TABLE)
    .select('*')
    .eq('user_id', userId)
    .eq('status', 'active')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

const listUserCredentials = async (client, userId) => {
  const { data, error } = await client
    .from(CREDENTIAL_TABLE)
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
  if (error) {
    if (isMissingRelation(error)) return []
    throw new HttpError(500, error.message, 'SERVICE_CREDENTIAL_QUERY_FAILED')
  }
  return Array.isArray(data) ? data : []
}

const getUserForServiceMutation = async (client, userId) => {
  const { data, error } = await client
    .from('users')
    .select('id,status,deleted_at')
    .eq('id', userId)
    .maybeSingle()
  if (error) throw new HttpError(500, error.message, 'USER_QUERY_FAILED')
  if (!data) throw new HttpError(404, 'User not found', 'USER_NOT_FOUND')
  if (data.deleted_at || data.status === 'deleted') {
    throw new HttpError(400, 'Deleted users cannot be enabled for service access.', 'USER_DELETED')
  }
  return data
}

const buildUniqueProviderApiName = (userId, credentials = []) => {
  const base = buildProviderApiName(userId)
  const used = new Set(credentials.map((item) => String(item.provider_api_name || '').trim()).filter(Boolean))
  if (!used.has(base)) return base
  return `${base}_${Date.now().toString(36)}`
}

const normalizeProviderCreateResult = (result = {}, providerApiName = '') => {
  const payload = result?.data && typeof result.data === 'object' ? result.data : result
  return {
    providerApiName: String(payload?.api_name || payload?.apiName || providerApiName || '').trim(),
    apiKey: String(payload?.api_key || payload?.apiKey || payload?.key || '').trim()
  }
}

const resolveCreatedRuntimeApiKey = async (getRuntimeApiKeyByName, providerApiName, createdApiKey = '') => {
  const fallbackApiKey = String(createdApiKey || '').trim()
  try {
    const runtimeApiKey = await getRuntimeApiKeyByName(providerApiName, {
      throwOnMissing: !fallbackApiKey,
      ...(fallbackApiKey ? { fallbackApiKey } : {})
    })
    return runtimeApiKey || fallbackApiKey
  } catch (error) {
    if (fallbackApiKey) return fallbackApiKey
    throw error
  }
}

const activateExistingCredential = async (client, credential, apiKey, operatorUserId, ip, userAgent, metadata = {}) => {
  const { data, error } = await client
    .from(CREDENTIAL_TABLE)
    .update({
      status: 'active',
      api_key_last4: last4(apiKey),
      disabled_at: null,
      deleted_at: null,
      last_error: null
    })
    .eq('id', credential.id)
    .select('*')
    .single()
  if (error) throw new HttpError(500, error.message, 'SERVICE_CREDENTIAL_UPDATE_FAILED')

  await createAdminLog(client, {
    operatorUserId,
    targetUserId: credential.user_id,
    action: 'admin.service_access.activate',
    metadata: {
      serviceIdentifier: maskServiceIdentifier(data.provider_api_name),
      ip: String(ip || ''),
      userAgent: String(userAgent || ''),
      ...metadata
    }
  })

  return { ok: true, serviceCredential: formatServiceCredentialForAdmin(data) }
}

const updateCredentialLastError = async (client, credentialId, message) => {
  if (!credentialId) return
  await client
    .from(CREDENTIAL_TABLE)
    .update({ last_error: String(message || '').slice(0, 500) })
    .eq('id', credentialId)
}

export const getUserServiceStatus = async (userId, deps = {}) => {
  const client = deps.supabaseClient || supabase
  const safeUserId = String(userId || '').trim()
  if (!safeUserId) return 'not_enabled'
  const { data: activeCredential, error: activeError } = await activeCredentialQuery(client, safeUserId)
  if (activeError) {
    if (isMissingRelation(activeError)) return 'not_enabled'
    throw new HttpError(500, activeError.message, 'SERVICE_CREDENTIAL_QUERY_FAILED')
  }
  if (activeCredential) return activeCredential.status || 'active'

  const { data, error } = await latestCredentialQuery(client, safeUserId)
  if (error) {
    if (isMissingRelation(error)) return 'not_enabled'
    throw new HttpError(500, error.message, 'SERVICE_CREDENTIAL_QUERY_FAILED')
  }
  return data?.status || 'not_enabled'
}

export const createUserServiceCredential = async ({
  userId,
  operatorUserId,
  limitCost = 0,
  limitDailyCost = 0,
  expiredOn = 0,
  ip = '',
  userAgent = ''
}, deps = {}) => {
  const client = deps.supabaseClient || supabase
  const createProviderApiKey = deps.createProviderApiKey || create302ApiKey
  const getRuntimeApiKeyByName = deps.getRuntimeApiKeyByName || get302RuntimeApiKeyByName
  const safeUserId = String(userId || '').trim()
  if (!safeUserId) throw new HttpError(400, 'userId is required', 'INVALID_USER_ID')

  await getUserForServiceMutation(client, safeUserId)
  const credentials = await listUserCredentials(client, safeUserId)
  const active = credentials.find((item) => String(item.status || '') === 'active')
  if (active) {
    return {
      ok: true,
      alreadyActive: true,
      serviceCredential: formatServiceCredentialForAdmin(active)
    }
  }

  const failed = credentials.find((item) => String(item.status || '') === 'create_failed' && String(item.provider_api_name || '').trim())
  if (failed) {
    const restoredApiKey = await getRuntimeApiKeyByName(failed.provider_api_name)
    if (restoredApiKey) {
      return activateExistingCredential(client, failed, restoredApiKey, operatorUserId, ip, userAgent, { restored: true })
    }
  }

  const providerApiName = buildUniqueProviderApiName(safeUserId, credentials)
  let attemptedProviderApiName = providerApiName
  const payload = {
    api_name: providerApiName,
    allow_save_logs: true,
    allow_custom_model: false,
    allow_manage_key: false,
    limit_cost: Number(limitCost || 0),
    limit_daily_cost: Number(limitDailyCost || 0),
    expired_on: Number(expiredOn || 0)
  }

  let created
  let runtimeApiKey = ''
  try {
    created = normalizeProviderCreateResult(await createProviderApiKey(payload), providerApiName)
    attemptedProviderApiName = created.providerApiName || providerApiName
    runtimeApiKey = await resolveCreatedRuntimeApiKey(getRuntimeApiKeyByName, attemptedProviderApiName, created.apiKey)
    if (!runtimeApiKey) {
      throw new Error(runtimeUnavailableMessage(attemptedProviderApiName))
    }
  } catch (error) {
    const failed = {
      user_id: safeUserId,
      provider: '302ai',
      internal_name: buildInternalName(attemptedProviderApiName),
      provider_api_name: attemptedProviderApiName,
      status: 'create_failed',
      limit_cost: Number(limitCost || 0),
      limit_daily_cost: Number(limitDailyCost || 0),
      expired_on: Number(expiredOn || 0),
      created_by: operatorUserId || null,
      last_error: summarizeCredentialFailure(error)
    }
    await client.from(CREDENTIAL_TABLE).insert(failed)
    const serviceError = new HttpError(502, '服务开通失败，请稍后重试。', 'SERVICE_ACCESS_CREATE_FAILED')
    serviceError.metadata = {
      providerApiName: maskServiceIdentifier(attemptedProviderApiName),
      failure: failed.last_error
    }
    throw serviceError
  }

  const insertPayload = {
    user_id: safeUserId,
    provider: '302ai',
    internal_name: buildInternalName(created.providerApiName || providerApiName),
    provider_api_name: created.providerApiName || providerApiName,
    api_key_last4: last4(runtimeApiKey || created.apiKey),
    api_key_encrypted: null,
    status: 'active',
    limit_cost: Number(limitCost || 0),
    limit_daily_cost: Number(limitDailyCost || 0),
    expired_on: Number(expiredOn || 0),
    created_by: operatorUserId || null
  }

  const { data, error } = await client
    .from(CREDENTIAL_TABLE)
    .insert(insertPayload)
    .select('*')
    .single()
  if (error) throw new HttpError(500, error.message, 'SERVICE_CREDENTIAL_INSERT_FAILED')

  await createAdminLog(client, {
    operatorUserId,
    targetUserId: safeUserId,
    action: 'admin.service_access.activate',
    metadata: { serviceIdentifier: maskServiceIdentifier(data.provider_api_name), ip: String(ip || ''), userAgent: String(userAgent || '') }
  })

  return { ok: true, serviceCredential: formatServiceCredentialForAdmin(data) }
}

const resolveActiveUserServiceCredentialRecord = async (safeUserId, client) => {
  const { data: activeCredential, error: activeError } = await activeCredentialQuery(client, safeUserId)
  if (activeError) {
    if (isMissingRelation(activeError)) {
      throw new HttpError(403, '当前账号尚未开通生成服务，请联系管理员。', 'SERVICE_NOT_ENABLED')
    }
    throw new HttpError(500, activeError.message, 'SERVICE_CREDENTIAL_QUERY_FAILED')
  }
  if (activeCredential) return activeCredential

  const { data, error } = await latestCredentialQuery(client, safeUserId)
  if (error) {
    if (isMissingRelation(error)) {
      throw new HttpError(403, '当前账号尚未开通生成服务，请联系管理员。', 'SERVICE_NOT_ENABLED')
    }
    throw new HttpError(500, error.message, 'SERVICE_CREDENTIAL_QUERY_FAILED')
  }
  if (!data) throw new HttpError(403, '当前账号尚未开通生成服务，请联系管理员。', 'SERVICE_NOT_ENABLED')
  if (data.status === 'disabled' || data.status === 'deleted') {
    throw new HttpError(403, '当前账号的生成服务已停用，请联系管理员。', 'SERVICE_DISABLED')
  }
  throw new HttpError(503, '服务凭证暂时不可用，请联系管理员。', 'SERVICE_CREDENTIAL_UNAVAILABLE')
}

export const resolveActiveUserServiceAccess = async (userId, deps = {}) => {
  const client = deps.supabaseClient || supabase
  const safeUserId = String(userId || '').trim()
  if (!safeUserId) throw new HttpError(401, 'Missing authenticated user', 'UNAUTHORIZED')

  const data = await resolveActiveUserServiceCredentialRecord(safeUserId, client)

  return {
    serviceCredentialId: data.id,
    apiName: data.provider_api_name
  }
}

export const resolveActiveUserServiceCredential = async (userId, deps = {}) => {
  const client = deps.supabaseClient || supabase
  const getRuntimeApiKeyByName = deps.getRuntimeApiKeyByName || get302RuntimeApiKeyByName
  const safeUserId = String(userId || '').trim()
  if (!safeUserId) throw new HttpError(401, 'Missing authenticated user', 'UNAUTHORIZED')

  const data = await resolveActiveUserServiceCredentialRecord(safeUserId, client)

  const apiKey = await getRuntimeApiKeyByName(data.provider_api_name)
  if (!apiKey) {
    const message = runtimeUnavailableMessage(data.provider_api_name)
    await updateCredentialLastError(client, data.id, message)
    const error = new HttpError(503, '服务凭证暂时不可用，请联系管理员。', 'SERVICE_CREDENTIAL_UNAVAILABLE')
    error.metadata = {
      providerApiName: maskServiceIdentifier(data.provider_api_name),
      failure: message
    }
    throw error
  }

  return {
    serviceCredentialId: data.id,
    apiName: data.provider_api_name,
    apiKey
  }
}

export const disableUserServiceCredential = async ({ userId, operatorUserId, reason = '', ip = '', userAgent = '' }, deps = {}) => {
  const client = deps.supabaseClient || supabase
  const updateProviderApiKey = deps.updateProviderApiKey || update302ApiKey
  const safeUserId = String(userId || '').trim()
  if (!safeUserId) throw new HttpError(400, 'userId is required', 'INVALID_USER_ID')

  const credentials = await listUserCredentials(client, safeUserId)
  const active = credentials.find((item) => String(item.status || '') === 'active')
  if (!active) return { ok: true, serviceCredential: formatServiceCredentialForAdmin(credentials[0] || null) }

  const now = new Date().toISOString()
  const { data, error } = await client
    .from(CREDENTIAL_TABLE)
    .update({ status: 'disabled', disabled_at: now, last_error: null })
    .eq('id', active.id)
    .select('*')
    .single()
  if (error) throw new HttpError(500, error.message, 'SERVICE_CREDENTIAL_DISABLE_FAILED')

  try {
    await updateProviderApiKey(active.provider_api_name, {
      api_name: active.provider_api_name,
      limit_cost: 0,
      limit_daily_cost: 0,
      expired_on: 1,
      allow_save_logs: true,
      allow_custom_model: false,
      allow_manage_key: false
    })
  } catch (error) {
    await client.from(CREDENTIAL_TABLE).update({ last_error: String(error?.message || error).slice(0, 500) }).eq('id', active.id)
  }

  await createAdminLog(client, {
    operatorUserId,
    targetUserId: safeUserId,
    action: 'admin.service_access.disable',
    metadata: { reason: String(reason || ''), ip: String(ip || ''), userAgent: String(userAgent || '') }
  })

  return { ok: true, serviceCredential: formatServiceCredentialForAdmin(data) }
}

export const resetUserServiceCredential = async ({ userId, operatorUserId, ip = '', userAgent = '' }, deps = {}) => {
  await disableUserServiceCredential({ userId, operatorUserId, reason: 'reset', ip, userAgent }, deps)
  const result = await createUserServiceCredential({ userId, operatorUserId, ip, userAgent }, deps)
  const client = deps.supabaseClient || supabase
  await createAdminLog(client, {
    operatorUserId,
    targetUserId: userId,
    action: 'admin.service_access.reset',
    metadata: { ip: String(ip || ''), userAgent: String(userAgent || '') }
  })
  return result
}

export const updateUserServiceLimits = async ({ userId, operatorUserId, limitCost = 0, limitDailyCost = 0, expiredOn = 0, ip = '', userAgent = '' }, deps = {}) => {
  const client = deps.supabaseClient || supabase
  const updateProviderApiKey = deps.updateProviderApiKey || update302ApiKey
  const credentials = await listUserCredentials(client, userId)
  const active = credentials.find((item) => String(item.status || '') === 'active')
  if (!active) throw new HttpError(403, '当前账号尚未开通生成服务，请联系管理员。', 'SERVICE_NOT_ENABLED')

  await updateProviderApiKey(active.provider_api_name, {
    api_name: active.provider_api_name,
    limit_cost: Number(limitCost || 0),
    limit_daily_cost: Number(limitDailyCost || 0),
    expired_on: Number(expiredOn || 0),
    allow_save_logs: true,
    allow_custom_model: false,
    allow_manage_key: false
  })

  const { data, error } = await client
    .from(CREDENTIAL_TABLE)
    .update({
      limit_cost: Number(limitCost || 0),
      limit_daily_cost: Number(limitDailyCost || 0),
      expired_on: Number(expiredOn || 0),
      last_error: null
    })
    .eq('id', active.id)
    .select('*')
    .single()
  if (error) throw new HttpError(500, error.message, 'SERVICE_LIMIT_UPDATE_FAILED')

  await createAdminLog(client, {
    operatorUserId,
    targetUserId: userId,
    action: 'admin.service_access.update_limits',
    metadata: { limitCost: Number(limitCost || 0), limitDailyCost: Number(limitDailyCost || 0), expiredOn: Number(expiredOn || 0), ip, userAgent }
  })

  return { ok: true, serviceCredential: formatServiceCredentialForAdmin(data) }
}
