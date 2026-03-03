import { supabase } from '../config/supabase.js'
import { invalidateUserAuthzCache } from './rbac.service.js'
import { HttpError } from '../utils/http.js'

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

export const listUsersForAdmin = async () => {
  const [usersRes, profilesRes, dailyAggRes, assignments] = await Promise.all([
    supabase.from('users').select('id, email, created_at').order('created_at', { ascending: false }),
    supabase.from('user_profiles').select('user_id, display_name, registered_at, last_login_at'),
    supabase.from('usage_daily_agg').select('user_id, total_calls, total_tokens, total_images, total_video_seconds, total_cost_usd'),
    loadAssignments()
  ])

  if (usersRes.error) throw new HttpError(500, usersRes.error.message, 'USERS_QUERY_FAILED')
  if (profilesRes.error) throw new HttpError(500, profilesRes.error.message, 'PROFILES_QUERY_FAILED')
  if (dailyAggRes.error) throw new HttpError(500, dailyAggRes.error.message, 'USAGE_AGG_QUERY_FAILED')
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
    const list = assignmentMap.get(row.user_id) || []
    list.push({ apiName: row.api_name, createdAt: row.created_at })
    assignmentMap.set(row.user_id, list)
  }

  return (usersRes.data || []).map((user) => {
    const profile = profileMap.get(user.id)
    return {
      id: user.id,
      email: user.email,
      createdAt: user.created_at,
      displayName: profile?.display_name || '',
      registeredAt: profile?.registered_at || null,
      lastLoginAt: profile?.last_login_at || null,
      usage: usageMap.get(user.id) || {
        totalCalls: 0,
        totalTokens: 0,
        totalImages: 0,
        totalVideoSeconds: 0,
        totalCostUsd: 0
      },
      assignedApiKeys: assignmentMap.get(user.id) || []
      ,
      roles: rolesMap.get(user.id) || ['user']
    }
  })
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
