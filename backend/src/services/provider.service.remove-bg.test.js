import assert from 'node:assert/strict'
import test from 'node:test'

import { providerRemoveBackground } from './provider.service.js'

const SOURCE_PNG =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='

test('remove background uses the assigned provider api key', async () => {
  const originalFetch = global.fetch
  const requests = []

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
    const result = await providerRemoveBackground({ image: SOURCE_PNG }, { apiKey: 'sk-assigned' })
    assert.equal(result.url, 'https://example.com/cutout.png')
  } finally {
    global.fetch = originalFetch
  }

  assert.equal(requests.length, 1)
  assert.match(requests[0].url, /\/photoroom\/v1\/segment\?response_format=url$/)
  assert.equal(requests[0].headers.Authorization, 'Bearer sk-assigned')
})

test('remove background masks upstream auth failures so the frontend does not clear login state', async () => {
  const originalFetch = global.fetch

  global.fetch = async () => new Response(
    JSON.stringify({ message: 'invalid provider key' }),
    {
      status: 401,
      headers: { 'content-type': 'application/json' }
    }
  )

  try {
    await assert.rejects(
      () => providerRemoveBackground({ image: SOURCE_PNG }, { apiKey: 'sk-bad' }),
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
