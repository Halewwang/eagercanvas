import { supabase } from '../config/supabase.js'
import { HttpError } from '../utils/http.js'
import { formatServiceCredentialForAdmin } from './service-access.service.js'

export const buildAdminUserDetail = ({ user = {}, profile = null, roles = [], credentials = [] } = {}) => ({
  id: user.id,
  email: user.email,
  displayName: profile?.display_name || '',
  status: user.status || 'active',
  createdAt: user.created_at || null,
  registeredAt: profile?.registered_at || null,
  lastLoginAt: profile?.last_login_at || null,
  suspendedAt: user.suspended_at || null,
  suspendedReason: user.suspended_reason || null,
  deletedAt: user.deleted_at || null,
  roles: [...new Set(roles)].sort(),
  service: formatServiceCredentialForAdmin(credentials.find((item) => item.status === 'active') || credentials[0])
})

export const getAdminUserDetail = async (userId, { client = supabase } = {}) => {
  const safeUserId = String(userId || '').trim()
  if (!safeUserId) throw new HttpError(400, 'userId is required', 'INVALID_TARGET_USER')
  const results = await Promise.all([
    client.from('users').select('id,email,status,created_at,suspended_at,suspended_reason,deleted_at').eq('id', safeUserId).maybeSingle(),
    client.from('user_profiles').select('display_name,registered_at,last_login_at').eq('user_id', safeUserId).maybeSingle(),
    client.from('user_roles').select('role_id,roles(code)').eq('user_id', safeUserId),
    client.from('user_service_credentials').select('id,user_id,status,created_at,disabled_at,deleted_at')
      .eq('user_id', safeUserId).order('created_at', { ascending: false })
  ])
  if (results.some((result) => result.error)) throw new HttpError(500, 'Unable to load admin user detail', 'ADMIN_USER_DETAIL_QUERY_FAILED')
  const [userRes, profileRes, roleRes, credentialRes] = results
  if (!userRes.data) throw new HttpError(404, 'Target user not found', 'TARGET_USER_NOT_FOUND')
  return buildAdminUserDetail({
    user: userRes.data,
    profile: profileRes.data,
    roles: (roleRes.data || []).map((row) => row.roles?.code).filter(Boolean),
    credentials: credentialRes.data || []
  })
}
