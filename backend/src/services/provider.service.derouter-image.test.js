import assert from 'node:assert/strict'
import test from 'node:test'

import { providerGenerateImage } from './provider.service.js'

test('GPT Image lite generation calls derouter synchronous image endpoint', async () => {
  const originalFetch = global.fetch
  const requests = []

  global.fetch = async (url, init) => {
    requests.push({
      url: String(url),
      method: init?.method || 'GET',
      headers: init?.headers || {},
      body: init?.body ? JSON.parse(init.body) : null
    })

    return new Response(
      JSON.stringify({
        created: 1760000000,
        data: [{ b64_json: 'aW1hZ2UtYnl0ZXM=' }]
      }),
      {
        status: 200,
        headers: { 'content-type': 'application/json' }
      }
    )
  }

  try {
    const result = await providerGenerateImage(
      {
        model: 'gpt-image-lite',
        prompt: 'A product shot',
        ratio: '1:1',
        resolution: '1k',
        quality: 'medium'
      },
      {
        derouterApiBaseUrl: 'https://derouter.test/openai/v1',
        derouterApiKey: 'sk-derouter'
      }
    )

    assert.equal(result.provider, 'derouter')
    assert.equal(result.data[0].url, 'data:image/png;base64,aW1hZ2UtYnl0ZXM=')
  } finally {
    global.fetch = originalFetch
  }

  assert.equal(requests.length, 1)
  assert.equal(requests[0].url, 'https://derouter.test/openai/v1/images/generations')
  assert.equal(requests[0].method, 'POST')
  assert.equal(requests[0].headers.Authorization, 'Bearer sk-derouter')
  assert.equal(requests[0].body.model, 'gpt-image-2')
  assert.equal(requests[0].body.prompt, 'A product shot')
  assert.equal(requests[0].body.size, '1024x1024')
  assert.equal(requests[0].body.quality, 'medium')
  assert.equal(Object.hasOwn(requests[0].body, 'resolution'), false)
})

test('GPT Image lite edit calls derouter multipart image endpoint', async () => {
  const originalFetch = global.fetch
  const requests = []

  global.fetch = async (url, init) => {
    requests.push({
      url: String(url),
      method: init?.method || 'GET',
      headers: init?.headers || {},
      body: init?.body
    })

    return new Response(
      JSON.stringify({
        data: [{ b64_json: 'ZWRpdGVkLWltYWdl' }]
      }),
      {
        status: 200,
        headers: { 'content-type': 'application/json' }
      }
    )
  }

  try {
    const result = await providerGenerateImage(
      {
        model: 'gpt-image-lite',
        prompt: 'Add a hat',
        image: 'data:image/png;base64,aW5wdXQtaW1hZ2U=',
        ratio: '1:1',
        resolution: '1k',
        quality: 'high'
      },
      {
        derouterApiBaseUrl: 'https://derouter.test/openai/v1',
        derouterApiKey: 'sk-derouter'
      }
    )

    assert.equal(result.provider, 'derouter')
    assert.equal(result.data[0].url, 'data:image/png;base64,ZWRpdGVkLWltYWdl')
  } finally {
    global.fetch = originalFetch
  }

  assert.equal(requests.length, 1)
  assert.equal(requests[0].url, 'https://derouter.test/openai/v1/images/edits')
  assert.equal(requests[0].method, 'POST')
  assert.equal(requests[0].headers.Authorization, 'Bearer sk-derouter')
  assert.equal(requests[0].body.get('model'), 'gpt-image-2')
  assert.equal(requests[0].body.get('prompt'), 'Add a hat')
  assert.equal(requests[0].body.get('size'), '1024x1024')
  assert.equal(requests[0].body.get('quality'), 'high')
  assert.ok(requests[0].body.get('image') instanceof Blob)
})
