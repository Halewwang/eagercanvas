import { Router } from 'express'
import { asyncHandler, sendJson } from '../utils/http.js'
import {
  clearRefreshCookie,
  getMe,
  logout,
  refreshAccessToken,
  sendCode,
  setRefreshCookie,
  updateProfile,
  verifyCode
} from '../services/auth.service.js'
import { authRequired } from '../middleware/auth.js'

export const authRouter = Router()

authRouter.post('/send-code', asyncHandler(async (req, res) => {
  const result = await sendCode({ email: req.body.email, ip: req.ip, purpose: 'login' })
  sendJson(res, result)
}))

authRouter.post('/verify-code', asyncHandler(async (req, res) => {
  const result = await verifyCode({
    email: req.body.email,
    code: req.body.code,
    ip: req.ip,
    purpose: 'login'
  })

  setRefreshCookie(res, result.refreshToken)
  sendJson(res, {
    accessToken: result.accessToken,
    user: result.user
  })
}))

authRouter.post('/register/send-code', asyncHandler(async (req, res) => {
  const result = await sendCode({ email: req.body.email, ip: req.ip, purpose: 'register' })
  sendJson(res, result)
}))

authRouter.post('/register/verify-code', asyncHandler(async (req, res) => {
  const result = await verifyCode({
    email: req.body.email,
    code: req.body.code,
    ip: req.ip,
    purpose: 'register',
    displayName: req.body.displayName
  })

  setRefreshCookie(res, result.refreshToken)
  sendJson(res, {
    accessToken: result.accessToken,
    user: result.user
  })
}))

authRouter.post('/refresh', asyncHandler(async (req, res) => {
  const refreshToken = req.cookies.ec_refresh_token
  const result = await refreshAccessToken({ refreshToken })
  sendJson(res, result)
}))

authRouter.post('/logout', asyncHandler(async (req, res) => {
  const refreshToken = req.cookies.ec_refresh_token
  await logout({ refreshToken })
  clearRefreshCookie(res)
  sendJson(res, { ok: true })
}))

authRouter.get('/me', authRequired, asyncHandler(async (req, res) => {
  const user = await getMe({ userId: req.user.id })
  sendJson(res, { user })
}))

authRouter.patch('/profile', authRequired, asyncHandler(async (req, res) => {
  const user = await updateProfile({ userId: req.user.id, input: req.body })
  sendJson(res, { user })
}))
