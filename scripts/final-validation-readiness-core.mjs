const stripQuotes = (value = '') => {
  const trimmed = String(value || '').trim()
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"'))
    || (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1)
  }
  return trimmed
}

export const parseEnvContent = (content = '') => {
  const env = {}
  String(content || '').split(/\r?\n/).forEach((line) => {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) return
    const separatorIndex = trimmed.indexOf('=')
    if (separatorIndex <= 0) return
    const key = trimmed.slice(0, separatorIndex).trim()
    env[key] = stripQuotes(trimmed.slice(separatorIndex + 1))
  })
  return env
}

const PLACEHOLDER_PATTERN = /(^$|your_|replace|placeholder|example|todo|xxx)/i

const hasRealValue = (value = '') => {
  const trimmed = String(value || '').trim()
  return trimmed.length > 0 && !PLACEHOLDER_PATTERN.test(trimmed)
}

const hasStrongSecret = (value = '') => hasRealValue(value) && String(value).trim().length >= 24

const pass = (id, label) => ({ id, label, status: 'pass' })
const fail = (id, label, reason) => ({ id, label, status: 'fail', reason })

const checkValue = ({ id, label, value, validator = hasRealValue, reason }) => (
  validator(value) ? pass(id, label) : fail(id, label, reason)
)

const JWT_ACCESS_PLACEHOLDER = 'REPLACE_WITH_AT_LEAST_24_RANDOM_CHARS'
const JWT_REFRESH_PLACEHOLDER = 'REPLACE_WITH_ANOTHER_24_RANDOM_CHARS'

export const buildFinalValidationEnvTemplates = ({
  frontendApiBaseUrl = 'http://127.0.0.1:8787/api/v1',
  supabaseUrl = 'https://rzfsyezidhgyikehucrh.supabase.co',
  providerApiBaseUrl = 'https://api.302ai.cn',
  dashboard302ApiBaseUrl = 'https://api.302ai.cn'
} = {}) => ({
  frontendPath: '.env.local',
  backendPath: 'backend/.env.local',
  frontendContent: [
    '# Local final validation env. Do not commit.',
    `VITE_APP_API_BASE_URL=${frontendApiBaseUrl}`,
    'VITE_BYPASS_AUTH=false',
    ''
  ].join('\n'),
  backendContent: [
    '# Local final validation env. Do not commit.',
    'PORT=8787',
    'NODE_ENV=development',
    'FRONTEND_ORIGIN=http://localhost:5175,http://127.0.0.1:5175,http://localhost:5173,http://127.0.0.1:5173',
    '',
    `SUPABASE_URL=${supabaseUrl}`,
    'SUPABASE_SERVICE_ROLE_KEY=REPLACE_WITH_SUPABASE_SERVICE_ROLE_KEY',
    '',
    `JWT_ACCESS_SECRET=${JWT_ACCESS_PLACEHOLDER}`,
    `JWT_REFRESH_SECRET=${JWT_REFRESH_PLACEHOLDER}`,
    'JWT_ACCESS_TTL_SEC=900',
    'JWT_REFRESH_TTL_SEC=2592000',
    '',
    'RESEND_API_KEY=REPLACE_WITH_RESEND_API_KEY',
    'RESEND_FROM_EMAIL=onboarding@resend.dev',
    '',
    `PROVIDER_API_BASE_URL=${providerApiBaseUrl}`,
    'PROVIDER_API_KEY=REPLACE_WITH_PROVIDER_API_KEY',
    `DASHBOARD_302_API_BASE_URL=${dashboard302ApiBaseUrl}`,
    'DASHBOARD_302_API_KEY=REPLACE_WITH_302_SYSTEM_PERMISSION_API_KEY',
    '',
    'RATE_LIMIT_PER_MINUTE=120',
    'AUTH_CODE_COOLDOWN_SEC=60',
    ''
  ].join('\n')
})

export const fillGeneratedJwtSecrets = (content = '', {
  generateSecret
} = {}) => {
  if (typeof generateSecret !== 'function') {
    throw new TypeError('generateSecret is required')
  }
  return String(content || '')
    .replace(`JWT_ACCESS_SECRET=${JWT_ACCESS_PLACEHOLDER}`, `JWT_ACCESS_SECRET=${generateSecret('access')}`)
    .replace(`JWT_REFRESH_SECRET=${JWT_REFRESH_PLACEHOLDER}`, `JWT_REFRESH_SECRET=${generateSecret('refresh')}`)
}

export const buildFinalValidationRunbook = ({ readiness } = {}) => {
  const totalChecks = readiness?.summary?.totalChecks ?? 0
  const failedChecks = readiness?.summary?.failedChecks ?? totalChecks
  const readyChecks = totalChecks - failedChecks
  const blockers = (readiness?.checks || [])
    .filter((check) => check.status === 'fail')
    .map((check) => `${check.label}: ${check.reason || 'not ready'}`)

  const steps = [
    {
      id: 'readiness',
      title: 'Readiness gate',
      command: 'npm run check:validation-readiness',
      evidence: 'Command exits 0 and reports 10/10 ready.'
    },
    {
      id: 'backend',
      title: 'Start backend API',
      command: 'npm --prefix backend run dev',
      evidence: 'API listens on port 8787 with real Supabase, Resend, and provider env.'
    },
    {
      id: 'frontend',
      title: 'Start frontend',
      command: 'npm run dev',
      evidence: 'Frontend opens with VITE_BYPASS_AUTH=false and API base pointing to the backend.'
    },
    {
      id: 'auth',
      title: 'Verify auth email/code flow',
      command: 'Manual browser flow',
      evidence: 'Registration or login code is delivered through Resend and /auth/me returns the session user.'
    },
    {
      id: 'cloud-project',
      title: 'Verify Supabase-backed project persistence',
      command: 'Manual browser flow',
      evidence: 'Create a cloud project, save nodes/edges, reload, and confirm the same project state returns.'
    },
    {
      id: 'workflow',
      title: 'Run real provider workflow',
      command: 'Manual browser flow',
      evidence: 'Text/Image/Video workflow creates a real run, transitions status, and returns provider output.'
    },
    {
      id: 'usage-ledger',
      title: 'Verify usage and billing reconciliation',
      command: 'Manual admin/usage flow',
      evidence: 'usage_events records the run and provider_billing_records or dashboard reconciliation data is visible.'
    },
    {
      id: 'manual-regression',
      title: 'Run UI regression checklist',
      command: 'Follow docs/OPTIMIZATION_PRD.md section 4.3',
      evidence: 'All checklist rows have pass/fail notes with browser console free of new warn/error logs.'
    },
    {
      id: 'final-gates',
      title: 'Run final local gates',
      command: 'npm run check && npm run build && git diff --check',
      evidence: 'All commands pass after real-chain validation.'
    }
  ]

  return {
    ready: Boolean(readiness?.ready),
    summary: `${readyChecks}/${totalChecks} ready`,
    blockers,
    steps
  }
}

export const assessFinalValidationReadiness = ({
  frontendEnvFiles = [],
  backendEnvFiles = [],
  frontendEnv = {},
  backendEnv = {}
} = {}) => {
  const checks = [
    frontendEnvFiles.length > 0
      ? pass('frontend-env-file', 'Frontend env file')
      : fail('frontend-env-file', 'Frontend env file', 'Missing .env or .env.local for real validation.'),
    backendEnvFiles.length > 0
      ? pass('backend-env-file', 'Backend env file')
      : fail('backend-env-file', 'Backend env file', 'Missing backend/.env or backend/.env.local.'),
    checkValue({
      id: 'frontend-api-base',
      label: 'Frontend API base URL',
      value: frontendEnv.VITE_APP_API_BASE_URL,
      reason: 'VITE_APP_API_BASE_URL is missing.'
    }),
    String(frontendEnv.VITE_BYPASS_AUTH || '').trim().toLowerCase() === 'true'
      ? fail('frontend-auth-mode', 'Frontend auth mode', 'VITE_BYPASS_AUTH must be false for real auth validation.')
      : pass('frontend-auth-mode', 'Frontend auth mode'),
    checkValue({
      id: 'supabase-url',
      label: 'Supabase URL',
      value: backendEnv.SUPABASE_URL,
      reason: 'SUPABASE_URL is missing or still a placeholder.'
    }),
    checkValue({
      id: 'supabase-service-role',
      label: 'Supabase service role key',
      value: backendEnv.SUPABASE_SERVICE_ROLE_KEY,
      reason: 'SUPABASE_SERVICE_ROLE_KEY is missing or still a placeholder.'
    }),
    checkValue({
      id: 'jwt-access-secret',
      label: 'JWT access secret',
      value: backendEnv.JWT_ACCESS_SECRET,
      validator: hasStrongSecret,
      reason: 'JWT_ACCESS_SECRET is missing, placeholder, or too short.'
    }),
    checkValue({
      id: 'jwt-refresh-secret',
      label: 'JWT refresh secret',
      value: backendEnv.JWT_REFRESH_SECRET,
      validator: hasStrongSecret,
      reason: 'JWT_REFRESH_SECRET is missing, placeholder, or too short.'
    }),
    checkValue({
      id: 'resend-api-key',
      label: 'Resend API key',
      value: backendEnv.RESEND_API_KEY,
      reason: 'RESEND_API_KEY is required for email/code auth validation.'
    }),
    hasRealValue(backendEnv.PROVIDER_API_KEY) && hasRealValue(backendEnv.DASHBOARD_302_API_KEY)
      ? pass('provider-api-key', 'Provider and dashboard API keys')
      : fail('provider-api-key', 'Provider and dashboard API keys', 'PROVIDER_API_KEY and DASHBOARD_302_API_KEY are required for provider workflow and usage validation.')
  ]

  const failedChecks = checks.filter((check) => check.status === 'fail').length
  return {
    ready: failedChecks === 0,
    summary: {
      totalChecks: checks.length,
      failedChecks
    },
    checks
  }
}
