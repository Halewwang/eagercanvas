import { supabase } from '../config/supabase.js'
import { HttpError } from '../utils/http.js'
import { deleteSharedCacheValue, getSharedCacheValue, setSharedCacheValue } from './shared-cache.service.js'

const CACHE_TTL_MS = Number(process.env.RBAC_CACHE_TTL_MS || 30000)
const CACHE_NAMESPACE = 'rbac-authz'

const isMissingRelation = (error) => {
  const msg = String(error?.message || '').toLowerCase()
  return msg.includes('relation') && msg.includes('does not exist')
}

const toUniqueSorted = (values) => {
  return [...new Set((values || []).map((item) => String(item || '').trim()).filter(Boolean))].sort()
}

const queryUserRoleIds = async (userId) => {
  const { data, error } = await supabase
    .from('user_roles')
    .select('role_id')
    .eq('user_id', userId)

  if (error) {
    if (isMissingRelation(error)) return { roleIds: [], missingSchema: true }
    throw new HttpError(500, error.message || 'Failed to query user roles', 'RBAC_QUERY_FAILED')
  }

  const roleIds = (data || []).map((row) => row.role_id).filter(Boolean)
  return { roleIds, missingSchema: false }
}

const queryRoleCodes = async (roleIds) => {
  if (!roleIds.length) return []

  const { data, error } = await supabase
    .from('roles')
    .select('id, code')
    .in('id', roleIds)

  if (error) {
    if (isMissingRelation(error)) return []
    throw new HttpError(500, error.message || 'Failed to query role codes', 'RBAC_QUERY_FAILED')
  }

  return (data || []).map((row) => row.code).filter(Boolean)
}

const queryPermissionIds = async (roleIds) => {
  if (!roleIds.length) return []

  const { data, error } = await supabase
    .from('role_permissions')
    .select('permission_id')
    .in('role_id', roleIds)

  if (error) {
    if (isMissingRelation(error)) return []
    throw new HttpError(500, error.message || 'Failed to query role permissions', 'RBAC_QUERY_FAILED')
  }

  return (data || []).map((row) => row.permission_id).filter(Boolean)
}

const queryPermissionCodes = async (permissionIds) => {
  if (!permissionIds.length) return []

  const { data, error } = await supabase
    .from('permissions')
    .select('id, code')
    .in('id', permissionIds)

  if (error) {
    if (isMissingRelation(error)) return []
    throw new HttpError(500, error.message || 'Failed to query permission codes', 'RBAC_QUERY_FAILED')
  }

  return (data || []).map((row) => row.code).filter(Boolean)
}

export const invalidateUserAuthzCache = async (userId) => {
  const safeUserId = String(userId || '').trim()
  if (!safeUserId) return
  await deleteSharedCacheValue(CACHE_NAMESPACE, safeUserId)
}

export const getUserAuthz = async (userId, { forceRefresh = false } = {}) => {
  const safeUserId = String(userId || '').trim()
  if (!safeUserId) {
    return { roles: ['user'], permissions: [] }
  }

  if (!forceRefresh) {
    const cached = await getSharedCacheValue(CACHE_NAMESPACE, safeUserId)
    if (cached) return cached
  }

  const { roleIds, missingSchema } = await queryUserRoleIds(safeUserId)
  if (missingSchema) {
    const fallback = { roles: ['user'], permissions: [] }
    await setSharedCacheValue(CACHE_NAMESPACE, safeUserId, fallback, CACHE_TTL_MS)
    return fallback
  }

  const roleCodes = toUniqueSorted(await queryRoleCodes(roleIds))
  const permissionIds = toUniqueSorted(await queryPermissionIds(roleIds))
  const permissionCodes = toUniqueSorted(await queryPermissionCodes(permissionIds))

  const result = {
    roles: roleCodes.length ? roleCodes : ['user'],
    permissions: permissionCodes
  }
  await setSharedCacheValue(CACHE_NAMESPACE, safeUserId, result, CACHE_TTL_MS)
  return result
}
