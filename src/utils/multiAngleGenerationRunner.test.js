import assert from 'node:assert/strict'
import test from 'node:test'

import {
  createMultiAngleApplyPayload,
  createMultiAngleGenerationContext,
  createMultiAnglePendingPayload,
  runMultiAngleGeneration
} from './multiAngleGenerationRunner.js'

const baseContext = createMultiAngleGenerationContext({
  azimuth: 90,
  elevation: 6,
  model: 'gemini-3.1-flash-image-preview',
  zoom: 5.2
})

test('multi angle generation runner builds model camera context from UI controls', () => {
  assert.deepEqual(baseContext.cameraInput, {
    horizontal_angle: 270,
    vertical_angle: 6,
    zoom: 5.2
  })
  assert.match(baseContext.prompt, /horizontal_angle=270/)
  assert.deepEqual(baseContext.meta, {
    tool: 'multi-angle',
    azimuth: 90,
    elevation: 6,
    zoom: 5.2,
    camera: baseContext.cameraInput,
    prompt: baseContext.prompt,
    model: 'gemini-3.1-flash-image-preview'
  })
})

test('multi angle generation runner builds pending payloads without changing target mode', () => {
  assert.deepEqual(createMultiAnglePendingPayload({
    context: baseContext,
    ratio: '3:2',
    resolution: '2k',
    size: '2048x1365'
  }), {
    targetMode: 'new',
    size: '2048x1365',
    ratio: '3:2',
    resolution: '2k',
    fileType: 'image/png',
    meta: baseContext.meta
  })
})

test('multi angle generation runner builds apply payloads with url and ratio fallback', () => {
  assert.deepEqual(createMultiAngleApplyPayload({
    context: baseContext,
    ratio: '',
    resolution: '',
    size: '2048x1365',
    url: ' https://cdn.example.com/multi-angle.png '
  }), {
    targetMode: 'new',
    url: 'https://cdn.example.com/multi-angle.png',
    base64: '',
    fileType: 'image/png',
    size: '2048x1365',
    ratio: '2048:1365',
    resolution: '2k',
    meta: baseContext.meta
  })
})

test('multi angle generation runner sends camera parameters through provider tools', async () => {
  const calls = []
  const url = await runMultiAngleGeneration({
    context: baseContext,
    imageGen: {
      generate: async (payload) => {
        calls.push(payload)
        return [{ url: 'https://cdn.example.com/generated.png' }]
      }
    },
    imageSource: 'https://cdn.example.com/source.png',
    model: 'gemini-3.1-flash-image-preview',
    ratio: '3:2',
    resolution: '2k',
    size: '2048x1365'
  })

  assert.equal(url, 'https://cdn.example.com/generated.png')
  assert.deepEqual(calls, [
    {
      tool: 'multi-angle',
      model: 'gemini-3.1-flash-image-preview',
      prompt: baseContext.prompt,
      image: 'https://cdn.example.com/source.png',
      tools: {
        camera: {
          horizontal_angle: 270,
          vertical_angle: 6,
          zoom: 5.2
        }
      },
      size: '2048x1365',
      ratio: '3:2',
      resolution: '2k',
      enable_sync_mode: true,
      enable_base64_output: false
    }
  ])
})

test('multi angle generation runner rejects empty model output', async () => {
  await assert.rejects(
    runMultiAngleGeneration({
      context: baseContext,
      imageGen: {
        generate: async () => ({ url: '   ' })
      },
      imageSource: 'https://cdn.example.com/source.png',
      model: 'gemini-3.1-flash-image-preview',
      ratio: '1:1',
      resolution: '1k',
      size: '1024x1024'
    }),
    /No image output from model/
  )
})
