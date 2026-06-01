import { supabase } from '../config/supabase.js'
import { invalidateUserAuthzCache } from './rbac.service.js'
import { HttpError } from '../utils/http.js'
import { disableUserServiceCredential } from './service-access.service.js'
import { createAdminLog } from './admin-operation-logs.js'
import { removeApiKeyAssignmentsForUser } from './admin-api-key-assignments.js'

const isMissingRelation = (error) => {
  const msg = String(error?.message || '').toLowerCase()
  return msg.includes('relation') && msg.includes('does not exist')
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
    removeApiKeyAssignmentsForUser(safeTargetUserId)
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
