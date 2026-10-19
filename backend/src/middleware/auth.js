import jwt from 'jsonwebtoken'
import { timingSafeEqual } from 'node:crypto'
import { env } from '../config/env.js'
import { supabase } from '../config/supabase.js'
import { getUserAuthz } from '../services/rbac.service.js'
import { HttpError } from '../utils/http.js'

export const LOCAL_PREVIEW_ADMIN_PERMISSIONS = Object.freeze([
  'admin.user.read',
  'admin.user.role.update',
  'admin.user.status.update',
  'admin.user.delete',
  'admin.user.restore',
  'admin.audit.read',
  'admin.service_access.activate',
  'admin.service_access.disable',
])

const matchesLocalPreviewAccessToken = (token = '') => {
  if (env.nodeEnv === 'production' || !env.localPreviewAuthEnabled) return false
  const presented = Buffer.from(String(token || ''))
  const configured = Buffer.from(String(env.localPreviewAccessToken || '').trim())
  if (!presented.length || !configured.length || presented.length !== configured.length) return false
  return timingSafeEqual(presented, configured)
}

export const authRequired = async (req, _res, next) => {
  const authHeader = req.headers.authorization || ''
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : ''

  if (!token) {
    return next(new HttpError(401, 'Missing access token', 'UNAUTHORIZED'))
  }

  if (matchesLocalPreviewAccessToken(token)) {
    req.user = {
      id: 'dev-bypass-user',
      email: 'preview@local.dev',
      roles: ['super_admin', 'ops'],
      permissions: [...LOCAL_PREVIEW_ADMIN_PERMISSIONS]
    }
    return next()
  }

  let payload
  try {
    payload = jwt.verify(token, env.jwtAccessSecret)
  } catch {
    return next(new HttpError(401, 'Invalid or expired access token', 'UNAUTHORIZED'))
  }

  try {
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('*')
      .eq('id', payload.sub)
      .maybeSingle()
    if (userError) {
      return next(new HttpError(500, userError.message, 'USER_QUERY_FAILED'))
    }
    if (!user || user.deleted_at || user.status === 'deleted') {
      return next(new HttpError(403, 'Account is deleted', 'ACCOUNT_DELETED'))
    }
    if (user.status === 'archiving') {
      return next(new HttpError(403, 'Account is being archived', 'ACCOUNT_ARCHIVING'))
    }
    if (user.status === 'suspending') {
      return next(new HttpError(403, 'Account suspension is in progress', 'ACCOUNT_SUSPENDING'))
    }
    if (user.status === 'suspended') {
      return next(new HttpError(403, 'Account is suspended', 'ACCOUNT_SUSPENDED'))
    }

    const authz = await getUserAuthz(payload.sub)
    req.user = {
      id: user.id,
      email: user.email || payload.email,
      roles: authz.roles,
      permissions: authz.permissions
    }
    return next()
  } catch (error) {
    return next(error)
  }
}
