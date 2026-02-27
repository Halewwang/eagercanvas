import { Router } from 'express'
import { asyncHandler } from '../utils/http.js'
import {
  clearRefreshCookie,
  logout,
  refreshAccessToken,
  sendCode,
  setRefreshCookie,
  verifyCode
} from '../services/auth.service.js'
import { authRequired } from '../middleware/auth.js'

export const authRouter = Router()

authRouter.post('/send-code', asyncHandler(async (req, res) => {
  const result = await sendCode({ email: req.body.email, ip: req.ip })
  res.json(result)
}))

authRouter.post('/verify-code', asyncHandler(async (req, res) => {
  const result = await verifyCode({
    email: req.body.email,
    code: req.body.code,
    ip: req.ip
  })

  setRefreshCookie(res, result.refreshToken)
  res.json({
    accessToken: result.accessToken,
    user: result.user
  })
}))

authRouter.post('/refresh', asyncHandler(async (req, res) => {
  const refreshToken = req.cookies.ec_refresh_token
  const result = await refreshAccessToken({ refreshToken })
  res.json(result)
}))

authRouter.post('/logout', asyncHandler(async (req, res) => {
  const refreshToken = req.cookies.ec_refresh_token
  await logout({ refreshToken })
  clearRefreshCookie(res)
  res.json({ ok: true })
}))

authRouter.get('/me', authRequired, asyncHandler(async (req, res) => {
  res.json({ user: req.user })
}))
