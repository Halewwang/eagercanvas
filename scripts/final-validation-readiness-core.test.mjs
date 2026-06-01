import assert from 'node:assert/strict'
import { test } from 'node:test'

import {
  assessFinalValidationReadiness,
  buildFinalValidationRunbook,
  buildFinalValidationEnvTemplates,
  fillGeneratedJwtSecrets,
  parseEnvContent
} from './final-validation-readiness-core.mjs'

test('parseEnvContent reads dotenv-style key values without exposing comments', () => {
  assert.deepEqual(parseEnvContent(`
    # comment
    VITE_APP_API_BASE_URL=/api/v1
    QUOTED="value with spaces"
    EMPTY=
  `), {
    VITE_APP_API_BASE_URL: '/api/v1',
    QUOTED: 'value with spaces',
    EMPTY: ''
  })
})

test('assessFinalValidationReadiness reports missing real env files and placeholders', () => {
  const result = assessFinalValidationReadiness({
    frontendEnvFiles: [],
    backendEnvFiles: [],
    frontendEnv: {
      VITE_APP_API_BASE_URL: '/api/v1',
      VITE_BYPASS_AUTH: 'true'
    },
    backendEnv: {
      SUPABASE_URL: 'https://YOUR_PROJECT.supabase.co',
      SUPABASE_SERVICE_ROLE_KEY: 'YOUR_SUPABASE_SERVICE_ROLE_KEY',
      JWT_ACCESS_SECRET: 'replace-with-strong-secret',
      JWT_REFRESH_SECRET: '',
      RESEND_API_KEY: '',
      PROVIDER_API_KEY: '',
      DASHBOARD_302_API_KEY: 'REPLACE_WITH_302_SYSTEM_PERMISSION_API_KEY'
    }
  })

  assert.equal(result.ready, false)
  assert.equal(result.summary.totalChecks, 10)
  assert.equal(result.summary.failedChecks, 9)
  assert.deepEqual(
    result.checks.filter((check) => check.status === 'fail').map((check) => check.id),
    [
      'frontend-env-file',
      'backend-env-file',
      'frontend-auth-mode',
      'supabase-url',
      'supabase-service-role',
      'jwt-access-secret',
      'jwt-refresh-secret',
      'resend-api-key',
      'provider-api-key'
    ]
  )
})

test('assessFinalValidationReadiness accepts non-placeholder real validation inputs', () => {
  const result = assessFinalValidationReadiness({
    frontendEnvFiles: ['.env.local'],
    backendEnvFiles: ['backend/.env.local'],
    frontendEnv: {
      VITE_APP_API_BASE_URL: 'http://127.0.0.1:8787/api/v1',
      VITE_BYPASS_AUTH: 'false'
    },
    backendEnv: {
      SUPABASE_URL: 'https://abc123.supabase.co',
      SUPABASE_SERVICE_ROLE_KEY: 'service-role-real-secret',
      JWT_ACCESS_SECRET: 'access-secret-with-enough-length',
      JWT_REFRESH_SECRET: 'refresh-secret-with-enough-length',
      RESEND_API_KEY: 're_123456',
      PROVIDER_API_KEY: 'sk-provider',
      DASHBOARD_302_API_KEY: 'sk-dashboard'
    }
  })

  assert.equal(result.ready, true)
  assert.equal(result.summary.failedChecks, 0)
})

test('buildFinalValidationEnvTemplates creates non-secret local env skeletons', () => {
  const result = buildFinalValidationEnvTemplates()

  assert.equal(result.frontendPath, '.env.local')
  assert.equal(result.backendPath, 'backend/.env.local')
  assert.match(result.frontendContent, /VITE_APP_API_BASE_URL=http:\/\/127\.0\.0\.1:8787\/api\/v1/)
  assert.match(result.frontendContent, /VITE_BYPASS_AUTH=false/)
  assert.match(result.backendContent, /SUPABASE_URL=https:\/\/rzfsyezidhgyikehucrh\.supabase\.co/)
  assert.match(result.backendContent, /PROVIDER_API_BASE_URL=https:\/\/api\.302ai\.cn/)
  assert.match(result.backendContent, /DASHBOARD_302_API_BASE_URL=https:\/\/api\.302ai\.cn/)
  assert.match(result.backendContent, /SUPABASE_SERVICE_ROLE_KEY=REPLACE_WITH_SUPABASE_SERVICE_ROLE_KEY/)
  assert.doesNotMatch(result.backendContent, /sb_publishable_|eyJhbGci|sk-[A-Za-z0-9]/)
})

test('fillGeneratedJwtSecrets replaces only JWT placeholders with strong generated values', () => {
  const { backendContent } = buildFinalValidationEnvTemplates()
  const filled = fillGeneratedJwtSecrets(backendContent, {
    generateSecret: (label) => `${label}-generated-secret-with-enough-length`
  })
  const parsed = parseEnvContent(filled)

  assert.equal(parsed.JWT_ACCESS_SECRET, 'access-generated-secret-with-enough-length')
  assert.equal(parsed.JWT_REFRESH_SECRET, 'refresh-generated-secret-with-enough-length')
  assert.equal(parsed.SUPABASE_SERVICE_ROLE_KEY, 'REPLACE_WITH_SUPABASE_SERVICE_ROLE_KEY')
  assert.match(filled, /PROVIDER_API_KEY=REPLACE_WITH_PROVIDER_API_KEY/)
})

test('buildFinalValidationRunbook reports readiness blockers without exposing values', () => {
  const runbook = buildFinalValidationRunbook({
    readiness: {
      ready: false,
      summary: { totalChecks: 10, failedChecks: 3 },
      checks: [
        { id: 'supabase-service-role', label: 'Supabase service role key', status: 'fail', reason: 'missing' },
        { id: 'resend-api-key', label: 'Resend API key', status: 'fail', reason: 'missing' },
        { id: 'provider-api-key', label: 'Provider and dashboard API keys', status: 'fail', reason: 'missing' }
      ]
    }
  })

  assert.equal(runbook.ready, false)
  assert.equal(runbook.summary, '7/10 ready')
  assert.deepEqual(runbook.blockers, [
    'Supabase service role key: missing',
    'Resend API key: missing',
    'Provider and dashboard API keys: missing'
  ])
  assert.doesNotMatch(JSON.stringify(runbook), /eyJhbGci|sb_publishable_|sk-[A-Za-z0-9]/)
})

test('buildFinalValidationRunbook includes final validation steps when ready', () => {
  const runbook = buildFinalValidationRunbook({
    readiness: {
      ready: true,
      summary: { totalChecks: 10, failedChecks: 0 },
      checks: []
    }
  })

  assert.equal(runbook.ready, true)
  assert.equal(runbook.summary, '10/10 ready')
  assert.deepEqual(runbook.steps.map((step) => step.id), [
    'readiness',
    'backend',
    'frontend',
    'auth',
    'cloud-project',
    'workflow',
    'usage-ledger',
    'manual-regression',
    'final-gates'
  ])
  assert.match(runbook.steps.find((step) => step.id === 'backend').command, /npm --prefix backend run dev/)
  assert.match(runbook.steps.find((step) => step.id === 'final-gates').command, /npm run check && npm run build/)
})
