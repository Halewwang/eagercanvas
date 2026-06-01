import assert from 'node:assert/strict'
import test from 'node:test'

import { resolveImageGenerationRequest } from './providers/image-request.js'

test('image request helper routes GPT Image 2 through OpenAI with styled prompt and fallback input image', () => {
  const request = resolveImageGenerationRequest({
    model: 'gpt-image-2',
    prompt: 'A product shot',
    size: '1152x768',
    style: 'cinematic',
    image_url: 'https://example.com/input.png'
  })

  assert.equal(request.kind, 'adapter')
  assert.equal(request.adapter, 'openai')
  assert.equal(request.payload.prompt, 'A product shot\n\nStyle: Cinematic lighting, movie scene, dramatic atmosphere')
  assert.equal(request.payload.ratio, '3:2')
  assert.equal(request.payload.size, '1152x768')
  assert.deepEqual(request.payload.images, ['https://example.com/input.png'])
})

test('image request helper routes Gemini preview with derived aspect ratio, resolution, and input images', () => {
  const request = resolveImageGenerationRequest({
    model: 'gemini-3.1-flash-image-preview',
    prompt: 'Adjust camera angle',
    size: '1680x720',
    image: ['https://example.com/first.png'],
    quality: '4k'
  })

  assert.equal(request.kind, 'adapter')
  assert.equal(request.adapter, 'dashboard302')
  assert.equal(request.payload.prompt, 'Adjust camera angle')
  assert.equal(request.payload.aspect_ratio, '21:9')
  assert.equal(request.payload.resolution, '4k')
  assert.deepEqual(request.payload.images, ['https://example.com/first.png'])
})

test('image request helper routes Wavespeed models with size fallback while preserving task flags', () => {
  const request = resolveImageGenerationRequest({
    model_name: 'wavespeed-ai/ghibli',
    prompt: 'Soft illustration',
    enable_sync_mode: false,
    enable_base64_output: false
  })

  assert.equal(request.kind, 'adapter')
  assert.equal(request.adapter, 'dashboard302')
  assert.equal(request.payload.size, '1024x1024')
  assert.equal(request.payload.prompt, 'Soft illustration')
  assert.equal(request.payload.enable_sync_mode, false)
  assert.equal(request.payload.enable_base64_output, false)
})

test('image request helper leaves generic image generation payloads on the direct provider path', () => {
  const payload = {
    model: 'stable-image-core',
    prompt: 'Generate an image',
    style: 'vivid',
    size: '1024x1024'
  }
  const request = resolveImageGenerationRequest(payload)

  assert.equal(request.kind, 'direct')
  assert.equal(request.path, '/v1/images/generations')
  assert.equal(request.method, 'POST')
  assert.equal(request.payload, payload)
})
