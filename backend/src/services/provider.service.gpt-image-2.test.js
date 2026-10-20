import assert from 'node:assert/strict'
import test from 'node:test'

import { env } from '../config/env.js'
import { providerGenerateImage, providerImageStatus } from './provider.service.js'

const withFetch = async (implementation, fn) => {
  const original = global.fetch
  global.fetch = implementation
  try { return await fn() } finally { global.fetch = original }
}

test('GPT Image 2 uses the isolated APIMart JSON endpoint and returns a submitted task', async () => {
  const originalKey = env.apimartApiKey
  env.apimartApiKey = 'apimart-test-key'
  try {
    await withFetch((url, init) => {
      assert.equal(String(url), 'https://api.apimart.ai/v1/images/generations')
      assert.equal(init.headers.Authorization, 'Bearer apimart-test-key')
      assert.deepEqual(JSON.parse(init.body), { model: 'gpt-image-2', prompt: 'A product shot', n: 1, size: '16:9', resolution: '4k' })
      return Response.json({ code: 200, data: [{ status: 'submitted', task_id: 'task-new-image' }] })
    }, async () => {
      const result = await providerGenerateImage({ model: 'gpt-image-2', prompt: 'A product shot', size: '16:9', resolution: '4k', quality: 'high', background: 'opaque' }, { apiKey: 'old-key', openaiApiKey: 'text-only-key' })
      assert.equal(result.task_id, 'task-new-image')
      assert.equal(result.status, 'submitted')
      assert.deepEqual(result.data, [])
    })
  } finally { env.apimartApiKey = originalKey }
})

test('provider image status delegates an authorized upstream task lookup to APIMart only', async () => {
  await withFetch((url, init) => {
    assert.equal(String(url), 'https://api.apimart.ai/v1/tasks/task-new-image')
    assert.equal(init.method, 'GET')
    assert.equal(init.headers.Authorization, 'Bearer apimart-test-key')
    return Response.json({ code: 200, data: { id: 'task-new-image', status: 'completed', progress: 100, result: { images: [{ url: ['https://example.com/generated.png'] }] } } })
  }, async () => {
    const result = await providerImageStatus('task-new-image', { apimartApiKey: 'apimart-test-key', apiKey: 'old-key', openaiApiKey: 'text-key' })
    assert.equal(result.status, 'completed')
    assert.deepEqual(result.data, [{ url: 'https://example.com/generated.png' }])
  })
  await assert.rejects(providerImageStatus(''), { status: 400, code: 'IMAGE_TASK_ID_REQUIRED' })
})

test('image generation rejects retired models and invalid controls before provider fetch', async () => {
  await withFetch(() => assert.fail('invalid requests must not reach a provider'), async () => {
    for (const model of ['gpt-image-lite', 'gemini-3.1-flash-image-preview', 'wavespeed-ai/ghibli', 'stable-image-core']) await assert.rejects(providerGenerateImage({ model, prompt: 'test' }), { code: 'UNSUPPORTED_IMAGE_MODEL' })
    await assert.rejects(providerGenerateImage({ prompt: 'test', size: '4:7' }), { status: 400, code: 'INVALID_IMAGE_SIZE' })
    await assert.rejects(providerGenerateImage({ prompt: 'test', resolution: '8k' }), { status: 400, code: 'INVALID_IMAGE_RESOLUTION' })
  })
})

test('GPT Image 2 references follow the same APIMart JSON generation route', async () => {
  const references = ['https://example.com/input.png', 'data:image/png;base64,aW1hZ2U=']
  await withFetch((url, init) => {
    assert.equal(String(url), 'https://api.apimart.ai/v1/images/generations')
    assert.equal(init.headers['Content-Type'], 'application/json')
    assert.deepEqual(JSON.parse(init.body), { model: 'gpt-image-2', prompt: 'A portrait', n: 1, size: '9:16', resolution: '2k', image_urls: references })
    return Response.json({ code: 200, data: [{ status: 'submitted', task_id: 'task-edit' }] })
  }, async () => {
    const result = await providerGenerateImage({ prompt: 'A portrait', images: references, size: '9:16', resolution: '2k' }, { apimartApiKey: 'apimart-test-key' })
    assert.equal(result.task_id, 'task-edit')
  })
})
