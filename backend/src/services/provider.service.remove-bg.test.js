import assert from 'node:assert/strict'
import test from 'node:test'

import { providerRemoveBackground } from './provider.service.js'

test('retired background removal returns gone without calling its provider', async () => {
  const originalFetch = global.fetch
  let requested = false
  global.fetch = async () => { requested = true; throw new Error('Retired provider must not be called') }
  try {
    await assert.rejects(providerRemoveBackground({ image: 'https://example.com/source.png' }), error => {
      assert.equal(error.status, 410)
      assert.equal(error.code, 'BACKGROUND_REMOVAL_UNSUPPORTED')
      return true
    })
    assert.equal(requested, false)
  } finally {
    global.fetch = originalFetch
  }
})
