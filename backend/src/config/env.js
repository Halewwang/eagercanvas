import dotenv from 'dotenv'

dotenv.config()

const requireEnv = (name, fallback = '') => {
  const value = process.env[name] ?? fallback
  if (!value && process.env.NODE_ENV === 'production') {
    throw new Error(`Missing required env var: ${name}`)
  }
  return value
}

export const env = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: Number(process.env.PORT || 8787),
  frontendOrigin: process.env.FRONTEND_ORIGIN || 'http://localhost:5173',

  supabaseUrl: requireEnv('SUPABASE_URL', 'http://localhost'),
  supabaseServiceRoleKey: requireEnv('SUPABASE_SERVICE_ROLE_KEY', 'dev-service-role-key'),

  jwtAccessSecret: requireEnv('JWT_ACCESS_SECRET', 'dev-access-secret'),
  jwtRefreshSecret: requireEnv('JWT_REFRESH_SECRET', 'dev-refresh-secret'),
  jwtAccessTtlSec: Number(process.env.JWT_ACCESS_TTL_SEC || 900),
  jwtRefreshTtlSec: Number(process.env.JWT_REFRESH_TTL_SEC || 2592000),

  resendApiKey: process.env.RESEND_API_KEY || '',
  resendFromEmail: process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev',

  providerApiBaseUrl: process.env.PROVIDER_API_BASE_URL || 'https://api.302ai.cn',
  providerApiBaseUrls: process.env.PROVIDER_API_BASE_URLS || '',
  providerApiKey: process.env.PROVIDER_API_KEY || '',
  providerTimeoutMs: Number(process.env.PROVIDER_TIMEOUT_MS || 90000),

  rateLimitPerMinute: Number(process.env.RATE_LIMIT_PER_MINUTE || 120),
  codeCooldownSec: Number(process.env.AUTH_CODE_COOLDOWN_SEC || 60)
}
