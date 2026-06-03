import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

import { createTimeoutFetch } from '../utils/timeout-fetch.js'

test('Supabase fetch aborts when the upstream request hangs', async () => {
  const fetchWithTimeout = createTimeoutFetch(async (_url, init) => new Promise((_resolve, reject) => {
    init.signal.addEventListener('abort', () => reject(init.signal.reason))
  }), 5)

  await assert.rejects(
    () => fetchWithTimeout('https://example.supabase.co/rest/v1/users'),
    (error) => {
      assert.equal(error.name, 'AbortError')
      assert.match(error.message, /timed out/i)
      return true
    }
  )
})

test('Supabase storage client uses a separate storage timeout budget', () => {
  const supabaseSource = readFileSync(new URL('./supabase.js', import.meta.url), 'utf8')
  const envSource = readFileSync(new URL('./env.js', import.meta.url), 'utf8')

  assert.match(envSource, /supabaseStorageTimeoutMs:\s*Number\(process\.env\.SUPABASE_STORAGE_TIMEOUT_MS/)
  assert.match(supabaseSource, /const createServiceRoleClient = \(timeoutMs, label\) => createClient/)
  assert.match(supabaseSource, /export const supabaseStorage = createServiceRoleClient/)
  assert.match(supabaseSource, /env\.supabaseStorageTimeoutMs/)
})
