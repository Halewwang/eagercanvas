import jwt from 'jsonwebtoken'
import { env } from '../config/env.js'
import { supabase } from '../config/supabase.js'
import { getCachedAuthenticatedUser, setCachedAuthenticatedUser } from '../services/auth-user-cache.service.js'
import { getUserAuthz } from '../services/rbac.service.js'
import { HttpError } from '../utils/http.js'

export const authRequired = async (req, _res, next) => {
  const authHeader = req.headers.authorization || ''
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : ''

  if (!token) {
    return next(new HttpError(401, 'Missing access token', 'UNAUTHORIZED'))
  }

  let payload
  try {
    payload = jwt.verify(token, env.jwtAccessSecret)
  } catch {
    return next(new HttpError(401, 'Invalid or expired access token', 'UNAUTHORIZED'))
  }

  try {
    let user = await getCachedAuthenticatedUser(payload.sub)

    if (!user) {
      const { data, error: userError } = await supabase
        .from('users')
        .select('id, email, status, deleted_at')
        .eq('id', payload.sub)
        .maybeSingle()

      if (userError) {
        return next(new HttpError(500, userError.message, 'USER_QUERY_FAILED'))
      }

      user = data || null
      if (user) {
        await setCachedAuthenticatedUser(payload.sub, user)
      }
    }

    if (!user || user.deleted_at || user.status === 'deleted') {
      return next(new HttpError(403, 'Account is deleted', 'ACCOUNT_DELETED'))
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
