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
  assert.match(baseContext.prompt, /left side profile view/i)
  assert.doesNotMatch(baseContext.prompt, /horizontal_angle|vertical_angle/)
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
    imageSource: 'https://cdn.example.com/source.png',
    model: 'gpt-image-2',
    ratio: '3:2',
    resolution: '2k',
    size: '2048x1365'
  }), {
    targetMode: 'new',
    generationRatio: '3:2',
    generationResolution: '2k',
    fileType: 'image/png',
    model: 'gpt-image-2',
    sourcePrompt: baseContext.prompt,
    sourceRefImages: ['https://cdn.example.com/source.png'],
    meta: baseContext.meta
  })
})

test('multi angle passes task submission callbacks outside the request and omits temporary references from pending data', async () => {
  const onSubmitted = () => {}
  const imageSource = 'data:image/png;base64,temporary-image'
  let request
  let options
  await runMultiAngleGeneration({
    context: baseContext,
    imageSource,
    model: 'gpt-image-2',
    onSubmitted,
    imageGen: { generate: async (payload, config) => {
      request = payload
      options = config
      return [{ url: 'https://cdn.example.com/result.png' }]
    } }
  })
  assert.equal(options.onSubmitted, onSubmitted)
  assert.equal(Object.hasOwn(request, 'onSubmitted'), false)
  assert.equal(request.image, imageSource)
  for (const source of [imageSource, 'blob:https://example.com/temporary-image']) {
    const pending = createMultiAnglePendingPayload({ context: baseContext, imageSource: source })
    assert.equal(pending.model, baseContext.meta.model)
    assert.equal(pending.sourcePrompt, baseContext.prompt)
    assert.deepEqual(pending.sourceRefImages, [])
    assert.equal(JSON.stringify(pending).includes(source), false)
  }
})

test('multi angle generation runner builds apply payloads without inventing missing controls', () => {
  assert.deepEqual(createMultiAngleApplyPayload({
    context: baseContext,
    imageSource: 'https://cdn.example.com/source.png',
    ratio: '',
    resolution: '',
    url: ' https://cdn.example.com/multi-angle.png '
  }), {
    targetMode: 'new',
    url: 'https://cdn.example.com/multi-angle.png',
    base64: '',
    fileType: 'image/png',
    model: baseContext.meta.model,
    sourcePrompt: baseContext.prompt,
    sourceRefImages: ['https://cdn.example.com/source.png'],
    meta: baseContext.meta
  })
})

test('multi angle generation runner sends camera instructions through prompt only', async () => {
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
      ratio: '3:2',
      resolution: '2k'
    }
  ])
  assert.equal(Object.hasOwn(calls[0], 'tools'), false)
  assert.match(calls[0].prompt, /left side profile view/i)
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

test('multi angle keeps camera prompt and reference without inventing output controls', async () => {
  const calls = []
  await runMultiAngleGeneration({
    context: baseContext,
    imageGen: { generate: async (request) => { calls.push(request); return [{ url: 'result.png' }] } },
    imageSource: 'reference.png',
    model: 'gpt-image-2', })
  assert.deepEqual(calls[0], {
    tool: 'multi-angle', model: 'gpt-image-2', prompt: baseContext.prompt, image: 'reference.png', })
  const pending = createMultiAnglePendingPayload({ context: baseContext })
  for (const key of ['size', 'ratio', 'resolution']) assert.equal(Object.hasOwn(pending, key), false)
})


test('multi angle stores generation parameters outside actual media dimensions', async () => {
  const controls = { context: baseContext, ratio: '16:9', resolution: '4k', size: '3840x2160' }
  let request
  await runMultiAngleGeneration({ ...controls, model: 'gpt-image-2', imageSource: 'source.png',
    imageGen: { generate: async (payload) => { request = payload; return [{ url: 'result.png' }] } } })
  assert.equal(request.quality, undefined)
  assert.equal(Object.hasOwn(request, 'size'), false)
  for (const build of [createMultiAnglePendingPayload, createMultiAngleApplyPayload]) {
    const result = build({ ...controls, url: 'result.png' })
    assert.equal(result.generationRatio, '16:9')
    assert.equal(result.generationResolution, '4k')
    assert.equal(result.generationQuality, undefined)
    for (const key of ['size', 'ratio', 'resolution', 'quality']) assert.equal(Object.hasOwn(result, key), false)
  }
})
