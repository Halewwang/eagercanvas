import { supabase } from '../config/supabase.js'
import { HttpError } from '../utils/http.js'

const isMissingRelation = (error) => {
  const msg = String(error?.message || '').toLowerCase()
  return msg.includes('relation') && msg.includes('does not exist')
}

export const createAdminLog = async ({ operatorUserId, targetUserId = null, action, metadata = {} }) => {
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
