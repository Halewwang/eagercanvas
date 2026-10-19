import { randomUUID } from 'node:crypto'
import { supabase } from '../config/supabase.js'
import { HttpError } from '../utils/http.js'
import { assertAccountMayReceiveServiceMutation } from './admin-access-policy.js'
import { sanitizeAdminAuditContext } from './admin-audit-sanitizer.js'

const CREDENTIAL_TABLE = 'user_service_credentials'
const serviceLabelMap = {
  not_enabled: '未开通',
  active: '已开通',
  disabled: '已暂停',
  create_failed: '未开通',
  deleted: '已删除'
}

const isMissingRelation = (error) => {
  const message = String(error?.message || '').toLowerCase()
  return message.includes('relation') && message.includes('does not exist')
}

export const formatServiceCredentialForAdmin = (credential = null) => {
  const status = credential?.status === 'create_failed' ? 'not_enabled' : String(credential?.status || 'not_enabled')
  return {
    ...(credential?.id ? { id: credential.id } : {}),
    serviceStatus: status,
    serviceLabel: serviceLabelMap[status] || status,
    createdAt: credential?.created_at || null,
    disabledAt: credential?.disabled_at || null,
    deletedAt: credential?.deleted_at || null
  }
}

const listUserCredentials = async (client, userId) => {
  const { data, error } = await client.from(CREDENTIAL_TABLE)
    .select('id,user_id,status,created_at,disabled_at,deleted_at')
    .eq('user_id', userId).order('created_at', { ascending: false })
  if (error) {
    if (isMissingRelation(error)) return []
    throw new HttpError(500, error.message, 'SERVICE_CREDENTIAL_QUERY_FAILED')
  }
  return Array.isArray(data) ? data : []
}

const getUserForServiceMutation = async (client, userId) => {
  const { data, error } = await client.from('users').select('id,status,deleted_at').eq('id', userId).maybeSingle()
  if (error) throw new HttpError(500, error.message, 'USER_QUERY_FAILED')
  if (!data) throw new HttpError(404, 'User not found', 'USER_NOT_FOUND')
  assertAccountMayReceiveServiceMutation({ status: data.status, deletedAt: data.deleted_at })
  return data
}

const throwServiceMutationLeaseError = (error) => {
  const message = [error?.message, error?.details, error?.hint].filter(Boolean).join(' ')
  if (message.includes('ARCHIVED_ACCOUNT_IMMUTABLE')) {
    throw new HttpError(409, 'Restore the archived account before changing service access', 'ARCHIVED_ACCOUNT_IMMUTABLE')
  }
  if (message.includes('ACCOUNT_MUTATION_IN_PROGRESS')) {
    throw new HttpError(409, 'Another account mutation is in progress', 'ACCOUNT_MUTATION_IN_PROGRESS')
  }
  if (message.includes('TARGET_USER_NOT_FOUND')) throw new HttpError(404, 'User not found', 'USER_NOT_FOUND')
  throw new HttpError(500, error?.message || 'Unable to reserve account mutation', 'ACCOUNT_MUTATION_LEASE_FAILED')
}

const withServiceMutationLease = async (client, userId, deps, operation) => {
  if (deps.serviceMutationToken || typeof client.rpc !== 'function') return operation(deps)
  const serviceMutationToken = randomUUID()
  const { error: beginError } = await client.rpc('admin_begin_service_mutation', {
    p_target_user_id: userId,
    p_mutation_token: serviceMutationToken
  })
  if (beginError) throwServiceMutationLeaseError(beginError)
  let result
  let operationError
  try {
    result = await operation({ ...deps, serviceMutationToken })
  } catch (error) {
    operationError = error
  }
  const { error: endError } = await client.rpc('admin_end_service_mutation', {
    p_target_user_id: userId,
    p_mutation_token: serviceMutationToken
  })
  if (endError) {
    if (operationError) operationError.serviceMutationReleaseError = endError
    else throw new HttpError(500, endError.message || 'Unable to release account mutation', 'ACCOUNT_MUTATION_RELEASE_FAILED')
  }
  if (operationError) throw operationError
  return result
}

const createServiceAuditLog = async (client, { userId, operatorUserId, action, reason, ip, userAgent, requestId }) => {
  const { error } = await client.from('admin_operation_logs').insert({
    operator_user_id: operatorUserId || null,
    target_user_id: userId,
    action,
    metadata: sanitizeAdminAuditContext({ reason, ip, userAgent, requestId })
  })
  if (error) throw new HttpError(500, error.message, 'ADMIN_AUDIT_WRITE_FAILED')
}

export const getUserServiceStatus = async (userId, deps = {}) => {
  const safeUserId = String(userId || '').trim()
  if (!safeUserId) return 'not_enabled'
  const credentials = await listUserCredentials(deps.supabaseClient || supabase, safeUserId)
  return (credentials.find((item) => item.status === 'active') || credentials[0])?.status || 'not_enabled'
}

export const createUserServiceCredential = async ({ userId, operatorUserId, ip = '', userAgent = '', requestId = '' }, deps = {}) => {
  const client = deps.supabaseClient || supabase
  const safeUserId = String(userId || '').trim()
  if (!safeUserId) throw new HttpError(400, 'userId is required', 'INVALID_USER_ID')
  if (!deps.serviceMutationToken && typeof client.rpc === 'function') {
    return withServiceMutationLease(client, safeUserId, deps, (leasedDeps) => createUserServiceCredential({
      userId: safeUserId, operatorUserId, ip, userAgent, requestId
    }, leasedDeps))
  }
  await getUserForServiceMutation(client, safeUserId)
  const credentials = await listUserCredentials(client, safeUserId)
  const active = credentials.find((item) => item.status === 'active')
  if (active) return { ok: true, alreadyActive: true, serviceCredential: formatServiceCredentialForAdmin(active) }

  const latest = credentials[0]
  const mutation = {
    status: 'active', disabled_at: null, deleted_at: null, last_error: null,
    api_key_last4: null, api_key_encrypted: null, limit_cost: 0, limit_daily_cost: 0, expired_on: 0
  }
  const identifier = `shared_${randomUUID()}`
  const query = latest
    ? client.from(CREDENTIAL_TABLE).update(mutation).eq('id', latest.id)
    : client.from(CREDENTIAL_TABLE).insert({
      ...mutation, user_id: safeUserId, provider: 'shared',
      internal_name: identifier, provider_api_name: identifier, created_by: operatorUserId || null
    })
  const { data, error } = await query.select('*').single()
  if (error) throw new HttpError(500, error.message, 'SERVICE_CREDENTIAL_UPDATE_FAILED')
  await createServiceAuditLog(client, { userId: safeUserId, operatorUserId, action: 'admin.service_access.activate', ip, userAgent, requestId })
  return { ok: true, serviceCredential: formatServiceCredentialForAdmin(data) }
}

export const resolveActiveUserServiceAccess = async (userId, deps = {}) => {
  const client = deps.supabaseClient || supabase
  const safeUserId = String(userId || '').trim()
  if (!safeUserId) throw new HttpError(401, 'Missing authenticated user', 'UNAUTHORIZED')
  const { data: user, error } = await client.from('users').select('id,status,deleted_at').eq('id', safeUserId).maybeSingle()
  if (error) throw new HttpError(500, error.message, 'USER_QUERY_FAILED')
  if (!user || user.deleted_at || user.status === 'deleted') throw new HttpError(403, 'Account is deleted', 'ACCOUNT_DELETED')
  if (user.status !== 'active') throw new HttpError(403, 'Account is suspended', 'ACCOUNT_SUSPENDED')
  const credentials = await listUserCredentials(client, safeUserId)
  const active = credentials.find((item) => item.status === 'active')
  if (active) return { serviceCredentialId: active.id }
  if (credentials[0]?.status === 'disabled' || credentials[0]?.status === 'deleted') {
    throw new HttpError(403, '当前账号的生成服务已暂停，请联系管理员。', 'SERVICE_DISABLED')
  }
  throw new HttpError(403, '当前账号尚未开通生成服务，请联系管理员。', 'SERVICE_NOT_ENABLED')
}

export const disableUserServiceCredential = async ({
  userId, operatorUserId, reason = '', ip = '', userAgent = '', requestId = '', lifecycleMutation = false
}, deps = {}) => {
  const client = deps.supabaseClient || supabase
  const safeUserId = String(userId || '').trim()
  if (!safeUserId) throw new HttpError(400, 'userId is required', 'INVALID_USER_ID')
  if (!lifecycleMutation && !deps.serviceMutationToken && typeof client.rpc === 'function') {
    return withServiceMutationLease(client, safeUserId, deps, (leasedDeps) => disableUserServiceCredential({
      userId: safeUserId, operatorUserId, reason, ip, userAgent, requestId
    }, leasedDeps))
  }
  if (!lifecycleMutation) await getUserForServiceMutation(client, safeUserId)
  const credentials = await listUserCredentials(client, safeUserId)
  const active = credentials.filter((item) => item.status === 'active')
  if (!active.length) return { ok: true, serviceCredential: formatServiceCredentialForAdmin(credentials[0]) }
  const disabledAt = new Date().toISOString()
  const { data, error } = await client.from(CREDENTIAL_TABLE)
    .update({ status: 'disabled', disabled_at: disabledAt, last_error: null })
    .eq('user_id', safeUserId).eq('status', 'active').select('*')
  if (error) throw new HttpError(500, error.message, 'SERVICE_CREDENTIAL_DISABLE_FAILED')
  await createServiceAuditLog(client, { userId: safeUserId, operatorUserId, action: 'admin.service_access.disable', reason, ip, userAgent, requestId })
  return { ok: true, serviceCredential: formatServiceCredentialForAdmin(data?.[0] || { ...active[0], status: 'disabled', disabled_at: disabledAt }) }
}
