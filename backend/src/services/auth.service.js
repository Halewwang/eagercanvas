import jwt from 'jsonwebtoken'
import { z } from 'zod'
import { supabase } from '../config/supabase.js'
import { env } from '../config/env.js'
import { randomCode, randomToken, sha256 } from '../utils/crypto.js'
import { HttpError } from '../utils/http.js'
import { sendLoginCodeEmail } from './email.service.js'

const sendCodeSchema = z.object({
  email: z.string().email()
})

const verifyCodeSchema = z.object({
  email: z.string().email(),
  code: z.string().length(6)
})

const refreshCookieName = 'ec_refresh_token'

const signAccessToken = (user) => {
  return jwt.sign({ email: user.email }, env.jwtAccessSecret, {
    expiresIn: env.jwtAccessTtlSec,
    subject: user.id
  })
}

const createSession = async (userId) => {
  const refreshToken = randomToken()
  const refreshTokenHash = sha256(refreshToken)
  const expiresAt = new Date(Date.now() + env.jwtRefreshTtlSec * 1000).toISOString()

  const { data, error } = await supabase
    .from('sessions')
    .insert({ user_id: userId, refresh_token_hash: refreshTokenHash, expires_at: expiresAt })
    .select('id')
    .single()

  if (error) throw new HttpError(500, error.message, 'SESSION_CREATE_FAILED')

  return { refreshToken, sessionId: data.id }
}

export const setRefreshCookie = (res, token) => {
  res.cookie(refreshCookieName, token, {
    httpOnly: true,
    secure: env.nodeEnv === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: env.jwtRefreshTtlSec * 1000
  })
}

export const clearRefreshCookie = (res) => {
  res.clearCookie(refreshCookieName, {
    httpOnly: true,
    secure: env.nodeEnv === 'production',
    sameSite: 'lax',
    path: '/'
  })
}

export const sendCode = async ({ email, ip }) => {
  const payload = sendCodeSchema.parse({ email })

  const { data: lastCode } = await supabase
    .from('auth_codes')
    .select('created_at')
    .eq('email', payload.email)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (lastCode?.created_at) {
    const elapsed = Date.now() - new Date(lastCode.created_at).getTime()
    if (elapsed < env.codeCooldownSec * 1000) {
      throw new HttpError(429, 'Please wait before requesting another code', 'CODE_COOLDOWN')
    }
  }

  const code = randomCode(6)
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString()

  const { error } = await supabase.from('auth_codes').insert({
    email: payload.email,
    code_hash: sha256(code),
    expires_at: expiresAt,
    created_ip: ip
  })

  if (error) throw new HttpError(500, error.message, 'AUTH_CODE_CREATE_FAILED')

  await sendLoginCodeEmail({ email: payload.email, code })

  return { ok: true }
}

export const verifyCode = async ({ email, code, ip }) => {
  const payload = verifyCodeSchema.parse({ email, code })

  const { data: authCode, error: codeError } = await supabase
    .from('auth_codes')
    .select('*')
    .eq('email', payload.email)
    .eq('used', false)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (codeError) throw new HttpError(500, codeError.message, 'AUTH_CODE_QUERY_FAILED')
  if (!authCode) throw new HttpError(400, 'Verification code not found', 'CODE_NOT_FOUND')
  if (new Date(authCode.expires_at).getTime() < Date.now()) {
    throw new HttpError(400, 'Verification code expired', 'CODE_EXPIRED')
  }

  if (sha256(payload.code) !== authCode.code_hash) {
    throw new HttpError(400, 'Verification code is invalid', 'CODE_INVALID')
  }

  const { error: consumeError } = await supabase
    .from('auth_codes')
    .update({ used: true, used_at: new Date().toISOString(), used_ip: ip })
    .eq('id', authCode.id)

  if (consumeError) throw new HttpError(500, consumeError.message, 'CODE_CONSUME_FAILED')

  const { data: user, error: userError } = await supabase
    .from('users')
    .upsert({ email: payload.email }, { onConflict: 'email' })
    .select('*')
    .single()

  if (userError) throw new HttpError(500, userError.message, 'USER_UPSERT_FAILED')

  const accessToken = signAccessToken(user)
  const { refreshToken, sessionId } = await createSession(user.id)

  const { error: auditError } = await supabase.from('audit_logs').insert({
    user_id: user.id,
    action: 'auth.verify_code',
    metadata: { sessionId, ip }
  })

  if (auditError) {
    console.warn('[audit] write failed', auditError.message)
  }

  return {
    accessToken,
    refreshToken,
    user: {
      id: user.id,
      email: user.email,
      createdAt: user.created_at
    }
  }
}

export const refreshAccessToken = async ({ refreshToken }) => {
  if (!refreshToken) {
    throw new HttpError(401, 'Missing refresh token', 'UNAUTHORIZED')
  }

  const tokenHash = sha256(refreshToken)
  const { data: session, error } = await supabase
    .from('sessions')
    .select('*')
    .eq('refresh_token_hash', tokenHash)
    .eq('revoked', false)
    .maybeSingle()

  if (error) throw new HttpError(500, error.message, 'SESSION_QUERY_FAILED')
  if (!session) throw new HttpError(401, 'Session not found', 'UNAUTHORIZED')
  if (new Date(session.expires_at).getTime() < Date.now()) {
    throw new HttpError(401, 'Session expired', 'UNAUTHORIZED')
  }

  const { data: user, error: userError } = await supabase
    .from('users')
    .select('*')
    .eq('id', session.user_id)
    .single()

  if (userError) throw new HttpError(500, userError.message, 'USER_QUERY_FAILED')

  return {
    accessToken: signAccessToken(user),
    user: {
      id: user.id,
      email: user.email,
      createdAt: user.created_at
    }
  }
}

export const logout = async ({ refreshToken }) => {
  if (!refreshToken) return { ok: true }

  const tokenHash = sha256(refreshToken)
  const { error } = await supabase
    .from('sessions')
    .update({ revoked: true, revoked_at: new Date().toISOString() })
    .eq('refresh_token_hash', tokenHash)

  if (error) {
    console.warn('[auth] logout revoke failed', error.message)
  }

  return { ok: true }
}
