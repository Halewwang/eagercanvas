import assert from 'node:assert/strict'
import test from 'node:test'

import { providerGenerateImage } from './provider.service.js'

test('Multi angle uses GPT Image 2 edits with camera instructions only in its prompt', async () => {
  const originalFetch = global.fetch
  const requests = []
  global.fetch = async (url, init) => {
    requests.push({ url: String(url), body: init.body })
    return Response.json({ data: [{ url: 'https://example.com/generated.png' }] })
  }

  const prompt = 'Camera view parameters only. horizontal_angle=270. vertical_angle=6. zoom=5.2. Preserve existing image content; only adjust camera viewpoint.'
  try {
    const result = await providerGenerateImage({
      tool: 'multi-angle',
      model: 'gpt-image-2',
      image: 'data:image/png;base64,aW1hZ2U=',
      prompt,
      horizontal_angle: 270,
      vertical_angle: 6,
      zoom: 5.2
    }, { openaiApiKey: 'enbrand-test-key' })
    assert.equal(result.data[0].url, 'https://example.com/generated.png')
    assert.equal(requests.length, 1)
    assert.equal(requests[0].url, 'https://api.enbrand.co/v1/images/edits')
    assert.equal(requests[0].body.get('model'), 'gpt-image-2')
    assert.equal(requests[0].body.get('prompt'), prompt)
    assert.equal(requests[0].body.getAll('image[]').length, 1)
    for (const field of ['tools', 'horizontal_angle', 'vertical_angle', 'zoom']) assert.equal(requests[0].body.has(field), false)
  } finally {
    global.fetch = originalFetch
  }
})
