import assert from 'node:assert/strict'
import test from 'node:test'

import { providerGenerateImage } from './provider.service.js'

test('Multi angle keeps the selected image model and sends only camera prompt to provider', async () => {
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
        model: 'gemini-3.1-flash-image-preview',
        image: 'https://example.com/source.png',
        prompt: 'Camera view parameters only. horizontal_angle=270. vertical_angle=6. zoom=5.2. Preserve existing image content; only adjust camera viewpoint.',
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
  assert.match(requests[0].url, /\/ws\/api\/v3\/google\/nano-banana-2\/edit$/)
  assert.equal(requests[0].body.model, undefined)
  assert.equal(requests[0].body.prompt, 'Camera view parameters only. horizontal_angle=270. vertical_angle=6. zoom=5.2. Preserve existing image content; only adjust camera viewpoint.')
  assert.deepEqual(requests[0].body.images, ['https://example.com/source.png'])
  assert.equal(Object.hasOwn(requests[0].body, 'tools'), false)
})
