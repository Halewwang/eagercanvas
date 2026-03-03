import jwt from 'jsonwebtoken'
import { env } from '../config/env.js'
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
    const authz = await getUserAuthz(payload.sub)
    req.user = {
      id: payload.sub,
      email: payload.email,
      roles: authz.roles,
      permissions: authz.permissions
    }
    return next()
  } catch (error) {
    return next(error)
  }
}
