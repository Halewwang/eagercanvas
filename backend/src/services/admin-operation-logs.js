import { supabase } from '../config/supabase.js'
import { HttpError } from '../utils/http.js'
import { sanitizeAdminAuditMetadata } from './admin-audit-sanitizer.js'

const isMissingRelation = (error) => {
  const msg = String(error?.message || '').toLowerCase()
  return msg.includes('relation') && msg.includes('does not exist')
}

const normalizePagination = ({ page = 1, limit = 20 } = {}) => {
  const rawPage = Number(page)
  const rawLimit = Number(limit)
  const pageInteger = Math.trunc(rawPage)
  const limitInteger = Math.trunc(rawLimit)
  if (
    !Number.isFinite(rawPage) ||
    !Number.isFinite(rawLimit) ||
    !Number.isSafeInteger(pageInteger) ||
    !Number.isSafeInteger(limitInteger)
  ) throw new HttpError(400, 'Invalid pagination', 'INVALID_PAGINATION')
  const safePage = Math.max(1, pageInteger)
  const safeLimit = Math.max(1, Math.min(100, limitInteger))
  const from = (safePage - 1) * safeLimit
  const to = from + safeLimit - 1
  if (!Number.isSafeInteger(from) || !Number.isSafeInteger(to)) {
    throw new HttpError(400, 'Invalid pagination', 'INVALID_PAGINATION')
  }
  return { page: safePage, limit: safeLimit, from, to }
}

export const createAdminLog = async ({ operatorUserId, targetUserId = null, action, metadata = {} }) => {
  const safeMetadata = sanitizeAdminAuditMetadata(metadata)
  const payload = {
    operator_user_id: operatorUserId || null,
    target_user_id: targetUserId || null,
    action: String(action || 'admin.unknown'),
    metadata: safeMetadata
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

export const listAdminOperationLogs = async ({ page = 1, limit = 20, targetUserId = '', requireTarget = false } = {}) => {
  const safeTargetUserId = String(targetUserId || '').trim()
  if (requireTarget && !safeTargetUserId) {
    throw new HttpError(400, 'Target user is required', 'INVALID_TARGET_USER')
  }
  const pagination = normalizePagination({ page, limit })
  let query = supabase
    .from('admin_operation_logs')
    .select('id, operator_user_id, target_user_id, action, metadata, created_at', { count: 'exact' })
  if (safeTargetUserId) query = query.eq('target_user_id', safeTargetUserId)
  const { data, error, count } = await query
    .order('created_at', { ascending: false })
    .range(pagination.from, pagination.to)

  if (error) {
    if (isMissingRelation(error)) {
      throw new HttpError(500, 'admin_operation_logs table is missing. Run migration 004_rbac_admin_system.sql first.', 'ADMIN_AUDIT_TABLE_MISSING')
    }
    throw new HttpError(500, 'Unable to load admin operation logs', 'ADMIN_AUDIT_QUERY_FAILED')
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
    if (usersError) {
      throw new HttpError(500, 'Unable to load admin audit user identities', 'ADMIN_AUDIT_USER_QUERY_FAILED')
    }
    userEmailMap = new Map((users || []).map((item) => [item.id, item.email]))
  }

  return {
    items: (data || []).map((row) => ({
      id: row.id,
      action: row.action,
      metadata: sanitizeAdminAuditMetadata(row.metadata || {}),
      createdAt: row.created_at,
      operator: row.operator_user_id
        ? { id: row.operator_user_id, email: userEmailMap.get(row.operator_user_id) || '' }
        : null,
      target: row.target_user_id
        ? { id: row.target_user_id, email: userEmailMap.get(row.target_user_id) || '' }
        : null
    })),
    pagination: {
      page: pagination.page,
      limit: pagination.limit,
      total: Number(count || 0)
    }
  }
}
