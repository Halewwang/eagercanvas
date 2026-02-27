import jwt from 'jsonwebtoken'
import { z } from 'zod'
import { supabase } from '../config/supabase.js'
import { env } from '../config/env.js'
import { randomCode, randomToken, sha256 } from '../utils/crypto.js'
import { HttpError } from '../utils/http.js'
import { sendVerificationCodeEmail } from './email.service.js'

const CODE_PURPOSES = {
  LOGIN: 'login',
  REGISTER: 'register'
}

const sendCodeSchema = z.object({
  email: z.string().email(),
  purpose: z.enum([CODE_PURPOSES.LOGIN, CODE_PURPOSES.REGISTER]).default(CODE_PURPOSES.LOGIN)
})

const verifyCodeSchema = z.object({
  email: z.string().email(),
  code: z.string().length(6),
  purpose: z.enum([CODE_PURPOSES.LOGIN, CODE_PURPOSES.REGISTER]).default(CODE_PURPOSES.LOGIN),
  displayName: z.string().min(2).max(50).optional()
})

const updateProfileSchema = z.object({
  displayName: z.string().min(2).max(50).optional(),
  avatarUrl: z.string().max(200000).nullable().optional()
})

const refreshCookieName = 'ec_refresh_token'

const signAccessToken = (user, profile) => {
  return jwt.sign(
    {
      email: user.email,
      displayName: profile?.display_name || null
    },
    env.jwtAccessSecret,
    {
      expiresIn: env.jwtAccessTtlSec,
      subject: user.id
    }
  )
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

const getUserByEmail = async (email) => {
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('email', email)
    .maybeSingle()

  if (error) throw new HttpError(500, error.message, 'USER_QUERY_FAILED')
  return data
}

const getUserById = async (userId) => {
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('id', userId)
    .single()

  if (error) throw new HttpError(500, error.message, 'USER_QUERY_FAILED')
  return data
}

const getProfileByUserId = async (userId) => {
  const { data, error } = await supabase
    .from('user_profiles')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle()

  if (error) throw new HttpError(500, error.message, 'PROFILE_QUERY_FAILED')
  return data
}

const ensureProfile = async ({ userId, email, displayName, ip }) => {
  const now = new Date().toISOString()
  const defaultName = displayName || email.split('@')[0]

  const { data, error } = await supabase
    .from('user_profiles')
    .upsert(
      {
        user_id: userId,
        display_name: defaultName,
        avatar_url: null,
        registered_ip: ip,
        registered_at: now,
        last_login_at: now,
        login_count: 1
      },
      { onConflict: 'user_id' }
    )
    .select('*')
    .single()

  if (error) throw new HttpError(500, error.message, 'PROFILE_UPSERT_FAILED')
  return data
}

const markLogin = async ({ userId }) => {
  const { data: profile, error: profileError } = await supabase
    .from('user_profiles')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle()

  if (profileError) throw new HttpError(500, profileError.message, 'PROFILE_QUERY_FAILED')

  if (!profile) return null

  const { data, error } = await supabase
    .from('user_profiles')
    .update({
      last_login_at: new Date().toISOString(),
      login_count: (profile.login_count || 0) + 1
    })
    .eq('user_id', userId)
    .select('*')
    .single()

  if (error) throw new HttpError(500, error.message, 'PROFILE_UPDATE_FAILED')
  return data
}

const buildAuthResult = async ({ user, ip, action }) => {
  const profile = (await getProfileByUserId(user.id)) || (await ensureProfile({ userId: user.id, email: user.email, ip }))

  const accessToken = signAccessToken(user, profile)
  const { refreshToken, sessionId } = await createSession(user.id)

  await supabase.from('audit_logs').insert({
    user_id: user.id,
    action,
    metadata: { sessionId, ip }
  })

  return {
    accessToken,
    refreshToken,
    user: {
      id: user.id,
      email: user.email,
      displayName: profile?.display_name || null,
      avatarUrl: profile?.avatar_url || null,
      createdAt: user.created_at,
      registeredAt: profile?.registered_at || null,
      lastLoginAt: profile?.last_login_at || null
    }
  }
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

export const sendCode = async ({ email, ip, purpose = CODE_PURPOSES.LOGIN }) => {
  const payload = sendCodeSchema.parse({ email, purpose })

  const existingUser = await getUserByEmail(payload.email)

  if (payload.purpose === CODE_PURPOSES.LOGIN && !existingUser) {
    throw new HttpError(404, 'Account does not exist. Please register first.', 'USER_NOT_FOUND')
  }

  if (payload.purpose === CODE_PURPOSES.REGISTER && existingUser) {
    const existingProfile = await getProfileByUserId(existingUser.id)
    // Legacy account without profile can continue register flow.
    if (existingProfile) {
      throw new HttpError(409, 'Email already registered. Please login.', 'USER_EXISTS')
    }
  }

  const { data: lastCode } = await supabase
    .from('auth_codes')
    .select('created_at')
    .eq('email', payload.email)
    .eq('purpose', payload.purpose)
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
    purpose: payload.purpose,
    code_hash: sha256(code),
    expires_at: expiresAt,
    created_ip: ip
  })

  if (error) throw new HttpError(500, error.message, 'AUTH_CODE_CREATE_FAILED')

  await sendVerificationCodeEmail({ email: payload.email, code, purpose: payload.purpose })

  return { ok: true, purpose: payload.purpose }
}

export const verifyCode = async ({ email, code, ip, purpose = CODE_PURPOSES.LOGIN, displayName }) => {
  const payload = verifyCodeSchema.parse({ email, code, purpose, displayName })

  const { data: authCode, error: codeError } = await supabase
    .from('auth_codes')
    .select('*')
    .eq('email', payload.email)
    .eq('purpose', payload.purpose)
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

  if (payload.purpose === CODE_PURPOSES.REGISTER) {
    const existingUser = await getUserByEmail(payload.email)
    if (existingUser) {
      const existingProfile = await getProfileByUserId(existingUser.id)
      if (existingProfile) {
        throw new HttpError(409, 'Email already registered. Please login.', 'USER_EXISTS')
      }

      await ensureProfile({
        userId: existingUser.id,
        email: existingUser.email,
        displayName: payload.displayName,
        ip
      })

      return buildAuthResult({ user: existingUser, ip, action: 'auth.register_legacy' })
    }

    const { data: createdUser, error: createUserError } = await supabase
      .from('users')
      .insert({ email: payload.email })
      .select('*')
      .single()

    if (createUserError) throw new HttpError(500, createUserError.message, 'USER_CREATE_FAILED')

    await ensureProfile({
      userId: createdUser.id,
      email: createdUser.email,
      displayName: payload.displayName,
      ip
    })

    return buildAuthResult({ user: createdUser, ip, action: 'auth.register' })
  }

  const user = await getUserByEmail(payload.email)
  if (!user) {
    throw new HttpError(404, 'Account does not exist. Please register first.', 'USER_NOT_FOUND')
  }

  await markLogin({ userId: user.id })

  return buildAuthResult({ user, ip, action: 'auth.login' })
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

  const user = await getUserById(session.user_id)
  const profile = await getProfileByUserId(user.id)

  return {
    accessToken: signAccessToken(user, profile),
    user: {
      id: user.id,
      email: user.email,
      displayName: profile?.display_name || null,
      avatarUrl: profile?.avatar_url || null,
      createdAt: user.created_at,
      registeredAt: profile?.registered_at || null,
      lastLoginAt: profile?.last_login_at || null
    }
  }
}

export const getMe = async ({ userId }) => {
  const user = await getUserById(userId)
  const profile = await getProfileByUserId(user.id)

  return {
    id: user.id,
    email: user.email,
    displayName: profile?.display_name || null,
    avatarUrl: profile?.avatar_url || null,
    createdAt: user.created_at,
    registeredAt: profile?.registered_at || null,
    lastLoginAt: profile?.last_login_at || null
  }
}

export const updateProfile = async ({ userId, input }) => {
  const payload = updateProfileSchema.parse(input)
  const patch = {}

  if (payload.displayName !== undefined) patch.display_name = payload.displayName
  if (payload.avatarUrl !== undefined) patch.avatar_url = payload.avatarUrl || null

  const user = await getUserById(userId)
  const existingProfile = await getProfileByUserId(userId)
  if (!existingProfile) {
    await ensureProfile({
      userId,
      email: user.email,
      displayName: payload.displayName,
      ip: null
    })
  }

  const { data, error } = await supabase
    .from('user_profiles')
    .update(patch)
    .eq('user_id', userId)
    .select('*')
    .single()

  if (error) throw new HttpError(500, error.message, 'PROFILE_UPDATE_FAILED')

  return {
    id: user.id,
    email: user.email,
    displayName: data?.display_name || null,
    avatarUrl: data?.avatar_url || null,
    createdAt: user.created_at,
    registeredAt: data?.registered_at || null,
    lastLoginAt: data?.last_login_at || null
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
