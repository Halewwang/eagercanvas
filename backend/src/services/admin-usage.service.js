import { supabase } from '../config/supabase.js'
import { invalidateUserAuthzCache } from './rbac.service.js'
import { get302ApiKeys, get302RuntimeApiKeyByName, normalize302ApiKeyList } from './dashboard302.service.js'
import { HttpError } from '../utils/http.js'
import { disableUserServiceCredential, formatServiceCredentialForAdmin } from './service-access.service.js'

const ASSIGNMENT_TABLE = 'user_api_key_assignments'

const isMissingRelation = (error) => {
  const msg = String(error?.message || '').toLowerCase()
  return msg.includes('relation') && msg.includes('does not exist')
}

const requireAssignmentTable = (error) => {
  if (isMissingRelation(error)) {
    throw new HttpError(
      500,
      'Table user_api_key_assignments is missing. Run supabase migration 003_usage_admin_key_assignments.sql first.',
      'ASSIGNMENT_TABLE_MISSING'
    )
  }
  throw new HttpError(500, error.message || 'Assignment query failed', 'ASSIGNMENT_QUERY_FAILED')
}

const loadAssignments = async () => {
  const { data, error } = await supabase
    .from(ASSIGNMENT_TABLE)
    .select('user_id, api_name, created_at')

  if (error) {
    if (isMissingRelation(error)) return []
    throw new HttpError(500, error.message, 'ASSIGNMENT_QUERY_FAILED')
  }

  return Array.isArray(data) ? data : []
}

const loadActiveApiKeyNames = async () => {
  try {
    const response = await get302ApiKeys()
    const list = normalize302ApiKeyList(response)
    return new Set(
      list
        .map((item) => String(item?.api_name || '').trim())
        .filter(Boolean)
    )
  } catch {
    return null
  }
}

export const getUserAssignedApiKeys = async (userId) => {
  const safeUserId = String(userId || '').trim()
  if (!safeUserId) return []

  const { data, error } = await supabase
    .from(ASSIGNMENT_TABLE)
    .select('api_name, created_at')
    .eq('user_id', safeUserId)
    .order('created_at', { ascending: false })

  if (error) {
    if (isMissingRelation(error)) return []
    throw new HttpError(500, error.message, 'ASSIGNMENT_QUERY_FAILED')
  }

  const list = Array.isArray(data) ? data : []
  const activeApiKeyNames = await loadActiveApiKeyNames()
  if (!activeApiKeyNames) return list
  return list.filter((item) => activeApiKeyNames.has(String(item.api_name || '').trim()))
}

export const resolveUserProviderAccess = async (userId, requestedApiName = '') => {
  const preferredApiName = String(requestedApiName || '').trim()
  const assignments = await getUserAssignedApiKeys(userId)
  const assignedNames = assignments.map((item) => String(item.api_name || '').trim()).filter(Boolean)

  const apiName = preferredApiName && assignedNames.includes(preferredApiName)
    ? preferredApiName
    : assignedNames[0] || ''

  if (!apiName) {
    return {
      apiName: '',
      apiKey: '',
      assignedApiNames: assignedNames
    }
  }

  const apiKey = await get302RuntimeApiKeyByName(apiName)
  return {
    apiName,
    apiKey,
    assignedApiNames: assignedNames
  }
}

const loadRolesMap = async (userIds) => {
  const safeUserIds = [...new Set((userIds || []).filter(Boolean))]
  if (!safeUserIds.length) return new Map()

  const [{ data: userRoles, error: userRolesError }, { data: roles, error: rolesError }] = await Promise.all([
    supabase.from('user_roles').select('user_id, role_id').in('user_id', safeUserIds),
    supabase.from('roles').select('id, code')
  ])

  if (userRolesError) {
    if (isMissingRelation(userRolesError)) return new Map()
    throw new HttpError(500, userRolesError.message, 'USER_ROLES_QUERY_FAILED')
  }
  if (rolesError) {
    if (isMissingRelation(rolesError)) return new Map()
    throw new HttpError(500, rolesError.message, 'ROLES_QUERY_FAILED')
  }

  const roleCodeMap = new Map((roles || []).map((row) => [row.id, row.code]).filter(([, code]) => !!code))
  const mapped = new Map()

  for (const row of userRoles || []) {
    const roleCode = roleCodeMap.get(row.role_id)
    if (!roleCode) continue
    const list = mapped.get(row.user_id) || []
    list.push(roleCode)
    mapped.set(row.user_id, list)
  }

  for (const [key, list] of mapped.entries()) {
    mapped.set(key, [...new Set(list)].sort())
  }
  return mapped
}

const createAdminLog = async ({ operatorUserId, targetUserId = null, action, metadata = {} }) => {
  const payload = {
    operator_user_id: operatorUserId || null,
    target_user_id: targetUserId || null,
    action: String(action || 'admin.unknown'),
    metadata: metadata && typeof metadata === 'object' ? metadata : {}
  }

  const { error } = await supabase
    .from('admin_operation_logs')
    .insert(payload)

  if (error) {
    if (isMissingRelation(error)) {
      await supabase
        .from('audit_logs')
        .insert({
          user_id: operatorUserId || null,
          action: payload.action,
          metadata: {
            ...payload.metadata,
            targetUserId: targetUserId || null
          }
        })
      return
    }
    throw new HttpError(500, error.message, 'ADMIN_AUDIT_WRITE_FAILED')
  }
}

const toIsoDateStart = (value) => {
  const val = String(value || '').trim()
  return val ? `${val}T00:00:00.000Z` : ''
}

const toIsoDateEnd = (value) => {
  const val = String(value || '').trim()
  return val ? `${val}T23:59:59.999Z` : ''
}

export const listUsersForAdmin = async () => {
  const [usersRes, profilesRes, dailyAggRes, assignments, usageEventsRes, credentialsRes, billingRecordsRes, activeApiKeyNames] = await Promise.all([
    supabase.from('users').select('*').order('created_at', { ascending: false }),
    supabase.from('user_profiles').select('user_id, display_name, registered_at, last_login_at'),
    supabase.from('usage_daily_agg').select('user_id, total_calls, total_tokens, total_images, total_video_seconds, total_cost_usd'),
    loadAssignments(),
    supabase
      .from('usage_events')
      .select('user_id, api_name, cost_usd, estimated_cost_usd, billing_status, created_at')
      .order('created_at', { ascending: false }),
    supabase
      .from('user_service_credentials')
      .select('*')
      .order('created_at', { ascending: false }),
    supabase
      .from('provider_billing_records')
      .select('user_id, service_credential_id, model, cost_amount, cost_currency, reconciliation_status, official_created_at')
      .order('official_created_at', { ascending: false }),
    loadActiveApiKeyNames()
  ])

  if (usersRes.error) throw new HttpError(500, usersRes.error.message, 'USERS_QUERY_FAILED')
  if (profilesRes.error) throw new HttpError(500, profilesRes.error.message, 'PROFILES_QUERY_FAILED')
  if (dailyAggRes.error) throw new HttpError(500, dailyAggRes.error.message, 'USAGE_AGG_QUERY_FAILED')
  if (usageEventsRes.error) throw new HttpError(500, usageEventsRes.error.message, 'USAGE_EVENTS_QUERY_FAILED')
  if (credentialsRes.error && !isMissingRelation(credentialsRes.error)) throw new HttpError(500, credentialsRes.error.message, 'SERVICE_CREDENTIALS_QUERY_FAILED')
  if (billingRecordsRes.error && !isMissingRelation(billingRecordsRes.error)) throw new HttpError(500, billingRecordsRes.error.message, 'BILLING_RECORDS_QUERY_FAILED')
  const rolesMap = await loadRolesMap((usersRes.data || []).map((item) => item.id))

  const profileMap = new Map((profilesRes.data || []).map((p) => [p.user_id, p]))

  const usageMap = new Map()
  for (const row of dailyAggRes.data || []) {
    const key = row.user_id
    const current = usageMap.get(key) || {
      totalCalls: 0,
      totalTokens: 0,
      totalImages: 0,
      totalVideoSeconds: 0,
      totalCostUsd: 0
    }

    current.totalCalls += Number(row.total_calls || 0)
    current.totalTokens += Number(row.total_tokens || 0)
    current.totalImages += Number(row.total_images || 0)
    current.totalVideoSeconds += Number(row.total_video_seconds || 0)
    current.totalCostUsd += Number(row.total_cost_usd || 0)
    usageMap.set(key, current)
  }

  const assignmentMap = new Map()
  for (const row of assignments) {
    const apiName = String(row.api_name || '').trim()
    if (!apiName) continue
    if (activeApiKeyNames && !activeApiKeyNames.has(apiName)) continue
    const list = assignmentMap.get(row.user_id) || []
    list.push({ apiName, createdAt: row.created_at })
    assignmentMap.set(row.user_id, list)
  }

  const usageEventMetaMap = new Map()
  const usageEventTotalsMap = new Map()
  for (const row of usageEventsRes.data || []) {
    const key = row.user_id
    const current = usageEventMetaMap.get(key) || {
      lastActivityAt: null,
      pendingBillingCount: 0,
      byApiKey: new Map()
    }
    const usageTotals = usageEventTotalsMap.get(key) || {
      totalCostUsd: 0,
      estimatedCostUsd: 0
    }

    if (!current.lastActivityAt) current.lastActivityAt = row.created_at || null
    if (String(row.billing_status || '') === 'pending') current.pendingBillingCount += 1
    usageTotals.totalCostUsd += Number(row.cost_usd || 0)
    usageTotals.estimatedCostUsd += Number(row.estimated_cost_usd || row.cost_usd || 0)

    const apiName = String(row.api_name || '').trim()
    if (apiName && (!activeApiKeyNames || activeApiKeyNames.has(apiName))) {
      const item = current.byApiKey.get(apiName) || {
        apiName,
        totalCostUsd: 0,
        totalCalls: 0
      }
      item.totalCostUsd += Number(row.cost_usd || 0)
      item.totalCalls += 1
      current.byApiKey.set(apiName, item)
    }

    usageEventMetaMap.set(key, current)
    usageEventTotalsMap.set(key, usageTotals)
  }

  const credentialMap = new Map()
  for (const row of credentialsRes.data || []) {
    const list = credentialMap.get(row.user_id) || []
    list.push(row)
    credentialMap.set(row.user_id, list)
  }

  const officialUsageMap = new Map()
  const reconciliationMap = new Map()
  for (const row of billingRecordsRes.data || []) {
    const key = row.user_id
    if (!key) continue
    const official = officialUsageMap.get(key) || {
      totalCalls: 0,
      totalCostAmount: 0,
      currency: row.cost_currency || 'USD',
      byModel: new Map()
    }
    official.totalCalls += 1
    official.totalCostAmount += Number(row.cost_amount || 0)
    const model = String(row.model || 'unknown')
    const modelEntry = official.byModel.get(model) || { model, calls: 0, costAmount: 0 }
    modelEntry.calls += 1
    modelEntry.costAmount += Number(row.cost_amount || 0)
    official.byModel.set(model, modelEntry)
    officialUsageMap.set(key, official)

    const reconciliation = reconciliationMap.get(key) || { unmatchedCount: 0 }
    if (String(row.reconciliation_status || '') === 'unmatched') reconciliation.unmatchedCount += 1
    reconciliationMap.set(key, reconciliation)
  }

  return (usersRes.data || []).map((user) => {
    const profile = profileMap.get(user.id)
    const usageMeta = usageEventMetaMap.get(user.id)
    const credentials = credentialMap.get(user.id) || []
    const latestCredential = credentials.find((item) => item.status === 'active') || credentials[0] || null
    const official = officialUsageMap.get(user.id)
    const estimated = usageEventTotalsMap.get(user.id)
    const reconciliation = reconciliationMap.get(user.id) || { unmatchedCount: 0 }
    return {
      id: user.id,
      email: user.email,
      createdAt: user.created_at,
      status: user.status || 'active',
      suspendedAt: user.suspended_at || null,
      suspendedReason: user.suspended_reason || null,
      deletedAt: user.deleted_at || null,
      displayName: profile?.display_name || '',
      registeredAt: profile?.registered_at || null,
      lastLoginAt: profile?.last_login_at || null,
      usage: {
        ...(usageMap.get(user.id) || {
          totalCalls: 0,
          totalTokens: 0,
          totalImages: 0,
          totalVideoSeconds: 0,
          totalCostUsd: 0
        }),
        totalCostUsd: Number(usageEventTotalsMap.get(user.id)?.totalCostUsd || 0)
      },
      service: formatServiceCredentialForAdmin(latestCredential),
      officialUsage: official
        ? {
            totalCalls: official.totalCalls,
            totalCostAmount: Number(official.totalCostAmount || 0),
            currency: official.currency || 'USD',
            byModel: [...official.byModel.values()].sort((a, b) => Number(b.costAmount || 0) - Number(a.costAmount || 0))
          }
        : {
            totalCalls: 0,
            totalCostAmount: 0,
            currency: 'USD',
            byModel: []
          },
      estimatedUsage: {
        totalCalls: Number(usageMap.get(user.id)?.totalCalls || 0),
        totalCostAmount: Number(estimated?.estimatedCostUsd || estimated?.totalCostUsd || 0)
      },
      reconciliation: {
        pendingCount: Number(usageMeta?.pendingBillingCount || 0),
        unmatchedCount: Number(reconciliation.unmatchedCount || 0),
        diffAmount: Number((official?.totalCostAmount || 0) - (estimated?.estimatedCostUsd || estimated?.totalCostUsd || 0))
      },
      usageMeta: {
        lastActivityAt: usageMeta?.lastActivityAt || null,
        pendingBillingCount: Number(usageMeta?.pendingBillingCount || 0),
        byApiKey: usageMeta
          ? [...usageMeta.byApiKey.values()].sort((a, b) => Number(b.totalCostUsd || 0) - Number(a.totalCostUsd || 0))
          : []
      },
      assignedApiKeys: assignmentMap.get(user.id) || [],
      roles: rolesMap.get(user.id) || ['user']
    }
  })
}

export const removeApiKeyAssignments = async (apiName) => {
  const safeApiName = String(apiName || '').trim()
  if (!safeApiName) return { ok: true }

  const { error } = await supabase
    .from(ASSIGNMENT_TABLE)
    .delete()
    .eq('api_name', safeApiName)

  if (error) requireAssignmentTable(error)
  return { ok: true }
}

const getRoleCodeMap = async () => {
  const { data, error } = await supabase.from('roles').select('id, code')
  if (error) {
    if (isMissingRelation(error)) {
      throw new HttpError(500, 'RBAC tables are missing. Run migration 004_rbac_admin_system.sql first.', 'RBAC_SCHEMA_MISSING')
    }
    throw new HttpError(500, error.message, 'ROLES_QUERY_FAILED')
  }
  return new Map((data || []).map((row) => [row.code, row.id]))
}

const getUserRoleCodes = async (userId) => {
  const [{ data: roles, error: rolesError }, { data: userRoles, error: userRolesError }] = await Promise.all([
    supabase.from('roles').select('id, code'),
    supabase.from('user_roles').select('role_id').eq('user_id', userId)
  ])

  if (rolesError || userRolesError) {
    const first = rolesError || userRolesError
    if (isMissingRelation(first)) {
      throw new HttpError(500, 'RBAC tables are missing. Run migration 004_rbac_admin_system.sql first.', 'RBAC_SCHEMA_MISSING')
    }
    throw new HttpError(500, first.message || 'Role query failed', 'USER_ROLES_QUERY_FAILED')
  }

  const roleCodeMap = new Map((roles || []).map((item) => [item.id, item.code]))
  return [...new Set((userRoles || []).map((row) => roleCodeMap.get(row.role_id)).filter(Boolean))].sort()
}

export const updateUserRoles = async ({
  operatorUserId,
  operatorRoles = [],
  targetUserId,
  roleCodes = [],
  ip,
  userAgent
}) => {
  const safeTargetUserId = String(targetUserId || '').trim()
  if (!safeTargetUserId) throw new HttpError(400, 'targetUserId is required', 'INVALID_TARGET_USER')

  const normalizedRoles = [...new Set((roleCodes || []).map((item) => String(item || '').trim()).filter(Boolean))]
  if (!normalizedRoles.length) {
    throw new HttpError(400, 'roleCodes must not be empty', 'INVALID_ROLE_CODES')
  }

  const isOperatorSuperAdmin = (operatorRoles || []).includes('super_admin')
  const beforeRoles = await getUserRoleCodes(safeTargetUserId)
  const isTargetSuperAdmin = beforeRoles.includes('super_admin')

  if (!isOperatorSuperAdmin && isTargetSuperAdmin) {
    throw new HttpError(403, 'Only super_admin can modify a super_admin account', 'FORBIDDEN_SUPER_ADMIN_EDIT')
  }
  if (!isOperatorSuperAdmin && normalizedRoles.includes('super_admin')) {
    throw new HttpError(403, 'Only super_admin can grant super_admin role', 'FORBIDDEN_SUPER_ADMIN_GRANT')
  }

  const { data: targetUser, error: targetUserError } = await supabase
    .from('users')
    .select('id, email')
    .eq('id', safeTargetUserId)
    .maybeSingle()
  if (targetUserError) throw new HttpError(500, targetUserError.message, 'USER_QUERY_FAILED')
  if (!targetUser) throw new HttpError(404, 'Target user not found', 'TARGET_USER_NOT_FOUND')

  const roleCodeIdMap = await getRoleCodeMap()
  const roleIds = normalizedRoles.map((code) => roleCodeIdMap.get(code)).filter(Boolean)
  if (roleIds.length !== normalizedRoles.length) {
    const unknown = normalizedRoles.filter((code) => !roleCodeIdMap.get(code))
    throw new HttpError(400, `Unknown role code: ${unknown.join(', ')}`, 'INVALID_ROLE_CODES')
  }

  const { error: deleteError } = await supabase
    .from('user_roles')
    .delete()
    .eq('user_id', safeTargetUserId)
  if (deleteError) throw new HttpError(500, deleteError.message, 'USER_ROLES_DELETE_FAILED')

  const { error: insertError } = await supabase
    .from('user_roles')
    .insert(roleIds.map((roleId) => ({
      user_id: safeTargetUserId,
      role_id: roleId,
      created_by: operatorUserId || null
    })))
  if (insertError) throw new HttpError(500, insertError.message, 'USER_ROLES_INSERT_FAILED')

  invalidateUserAuthzCache(safeTargetUserId)

  await createAdminLog({
    operatorUserId,
    targetUserId: safeTargetUserId,
    action: 'admin.user.role.update',
    metadata: {
      beforeRoles,
      afterRoles: normalizedRoles,
      ip: String(ip || ''),
      userAgent: String(userAgent || '')
    }
  })

  return {
    ok: true,
    user: {
      id: targetUser.id,
      email: targetUser.email
    },
    beforeRoles,
    roles: normalizedRoles
  }
}

export const updateUserStatus = async ({
  operatorUserId,
  operatorRoles = [],
  targetUserId,
  status,
  reason,
  ip,
  userAgent
}) => {
  const safeTargetUserId = String(targetUserId || '').trim()
  const safeStatus = String(status || '').trim()
  const allowedStatuses = new Set(['active', 'suspended'])

  if (!safeTargetUserId) throw new HttpError(400, 'targetUserId is required', 'INVALID_TARGET_USER')
  if (!allowedStatuses.has(safeStatus)) throw new HttpError(400, 'Invalid status value', 'INVALID_STATUS')

  const isOperatorSuperAdmin = (operatorRoles || []).includes('super_admin')
  const { data: targetUser, error: targetUserError } = await supabase
    .from('users')
    .select('id, email, status, deleted_at')
    .eq('id', safeTargetUserId)
    .maybeSingle()
  if (targetUserError) throw new HttpError(500, targetUserError.message, 'USER_QUERY_FAILED')
  if (!targetUser) throw new HttpError(404, 'Target user not found', 'TARGET_USER_NOT_FOUND')
  if (targetUser.deleted_at || targetUser.status === 'deleted') {
    throw new HttpError(400, 'Deleted account cannot change status', 'ACCOUNT_ALREADY_DELETED')
  }

  const beforeRoles = await getUserRoleCodes(safeTargetUserId)
  if (!isOperatorSuperAdmin && beforeRoles.includes('super_admin')) {
    throw new HttpError(403, 'Only super_admin can modify a super_admin account', 'FORBIDDEN_SUPER_ADMIN_EDIT')
  }

  const patch = safeStatus === 'active'
    ? { status: 'active', suspended_at: null, suspended_reason: null }
    : { status: 'suspended', suspended_at: new Date().toISOString(), suspended_reason: String(reason || '').trim() || null }

  const { data: updated, error: updateError } = await supabase
    .from('users')
    .update(patch)
    .eq('id', safeTargetUserId)
    .select('id, email, status, suspended_at, suspended_reason')
    .single()
  if (updateError) throw new HttpError(500, updateError.message, 'USER_STATUS_UPDATE_FAILED')

  if (safeStatus === 'suspended') {
    await supabase
      .from('sessions')
      .update({ revoked: true, revoked_at: new Date().toISOString() })
      .eq('user_id', safeTargetUserId)
      .eq('revoked', false)
    await disableUserServiceCredential({
      userId: safeTargetUserId,
      operatorUserId,
      reason: 'account suspended',
      ip,
      userAgent
    }).catch((error) => {
      console.warn('[admin] service disable after suspension failed', error.message || error)
    })
  }

  invalidateUserAuthzCache(safeTargetUserId)
  await createAdminLog({
    operatorUserId,
    targetUserId: safeTargetUserId,
    action: 'admin.user.status.update',
    metadata: {
      beforeStatus: targetUser.status || 'active',
      afterStatus: updated.status,
      reason: updated.suspended_reason || null,
      ip: String(ip || ''),
      userAgent: String(userAgent || '')
    }
  })

  return {
    ok: true,
    user: {
      id: updated.id,
      email: updated.email,
      status: updated.status,
      suspendedAt: updated.suspended_at || null,
      suspendedReason: updated.suspended_reason || null
    }
  }
}

export const deleteUserAccount = async ({
  operatorUserId,
  operatorRoles = [],
  targetUserId,
  ip,
  userAgent
}) => {
  const safeTargetUserId = String(targetUserId || '').trim()
  if (!safeTargetUserId) throw new HttpError(400, 'targetUserId is required', 'INVALID_TARGET_USER')
  if (safeTargetUserId === String(operatorUserId || '').trim()) {
    throw new HttpError(400, 'Cannot delete your own account', 'SELF_DELETE_NOT_ALLOWED')
  }

  const isOperatorSuperAdmin = (operatorRoles || []).includes('super_admin')
  const beforeRoles = await getUserRoleCodes(safeTargetUserId)
  if (!isOperatorSuperAdmin && beforeRoles.includes('super_admin')) {
    throw new HttpError(403, 'Only super_admin can delete a super_admin account', 'FORBIDDEN_SUPER_ADMIN_DELETE')
  }

  const { data: targetUser, error: targetUserError } = await supabase
    .from('users')
    .select('id, email, status, deleted_at')
    .eq('id', safeTargetUserId)
    .maybeSingle()
  if (targetUserError) throw new HttpError(500, targetUserError.message, 'USER_QUERY_FAILED')
  if (!targetUser) throw new HttpError(404, 'Target user not found', 'TARGET_USER_NOT_FOUND')
  if (targetUser.deleted_at || targetUser.status === 'deleted') {
    return { ok: true, alreadyDeleted: true }
  }

  const now = new Date().toISOString()
  const { error: updateError } = await supabase
    .from('users')
    .update({
      status: 'deleted',
      deleted_at: now,
      deleted_by: operatorUserId || null,
      suspended_at: now,
      suspended_reason: 'Deleted by admin'
    })
    .eq('id', safeTargetUserId)
  if (updateError) throw new HttpError(500, updateError.message, 'USER_DELETE_FAILED')

  await Promise.all([
    supabase
      .from('sessions')
      .update({ revoked: true, revoked_at: now })
      .eq('user_id', safeTargetUserId)
      .eq('revoked', false),
    supabase
      .from(ASSIGNMENT_TABLE)
      .delete()
      .eq('user_id', safeTargetUserId)
  ])
  await disableUserServiceCredential({
    userId: safeTargetUserId,
    operatorUserId,
    reason: 'account deleted',
    ip,
    userAgent
  }).catch((error) => {
    console.warn('[admin] service disable after deletion failed', error.message || error)
  })

  invalidateUserAuthzCache(safeTargetUserId)
  await createAdminLog({
    operatorUserId,
    targetUserId: safeTargetUserId,
    action: 'admin.user.delete',
    metadata: {
      beforeStatus: targetUser.status || 'active',
      ip: String(ip || ''),
      userAgent: String(userAgent || '')
    }
  })

  return { ok: true }
}

export const getAdminUsageSummary = async ({ from, to, userId } = {}) => {
  const query = supabase
    .from('provider_billing_records')
    .select('user_id,input_tokens,output_tokens,image_count,video_seconds,cost_amount,official_created_at')

  if (userId) query.eq('user_id', String(userId))
  if (from) query.gte('official_created_at', toIsoDateStart(from))
  if (to) query.lte('official_created_at', toIsoDateEnd(to))

  const { data, error } = await query
  if (error) {
    if (isMissingRelation(error)) {
      return { totalCalls: 0, totalInputTokens: 0, totalOutputTokens: 0, totalImages: 0, totalVideoSeconds: 0, totalCostUsd: 0, totalUsers: 0 }
    }
    throw new HttpError(500, error.message, 'ADMIN_USAGE_SUMMARY_FAILED')
  }

  const users = new Set()
  const summary = (data || []).reduce((acc, item) => {
    users.add(item.user_id)
    acc.totalCalls += 1
    acc.totalInputTokens += Number(item.input_tokens || 0)
    acc.totalOutputTokens += Number(item.output_tokens || 0)
    acc.totalImages += Number(item.image_count || 0)
    acc.totalVideoSeconds += Number(item.video_seconds || 0)
    acc.totalCostUsd += Number(item.cost_amount || 0)
    return acc
  }, {
    totalCalls: 0,
    totalInputTokens: 0,
    totalOutputTokens: 0,
    totalImages: 0,
    totalVideoSeconds: 0,
    totalCostUsd: 0
  })

  return {
    ...summary,
    totalUsers: users.size
  }
}

export const getAdminUsageTimeseries = async ({ from, to, userId } = {}) => {
  const query = supabase
    .from('usage_daily_agg')
    .select('date,user_id,total_calls,total_tokens,total_images,total_video_seconds,total_cost_usd')
    .order('date', { ascending: true })

  if (userId) query.eq('user_id', String(userId))
  if (from) query.gte('date', String(from))
  if (to) query.lte('date', String(to))

  const { data, error } = await query
  if (error) throw new HttpError(500, error.message, 'ADMIN_USAGE_SERIES_FAILED')

  const map = new Map()
  for (const row of data || []) {
    const key = String(row.date)
    const current = map.get(key) || {
      date: key,
      total_calls: 0,
      total_tokens: 0,
      total_images: 0,
      total_video_seconds: 0,
      total_cost_usd: 0
    }
    current.total_calls += Number(row.total_calls || 0)
    current.total_tokens += Number(row.total_tokens || 0)
    current.total_images += Number(row.total_images || 0)
    current.total_video_seconds += Number(row.total_video_seconds || 0)
    current.total_cost_usd += Number(row.total_cost_usd || 0)
    map.set(key, current)
  }

  return [...map.values()].sort((a, b) => String(a.date).localeCompare(String(b.date)))
}

export const listAdminOperationLogs = async ({ page = 1, limit = 20 }) => {
  const safePage = Math.max(1, Number(page) || 1)
  const safeLimit = Math.max(1, Math.min(100, Number(limit) || 20))
  const from = (safePage - 1) * safeLimit
  const to = from + safeLimit - 1

  const { data, error, count } = await supabase
    .from('admin_operation_logs')
    .select('id, operator_user_id, target_user_id, action, metadata, created_at', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(from, to)

  if (error) {
    if (isMissingRelation(error)) {
      throw new HttpError(500, 'admin_operation_logs table is missing. Run migration 004_rbac_admin_system.sql first.', 'ADMIN_AUDIT_TABLE_MISSING')
    }
    throw new HttpError(500, error.message, 'ADMIN_AUDIT_QUERY_FAILED')
  }

  const userIds = [...new Set(
    (data || [])
      .flatMap((row) => [row.operator_user_id, row.target_user_id])
      .filter(Boolean)
  )]

  let userEmailMap = new Map()
  if (userIds.length) {
    const { data: users, error: usersError } = await supabase
      .from('users')
      .select('id, email')
      .in('id', userIds)
    if (usersError) throw new HttpError(500, usersError.message, 'ADMIN_AUDIT_USER_QUERY_FAILED')
    userEmailMap = new Map((users || []).map((item) => [item.id, item.email]))
  }

  return {
    items: (data || []).map((row) => ({
      id: row.id,
      action: row.action,
      metadata: row.metadata || {},
      createdAt: row.created_at,
      operator: row.operator_user_id
        ? { id: row.operator_user_id, email: userEmailMap.get(row.operator_user_id) || '' }
        : null,
      target: row.target_user_id
        ? { id: row.target_user_id, email: userEmailMap.get(row.target_user_id) || '' }
        : null
    })),
    pagination: {
      page: safePage,
      limit: safeLimit,
      total: Number(count || 0)
    }
  }
}

export const assignApiKeyToUser = async ({ userId, apiName, operatorUserId = null, ip, userAgent }) => {
  const safeUserId = String(userId || '').trim()
  const safeApiName = String(apiName || '').trim()
  if (!safeUserId) throw new HttpError(400, 'userId is required', 'INVALID_USER_ID')
  if (!safeApiName) throw new HttpError(400, 'apiName is required', 'INVALID_API_NAME')

  const activeApiKeyNames = await loadActiveApiKeyNames()
  if (!activeApiKeyNames) {
    throw new HttpError(503, 'Unable to verify API key inventory right now. Please try again later.', 'API_KEY_INVENTORY_UNAVAILABLE')
  }
  if (!activeApiKeyNames.has(safeApiName)) {
    throw new HttpError(404, 'API key does not exist or has been deleted', 'API_KEY_NOT_FOUND')
  }

  const { data: user, error: userError } = await supabase
    .from('users')
    .select('id')
    .eq('id', safeUserId)
    .maybeSingle()

  if (userError) throw new HttpError(500, userError.message, 'USER_QUERY_FAILED')
  if (!user) throw new HttpError(404, 'User not found', 'USER_NOT_FOUND')

  const { error } = await supabase
    .from(ASSIGNMENT_TABLE)
    .upsert(
      { user_id: safeUserId, api_name: safeApiName },
      { onConflict: 'user_id,api_name' }
    )

  if (error) requireAssignmentTable(error)

  if (operatorUserId) {
    await createAdminLog({
      operatorUserId,
      targetUserId: safeUserId,
      action: 'admin.api_key.assign',
      metadata: {
        apiName: safeApiName,
        ip: String(ip || ''),
        userAgent: String(userAgent || '')
      }
    })
  }

  return { ok: true }
}

export const unassignApiKeyFromUser = async ({ userId, apiName, operatorUserId = null, ip, userAgent }) => {
  const safeUserId = String(userId || '').trim()
  const safeApiName = String(apiName || '').trim()
  if (!safeUserId) throw new HttpError(400, 'userId is required', 'INVALID_USER_ID')
  if (!safeApiName) throw new HttpError(400, 'apiName is required', 'INVALID_API_NAME')

  const { error } = await supabase
    .from(ASSIGNMENT_TABLE)
    .delete()
    .eq('user_id', safeUserId)
    .eq('api_name', safeApiName)

  if (error) requireAssignmentTable(error)

  if (operatorUserId) {
    await createAdminLog({
      operatorUserId,
      targetUserId: safeUserId,
      action: 'admin.api_key.unassign',
      metadata: {
        apiName: safeApiName,
        ip: String(ip || ''),
        userAgent: String(userAgent || '')
      }
    })
  }

  return { ok: true }
}
