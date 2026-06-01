import assert from 'node:assert/strict'
import path from 'node:path'
import { test } from 'node:test'

import { loadBackendEnvFiles } from './load-env-files.js'

test('loadBackendEnvFiles loads local overrides before default env without overriding process env', () => {
  const calls = []

  loadBackendEnvFiles({
    cwd: '/repo/backend',
    config: (options) => {
      calls.push(options)
      return { parsed: {} }
    }
  })

  assert.deepEqual(calls, [
    {
      path: path.join('/repo/backend', '.env.local'),
      override: false
    },
    {
      path: path.join('/repo/backend', '.env'),
      override: false
    }
  ])
})
