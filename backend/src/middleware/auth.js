import jwt from 'jsonwebtoken'
import { env } from '../config/env.js'
import { HttpError } from '../utils/http.js'

export const authRequired = (req, _res, next) => {
  const authHeader = req.headers.authorization || ''
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : ''

  if (!token) {
    return next(new HttpError(401, 'Missing access token', 'UNAUTHORIZED'))
  }

  try {
    const payload = jwt.verify(token, env.jwtAccessSecret)
    req.user = {
      id: payload.sub,
      email: payload.email
    }
    next()
  } catch {
    next(new HttpError(401, 'Invalid or expired access token', 'UNAUTHORIZED'))
  }
}
