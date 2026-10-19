import assert from 'node:assert/strict'
import test from 'node:test'

import { resolveImageGenerationRequest } from './providers/image-request.js'

test('image requests use enbrand GPT Image 2 with styled prompts and fallback inputs', () => {
  const request = resolveImageGenerationRequest({
    model: 'gpt-image-2',
    prompt: 'A product shot',
    size: '1152x768',
    style: 'cinematic',
    image_url: 'https://example.com/input.png'
  })

  assert.equal(request.kind, 'adapter')
  assert.equal(request.adapter, 'enbrand')
  assert.equal(request.payload.model, 'gpt-image-2')
  assert.equal(request.payload.prompt, 'A product shot\n\nStyle: Cinematic lighting, movie scene, dramatic atmosphere')
  assert.equal(Object.hasOwn(request.payload, 'ratio'), false)
  assert.equal(Object.hasOwn(request.payload, 'size'), false)
  assert.deepEqual(request.payload.images, ['https://example.com/input.png'])
})

test('image requests preserve background while filtering unsupported controls', () => {
  const request = resolveImageGenerationRequest({
    prompt: 'A product shot',
    quality: 'high',
    background: 'opaque',
    moderation: 'low',
    size: '2048x2048',
    ratio: '1:1',
    aspect_ratio: '1:1',
    resolution: '4k',
    output_format: 'webp',
    outputFormat: 'jpeg',
    output_compression: 80,
    image: 'https://example.com/input.png'
  })

  assert.equal(request.adapter, 'enbrand')
  assert.equal(request.payload.model, 'gpt-image-2')
  assert.equal(request.payload.background, 'opaque')
  for (const field of ['size', 'ratio', 'aspect_ratio', 'resolution', 'output_format', 'outputFormat', 'output_compression', 'quality', 'moderation']) {
    assert.equal(Object.hasOwn(request.payload, field), false)
  }
  assert.deepEqual(request.payload.images, ['https://example.com/input.png'])
})

test('image requests reject every retired model before contacting providers', () => {
  for (const model of ['gpt-image-lite', 'gemini-3.1-flash-image-preview', 'nano-banana-pro', 'wavespeed-ai/ghibli', 'stable-image-core']) {
    assert.throws(() => resolveImageGenerationRequest({ model, prompt: 'test' }), error => {
      assert.equal(error.status, 400)
      assert.equal(error.code, 'UNSUPPORTED_IMAGE_MODEL')
      return true
    })
  }
  assert.throws(() => resolveImageGenerationRequest({ model: 'gpt-image-2', model_name: 'gpt-image-lite' }), { code: 'UNSUPPORTED_IMAGE_MODEL' })
})

test('image array input preserves every reference for GPT edits', () => {
  const request = resolveImageGenerationRequest({ image: ['first.png', 'second.png'] })
  assert.deepEqual(request.payload.images, ['first.png', 'second.png'])
})

test('legacy vivid style stays a prompt instruction without claiming an 8K output', () => {
  const request = resolveImageGenerationRequest({ prompt: 'A portrait', style: 'vivid', size: '8192x8192' })
  assert.equal(request.payload.prompt, 'A portrait\n\nStyle: Vivid, hyper-realistic, high contrast')
  assert.equal(Object.hasOwn(request.payload, 'size'), false)
})

test('empty images falls back to every legacy image array reference', () => {
  for (const images of [[], [null, '']]) {
    const request = resolveImageGenerationRequest({ images, image: ['first.png', 'second.png'] })
    assert.deepEqual(request.payload.images, ['first.png', 'second.png'])
  }
})
