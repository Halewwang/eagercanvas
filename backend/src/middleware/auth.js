import jwt from 'jsonwebtoken'
import { env } from '../config/env.js'
import { supabase } from '../config/supabase.js'
import { getCachedAuthenticatedUser, setCachedAuthenticatedUser } from '../services/auth-user-cache.service.js'
import { getUserAuthz } from '../services/rbac.service.js'
import { HttpError } from '../utils/http.js'

const isMissingColumn = (error, columnName) => {
  const message = String(error?.message || '').toLowerCase()
  if (!message.includes('column')) return false
  if (!message.includes('does not exist')) return false
  if (!columnName) return true
  return message.includes(`users.${String(columnName).toLowerCase()}`)
}

const loadAuthenticatedUser = async (userId) => {
  const fullSelect = 'id, email, status, deleted_at'
  const fallbackSelect = 'id, email'

  const primary = await supabase
    .from('users')
    .select(fullSelect)
    .eq('id', userId)
    .maybeSingle()

  if (!primary.error) {
    return primary.data || null
  }

  if (!isMissingColumn(primary.error, 'status') && !isMissingColumn(primary.error, 'deleted_at')) {
    throw new HttpError(500, primary.error.message, 'USER_QUERY_FAILED')
  }

  const fallback = await supabase
    .from('users')
    .select(fallbackSelect)
    .eq('id', userId)
    .maybeSingle()

  if (fallback.error) {
    throw new HttpError(500, fallback.error.message, 'USER_QUERY_FAILED')
  }

  if (!fallback.data) return null

  return {
    ...fallback.data,
    status: 'active',
    deleted_at: null
  }
}

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
      user = await loadAuthenticatedUser(payload.sub)
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
