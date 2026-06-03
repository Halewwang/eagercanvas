import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import test from 'node:test'

import { uploadRemoteFile } from './upload.service.js'

const uploadServicePath = fileURLToPath(new URL('./upload.service.js', import.meta.url))

test('upload service uses the shared timeout-bound Supabase client', () => {
  const source = readFileSync(uploadServicePath, 'utf8')

  assert.doesNotMatch(source, /createClient\(env\.supabaseUrl,\s*env\.supabaseServiceRoleKey\)/)
  assert.match(source, /from '\.\.\/config\/supabase\.js'/)
})

test('uploadRemoteFile aborts stalled remote asset fetches', async () => {
  const originalFetch = global.fetch
  const originalSetTimeout = global.setTimeout
  const originalClearTimeout = global.clearTimeout
  const timeoutDelays = []

  global.fetch = async (_url, init = {}) => new Promise((_resolve, reject) => {
    init.signal?.addEventListener?.('abort', () => {
      const error = init.signal.reason || new Error('Remote asset request aborted')
      reject(error)
    }, { once: true })
  })
  global.setTimeout = (callback, delay) => {
    timeoutDelays.push(delay)
    queueMicrotask(callback)
    return { delay }
  }
  global.clearTimeout = () => {}

  try {
    const outcome = await Promise.race([
      uploadRemoteFile({ url: 'https://provider.example.com/generated.png' })
        .then(() => 'resolved', (error) => error),
      new Promise((resolve) => originalSetTimeout(() => resolve('hung'), 20))
    ])

    assert.notEqual(outcome, 'hung')
    assert.equal(outcome.status, 504)
    assert.equal(outcome.code, 'UPLOAD_REMOTE_FETCH_TIMEOUT')
    assert.match(outcome.message, /remote asset fetch timed out/i)
    assert.ok(timeoutDelays[0] > 0)
  } finally {
    global.fetch = originalFetch
    global.setTimeout = originalSetTimeout
    global.clearTimeout = originalClearTimeout
  }
})
