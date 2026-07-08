import assert from 'node:assert/strict'
import test from 'node:test'

import { buildApiHealthPayload } from './health.js'

test('api health payload exposes backend deployment identity without secrets', () => {
  const payload = buildApiHealthPayload({
    VERCEL_GIT_COMMIT_SHA: '61c07dbbbb5f52999230e5241c75d8b2d392b22f',
    VERCEL_DEPLOYMENT_ID: 'dpl_test',
    VERCEL_ENV: 'production',
    DASHBOARD_302_API_KEY: 'sk-secret'
  })

  assert.deepEqual(payload, {
    ok: true,
    service: 'eagercanvas-api',
    releaseCommit: '61c07dbbbb5f52999230e5241c75d8b2d392b22f',
    deploymentId: 'dpl_test',
    environment: 'production'
  })
  assert.equal(JSON.stringify(payload).includes('sk-secret'), false)
})
