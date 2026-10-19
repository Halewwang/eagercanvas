import assert from 'node:assert/strict'
import test from 'node:test'

const requestAuth = await import('./requestAuth.js').catch(() => ({}))

test('axios request auth applies stored tokens before preview fallback', () => {
  assert.equal(typeof requestAuth.applyRequestAccessToken, 'function')

  const real = requestAuth.applyRequestAccessToken({ headers: {} }, {
    storedToken: 'real-token',
    env: { DEV: true, VITE_BYPASS_AUTH: 'true', VITE_LOCAL_PREVIEW_ACCESS_TOKEN: 'local-preview-browser-token' }
  })
  assert.equal(real.headers.Authorization, 'Bearer real-token')

  const preview = requestAuth.applyRequestAccessToken({ headers: {} }, {
    storedToken: '',
    env: { DEV: true, VITE_BYPASS_AUTH: 'true', VITE_LOCAL_PREVIEW_ACCESS_TOKEN: 'local-preview-browser-token' }
  })
  assert.equal(preview.headers.Authorization, 'Bearer local-preview-browser-token')

  const disabled = requestAuth.applyRequestAccessToken({ headers: {} }, {
    storedToken: '',
    env: { DEV: false, VITE_BYPASS_AUTH: 'true', VITE_LOCAL_PREVIEW_ACCESS_TOKEN: 'local-preview-browser-token' }
  })
  assert.equal(disabled.headers.Authorization, undefined)
})
