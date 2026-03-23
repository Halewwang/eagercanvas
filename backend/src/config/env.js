import dotenv from 'dotenv'

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

  dashboard302ApiBaseUrl: process.env.DASHBOARD_302_API_BASE_URL || process.env.PROVIDER_API_BASE_URL || 'https://api.302.ai',
  dashboard302ApiKey: process.env.DASHBOARD_302_API_KEY || '',
  dashboard302TimeoutMs: Number(process.env.DASHBOARD_302_TIMEOUT_MS || 30000),

  adminDashboardUsername: process.env.ADMIN_DASHBOARD_USERNAME || '',
  adminDashboardPassword: process.env.ADMIN_DASHBOARD_PASSWORD || '',
  adminDashboardJwtSecret: process.env.ADMIN_DASHBOARD_JWT_SECRET || '',
  adminDashboardTokenTtlSec: Number(process.env.ADMIN_DASHBOARD_TOKEN_TTL_SEC || 86400),

  cacheBackend: String(process.env.CACHE_BACKEND || 'memory').trim() || 'memory',
  rateLimitStore: String(process.env.RATE_LIMIT_STORE || 'memory').trim() || 'memory',
  redisUrl: process.env.REDIS_URL || '',
  runQueueMode: String(process.env.RUN_QUEUE_MODE || 'inline').trim() || 'inline',
  runQueueConcurrency: Number(process.env.RUN_QUEUE_CONCURRENCY || 4),
  runWorkerPollMs: Number(process.env.RUN_WORKER_POLL_MS || 2000),
  runWorkerBatchSize: Number(process.env.RUN_WORKER_BATCH_SIZE || 2),
  runRecoveryEnabled: String(process.env.RUN_RECOVERY_ENABLED || 'true') !== 'false',
  runClaimTimeoutMs: Number(process.env.RUN_CLAIM_TIMEOUT_MS || 15 * 60 * 1000),

  rateLimitPerMinute: Number(process.env.RATE_LIMIT_PER_MINUTE || 120),
  rateLimitAuthPerMinute: Number(process.env.RATE_LIMIT_AUTH_PER_MINUTE || 30),
  rateLimitGeneratePerMinute: Number(process.env.RATE_LIMIT_GENERATE_PER_MINUTE || 40),
  rateLimitPollingPerMinute: Number(process.env.RATE_LIMIT_POLLING_PER_MINUTE || 240),
  requestLogEnabled: String(process.env.REQUEST_LOG_ENABLED || 'true') !== 'false',
  requestLogSlowMs: Number(process.env.REQUEST_LOG_SLOW_MS || 800),
  codeCooldownSec: Number(process.env.AUTH_CODE_COOLDOWN_SEC || 60)
}
