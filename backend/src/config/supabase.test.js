import assert from 'node:assert/strict'
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
