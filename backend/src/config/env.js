import dotenv from 'dotenv'
import process from 'node:process'

dotenv.config()

const requireEnv = (name, fallback = '') => {
  const value = process.env[name] ?? fallback
  if (!value && process.env.NODE_ENV === 'production') {
    throw new Error(`Missing required env var: ${name}`)
  }
  return value
}

const parseOrigins = (value = '') => {
  return String(value)
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
}

export const env = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: Number(process.env.PORT || 8787),
  frontendOrigin: process.env.FRONTEND_ORIGIN || 'http://localhost:5173',
  frontendOrigins: parseOrigins(process.env.FRONTEND_ORIGIN || 'http://localhost:5173'),

  supabaseUrl: requireEnv('SUPABASE_URL', 'http://localhost'),
  supabaseServiceRoleKey: requireEnv('SUPABASE_SERVICE_ROLE_KEY', 'dev-service-role-key'),
  supabaseTimeoutMs: Number(process.env.SUPABASE_TIMEOUT_MS || 8000),

  jwtAccessSecret: requireEnv('JWT_ACCESS_SECRET', 'dev-access-secret'),
  jwtRefreshSecret: requireEnv('JWT_REFRESH_SECRET', 'dev-refresh-secret'),
  jwtAccessTtlSec: Number(process.env.JWT_ACCESS_TTL_SEC || 900),
  jwtRefreshTtlSec: Number(process.env.JWT_REFRESH_TTL_SEC || 2592000),

  resendApiKey: process.env.RESEND_API_KEY || '',
  resendFromEmail: process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev',

  providerApiBaseUrl: process.env.PROVIDER_API_BASE_URL || 'https://api.302ai.cn',
  providerApiBaseUrls: process.env.PROVIDER_API_BASE_URLS || '',
  providerApiKey: process.env.PROVIDER_API_KEY || '',
  providerTimeoutMs: Number(process.env.PROVIDER_TIMEOUT_MS || 180000),

  dashboard302ApiBaseUrl: process.env.DASHBOARD_302_API_BASE_URL || '',
  dashboard302ApiKey: process.env.DASHBOARD_302_API_KEY || '',
  dashboard302TimeoutMs: Number(process.env.DASHBOARD_302_TIMEOUT_MS || 30000),

  adminDashboardUsername: process.env.ADMIN_DASHBOARD_USERNAME || '',
  adminDashboardPassword: process.env.ADMIN_DASHBOARD_PASSWORD || '',
  adminDashboardJwtSecret: process.env.ADMIN_DASHBOARD_JWT_SECRET || '',
  adminDashboardTokenTtlSec: Number(process.env.ADMIN_DASHBOARD_TOKEN_TTL_SEC || 86400),

  rateLimitPerMinute: Number(process.env.RATE_LIMIT_PER_MINUTE || 120),
  codeCooldownSec: Number(process.env.AUTH_CODE_COOLDOWN_SEC || 60)
}
