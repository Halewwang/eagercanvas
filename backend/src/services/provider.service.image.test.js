import assert from 'node:assert/strict'
import test from 'node:test'

import { providerGenerateImage } from './provider.service.js'

test('Gemini image edit forwards multi-angle tool parameters to provider', async () => {
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
        data: [
          { url: 'https://example.com/generated.png' }
        ]
      }),
      {
        status: 200,
        headers: {
          'content-type': 'application/json'
        }
      }
    )
  }

  try {
    const result = await providerGenerateImage(
      {
        model: 'gemini-3.1-flash-image-preview',
        prompt: 'rotate subject',
        image: 'https://example.com/source.png',
        aspect_ratio: '1:1',
        resolution: '1k',
        tools: {
          multi_angle: {
            azimuth: 90,
            elevation: 6,
            zoom: 5.2
          }
        }
      },
      { apiKey: 'sk-test' }
    )

    assert.equal(result.data[0].url, 'https://example.com/generated.png')
  } finally {
    global.fetch = originalFetch
  }

  assert.equal(requests.length, 1)
  assert.match(requests[0].url, /\/ws\/api\/v3\/google\/nano-banana-2\/edit$/)
  assert.deepEqual(requests[0].body?.tools, {
    multi_angle: {
      azimuth: 90,
      elevation: 6,
      zoom: 5.2
    }
  })
})
