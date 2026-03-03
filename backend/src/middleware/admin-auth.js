import jwt from 'jsonwebtoken'
import { env } from '../config/env.js'
import { HttpError } from '../utils/http.js'

const parseAdminToken = (req) => {
  const direct = String(req.headers['x-admin-token'] || '').trim()
  if (direct) return direct

  const auth = String(req.headers.authorization || '').trim()
  if (!auth.toLowerCase().startsWith('bearer ')) return ''
  return auth.slice(7).trim()
}

const getAdminSecret = () => {
  return String(env.adminDashboardJwtSecret || env.jwtAccessSecret || '').trim()
}

export const issueAdminToken = ({ username }) => {
  const secret = getAdminSecret()
  if (!secret) {
    throw new HttpError(500, 'ADMIN_DASHBOARD_JWT_SECRET is not configured', 'ADMIN_NOT_CONFIGURED')
  }

  return jwt.sign(
    { role: 'usage_admin', username: String(username || 'admin') },
    secret,
    {
      subject: 'usage-admin',
      expiresIn: Number(env.adminDashboardTokenTtlSec || 86400)
    }
  )
}

export const adminUsageRequired = (req, _res, next) => {
  try {
    const token = parseAdminToken(req)
    if (!token) {
      throw new HttpError(401, 'Admin token is required', 'ADMIN_UNAUTHORIZED')
    }

    const secret = getAdminSecret()
    if (!secret) {
      throw new HttpError(500, 'ADMIN_DASHBOARD_JWT_SECRET is not configured', 'ADMIN_NOT_CONFIGURED')
    }

    const payload = jwt.verify(token, secret)
    if (!payload || payload.role !== 'usage_admin') {
      throw new HttpError(403, 'Invalid admin token', 'ADMIN_FORBIDDEN')
    }

    req.admin = {
      username: payload.username || 'admin'
    }
    return next()
  } catch (error) {
    return next(error)
  }
}
