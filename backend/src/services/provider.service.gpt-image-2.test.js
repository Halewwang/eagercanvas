import assert from 'node:assert/strict'
import test from 'node:test'

import { env } from '../config/env.js'
import { providerGenerateImage, providerImageStatus } from './provider.service.js'

test('GPT Image 2 generation uses the isolated enbrand image endpoint', async () => {
  const originalFetch = global.fetch
  const originalKey = env.openaiApiKey
  const requests = []
  env.openaiApiKey = 'enbrand-test-key'
  global.fetch = async (url, init) => {
    requests.push({ url: String(url), headers: init.headers, body: JSON.parse(init.body) })
    return Response.json({ data: [{ b64_json: Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), Buffer.alloc(192)]).toString('base64') }], usage: { total_tokens: 10 } })
  }

  try {
    const result = await providerGenerateImage({ model: 'gpt-image-2', prompt: 'A product shot', ratio: '1:1' }, { apiKey: 'old-302-key' })
    assert.match(result.data[0].url, /^data:image\/png;base64,/)
    assert.equal(requests.length, 1)
    assert.equal(requests[0].url, 'https://api.enbrand.co/v1/images/generations')
    assert.equal(requests[0].headers.Authorization, 'Bearer enbrand-test-key')
    assert.equal(requests[0].body.model, 'gpt-image-2')
    assert.equal(Object.hasOwn(requests[0].body, 'size'), false)
  } finally {
    env.openaiApiKey = originalKey
    global.fetch = originalFetch
  }
})

test('legacy upstream image tasks return gone without any provider polling', async () => {
  const originalFetch = global.fetch
  const requests = []
  global.fetch = async url => {
    requests.push(String(url))
    throw new Error('Image polling must not contact the retired provider')
  }
  try {
    for (const model of ['gpt-image-2', 'gemini-3-pro-image-preview', 'wavespeed-ai/ghibli', '']) {
      await assert.rejects(providerImageStatus('legacy-image-task', { model, apiKey: 'old-302-key' }), error => {
        assert.equal(error.status, 410)
        assert.equal(error.code, 'LEGACY_IMAGE_TASK_UNSUPPORTED')
        return true
      })
    }
    assert.deepEqual(requests, [])
    await assert.rejects(providerImageStatus(''), { code: 'IMAGE_TASK_ID_REQUIRED' })
  } finally {
    global.fetch = originalFetch
  }
})

test('image generation rejects retired model ids without using old provider credentials', async () => {
  const originalFetch = global.fetch
  let requested = false
  global.fetch = async () => { requested = true; throw new Error('Retired image models must not be called') }
  try {
    for (const model of ['gpt-image-lite', 'gemini-3.1-flash-image-preview', 'wavespeed-ai/ghibli', 'stable-image-core']) {
      await assert.rejects(providerGenerateImage({ model, prompt: 'test' }, { apiKey: 'old-302-key' }), { code: 'UNSUPPORTED_IMAGE_MODEL' })
    }
    assert.equal(requested, false)
  } finally {
    global.fetch = originalFetch
  }
})
