import assert from 'node:assert/strict'
import test from 'node:test'

import { providerGenerateImage } from './provider.service.js'

test('Multi angle uses APIMart GPT Image 2 references with camera instructions only in its prompt', async () => {
  const originalFetch = global.fetch
  const requests = []
  global.fetch = async (url, init) => {
    requests.push({ url: String(url), body: JSON.parse(init.body) })
    return Response.json({ code: 200, data: [{ status: 'submitted', task_id: 'task-camera' }] })
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
    }, { apimartApiKey: 'apimart-test-key' })
    assert.equal(result.task_id, 'task-camera')
    assert.equal(requests.length, 1)
    assert.equal(requests[0].url, 'https://api.apimart.ai/v1/images/generations')
    assert.equal(requests[0].body.model, 'gpt-image-2')
    assert.equal(requests[0].body.prompt, prompt)
    assert.equal(requests[0].body.image_urls.length, 1)
    for (const field of ['tools', 'horizontal_angle', 'vertical_angle', 'zoom']) assert.equal(Object.hasOwn(requests[0].body, field), false)
  } finally {
    global.fetch = originalFetch
  }
})
