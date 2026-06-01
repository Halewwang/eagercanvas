import assert from 'node:assert/strict'
import test from 'node:test'

import { PhotoRoomProviderAdapter } from './providers/photoroom.adapter.js'

const SOURCE_PNG =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='

test('PhotoRoom adapter removes background with the assigned provider api key', async () => {
  const originalFetch = global.fetch
  const requests = []
  const adapter = new PhotoRoomProviderAdapter()

  global.fetch = async (url, init) => {
    requests.push({
      url: String(url),
      headers: init?.headers || {}
    })

    return new Response(
      JSON.stringify({ url: 'https://example.com/cutout.png' }),
      {
        status: 200,
        headers: { 'content-type': 'application/json' }
      }
    )
  }

  try {
    const result = await adapter.removeBackground({ image: SOURCE_PNG }, { apiKey: 'sk-assigned' })
    assert.equal(result.url, 'https://example.com/cutout.png')
    assert.deepEqual(result.data, [{ url: 'https://example.com/cutout.png' }])
  } finally {
    global.fetch = originalFetch
  }

  assert.equal(requests.length, 1)
  assert.match(requests[0].url, /\/photoroom\/v1\/segment\?response_format=url$/)
  assert.equal(requests[0].headers.Authorization, 'Bearer sk-assigned')
})

test('PhotoRoom adapter masks upstream auth failures for remove background', async () => {
  const originalFetch = global.fetch
  const adapter = new PhotoRoomProviderAdapter()

  global.fetch = async () => new Response(
    JSON.stringify({ message: 'invalid provider key' }),
    {
      status: 401,
      headers: { 'content-type': 'application/json' }
    }
  )

  try {
    await assert.rejects(
      () => adapter.removeBackground({ image: SOURCE_PNG }, { apiKey: 'sk-bad' }),
      (error) => {
        assert.equal(error.status, 502)
        assert.equal(error.code, 'PROVIDER_AUTH_FAILED')
        return true
      }
    )
  } finally {
    global.fetch = originalFetch
  }
})

test('PhotoRoom adapter requires an image source for remove background', async () => {
  const adapter = new PhotoRoomProviderAdapter()

  await assert.rejects(
    () => adapter.removeBackground({}, { apiKey: 'sk-assigned' }),
    (error) => {
      assert.equal(error.status, 400)
      assert.equal(error.code, 'IMAGE_SOURCE_REQUIRED')
      return true
    }
  )
})
