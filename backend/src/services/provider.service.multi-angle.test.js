import assert from 'node:assert/strict'
import test from 'node:test'

import { providerGenerateImage } from './provider.service.js'

test('Qwen multi angle sends only source image and camera parameters to provider', async () => {
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
        data: {
          images: [
            { url: 'https://example.com/generated.png' }
          ]
        }
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
        tool: 'multi-angle',
        model: 'fal-ai/qwen-image-edit-2511-multiple-angles',
        image: 'https://example.com/source.png',
        prompt: 'do not forward this scene rewrite',
        horizontal_angle: 270,
        vertical_angle: 6,
        zoom: 5.2
      },
      { apiKey: 'sk-test' }
    )

    assert.equal(result.data[0].url, 'https://example.com/generated.png')
  } finally {
    global.fetch = originalFetch
  }

  assert.equal(requests.length, 1)
  assert.match(requests[0].url, /\/302\/v2\/image\/generate$/)
  assert.deepEqual(requests[0].body, {
    model: 'fal-ai/qwen-image-edit-2511-multiple-angles',
    image_urls: ['https://example.com/source.png'],
    horizontal_angle: 270,
    vertical_angle: 6,
    zoom: 5.2
  })
  assert.equal(Object.hasOwn(requests[0].body, 'prompt'), false)
})
