import process from 'node:process'
import { loadBackendEnvFiles } from './load-env-files.js'

loadBackendEnvFiles()

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

const parseBoolean = (value, fallback = false) => {
  const normalized = String(value ?? '').trim().toLowerCase()
  if (!normalized) return fallback
  return ['1', 'true', 'yes', 'on'].includes(normalized)
}

export const env = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: Number(process.env.PORT || 8787),
  frontendOrigin: process.env.FRONTEND_ORIGIN || 'http://localhost:5173',
  frontendOrigins: parseOrigins(process.env.FRONTEND_ORIGIN || 'http://localhost:5173'),

  supabaseUrl: requireEnv('SUPABASE_URL', 'http://localhost'),
  supabaseServiceRoleKey: requireEnv('SUPABASE_SERVICE_ROLE_KEY', 'dev-service-role-key'),
  supabaseTimeoutMs: Number(process.env.SUPABASE_TIMEOUT_MS || 8000),
  supabaseStorageTimeoutMs: Number(process.env.SUPABASE_STORAGE_TIMEOUT_MS || 120000),
  remoteAssetFetchTimeoutMs: Number(process.env.REMOTE_ASSET_FETCH_TIMEOUT_MS || 30000),

  jwtAccessSecret: requireEnv('JWT_ACCESS_SECRET', 'dev-access-secret'),
  jwtRefreshSecret: requireEnv('JWT_REFRESH_SECRET', 'dev-refresh-secret'),
  jwtAccessTtlSec: Number(process.env.JWT_ACCESS_TTL_SEC || 900),
  jwtRefreshTtlSec: Number(process.env.JWT_REFRESH_TTL_SEC || 2592000),

  localPreviewAuthEnabled: parseBoolean(process.env.LOCAL_PREVIEW_AUTH_ENABLED, false),
  localPreviewAccessToken: process.env.LOCAL_PREVIEW_ACCESS_TOKEN || '',

  resendApiKey: process.env.RESEND_API_KEY || '',
  resendFromEmail: process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev',
  resendAuthCodeTemplateId: process.env.RESEND_AUTH_CODE_TEMPLATE_ID || '',

  openaiApiBaseUrl: process.env.OPENAI_API_BASE_URL || 'https://api.enbrand.co/v1',
  openaiApiKey: process.env.OPENAI_API_KEY || '',
  openaiTimeoutMs: Number(process.env.OPENAI_TIMEOUT_MS || 1800000),

  // Video requests use the shared server credential after service authorization.
  providerApiBaseUrl: process.env.PROVIDER_API_BASE_URL || 'https://api.302ai.cn',
  providerApiBaseUrls: process.env.PROVIDER_API_BASE_URLS || '',
  providerApiKey: process.env.PROVIDER_API_KEY || '',
  providerTimeoutMs: Number(process.env.PROVIDER_TIMEOUT_MS || 180000),


  rateLimitPerMinute: Number(process.env.RATE_LIMIT_PER_MINUTE || 120),
  codeCooldownSec: Number(process.env.AUTH_CODE_COOLDOWN_SEC || 60)
}
