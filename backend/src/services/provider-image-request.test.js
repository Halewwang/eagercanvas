import assert from 'node:assert/strict'
import test from 'node:test'

import { buildApimartImageRequestBody, resolveImageGenerationRequest } from './providers/image-request.js'

const prompt = 'A product shot'

test('image requests use APIMart GPT Image 2 with styled prompts and fallback references', () => {
  const request = resolveImageGenerationRequest({ model: 'gpt-image-2', prompt, size: '16:9', resolution: '4k', style: 'cinematic', image_url: 'https://example.com/input.png' })
  assert.equal(request.kind, 'adapter')
  assert.equal(request.adapter, 'apimart')
  assert.deepEqual(request.payload, {
    model: 'gpt-image-2', prompt: `${prompt}\n\nStyle: Cinematic lighting, movie scene, dramatic atmosphere`, n: 1,
    size: '16:9', resolution: '4k', image_urls: ['https://example.com/input.png']
  })
})

test('image requests filter fields unsupported by APIMart without enabling paid fallback or moderation', () => {
  const request = resolveImageGenerationRequest({ prompt, size: '4:3', resolution: '2k', ratio: '1:1', aspect_ratio: '1:1', n: 2, quality: 'high', background: 'opaque', output_format: 'webp', outputFormat: 'jpeg', output_compression: 80, moderation: 'low', official_fallback: true, nsfw_check: true })
  assert.deepEqual(request.payload, { model: 'gpt-image-2', prompt, n: 1, size: '4:3', resolution: '2k' })
})

test('image requests reject every retired or conflicting model before providers', () => {
  for (const model of ['gpt-image-lite', 'gemini-3.1-flash-image-preview', 'nano-banana-pro', 'wavespeed-ai/ghibli', 'stable-image-core']) {
    assert.throws(() => resolveImageGenerationRequest({ model, prompt }), { status: 400, code: 'UNSUPPORTED_IMAGE_MODEL' })
  }
  assert.throws(() => resolveImageGenerationRequest({ model: 'gpt-image-2', model_name: 'gpt-image-lite', prompt }), { code: 'UNSUPPORTED_IMAGE_MODEL' })
})

test('image requests accept all fifteen documented ratios plus auto and direct positive pixels', () => {
  for (const size of ['auto', '1:1', '3:2', '2:3', '4:3', '3:4', '5:4', '4:5', '16:9', '9:16', '2:1', '1:2', '3:1', '1:3', '21:9', '9:21', '1881x836', '887x1774']) {
    for (const resolution of ['1k', '2k', '4k']) {
      assert.equal(buildApimartImageRequestBody({ prompt, size, resolution }).size, size)
      assert.equal(resolveImageGenerationRequest({ prompt, size, resolution }).payload.resolution, resolution)
    }
  }
  assert.deepEqual(buildApimartImageRequestBody({ prompt }), { model: 'gpt-image-2', prompt, n: 1, size: '1:1', resolution: '1k' })
})

test('invalid APIMart prompt, ratio, resolution, or references fail with clear 400 errors', () => {
  for (const invalidPrompt of ['', ' ', 4, null]) assert.throws(() => buildApimartImageRequestBody({ prompt: invalidPrompt }), { status: 400, code: 'IMAGE_PROMPT_REQUIRED' })
  for (const size of [null, '', 1024, 'square', 'Auto', '4:7', '0x1024', '-1024x1024', '1024.5x1024', '1024X1024', '01024x1024']) assert.throws(() => buildApimartImageRequestBody({ prompt, size }), { status: 400, code: 'INVALID_IMAGE_SIZE' })
  for (const resolution of [null, '', 4, 'auto', '8k', '4K']) assert.throws(() => buildApimartImageRequestBody({ prompt, resolution }), { status: 400, code: 'INVALID_IMAGE_RESOLUTION' })
  for (const image_urls of ['https://example.com/image.png', ['file:///private/image.png'], ['not-an-image'], ['https://?'], ['http://#'], ['data:image/png;base64,A'], ['data:image/png;base64, =='], ['data:image/png;base64,aW1hZ2V='], [{}]]) assert.throws(() => buildApimartImageRequestBody({ prompt, image_urls }), { status: 400, code: 'INVALID_IMAGE_REFERENCE' })
})

test('APIMart retains all canonical and legacy reference arrays without single-image truncation', () => {
  const references = ['https://example.com/first.png', 'data:image/png;base64,aW1hZ2U=']
  for (const payload of [{ image_urls: references }, { images: references }, { image: references }, { images: [], image: references }, { images: [null, ''], image: references }]) {
    assert.deepEqual(resolveImageGenerationRequest({ prompt, ...payload }).payload.image_urls, references)
  }
  assert.deepEqual(resolveImageGenerationRequest({ prompt, image_urls: references, image: 'https://example.com/ignored.png' }).payload.image_urls, references)
  assert.throws(() => resolveImageGenerationRequest({ prompt, images: Array(16).fill(references[0]) }), { status: 400, code: 'TOO_MANY_IMAGES' })
})
