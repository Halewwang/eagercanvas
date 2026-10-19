import assert from 'node:assert/strict'
import test from 'node:test'

import {
  CHAT_MODELS,
  DEFAULT_CHAT_MODEL,
  DEFAULT_IMAGE_MODEL,
  IMAGE_MODELS,
  resolveChatModelKey,
  resolveImageModelKey
} from './models.js'

test('image and text catalogs only expose the verified OpenAI models', () => {
  assert.deepEqual(IMAGE_MODELS.map((model) => model.key), ['gpt-image-2'])
  assert.deepEqual(CHAT_MODELS.map((model) => model.key), ['gpt-5.6-sol'])
  assert.equal(DEFAULT_IMAGE_MODEL, 'gpt-image-2')
  assert.equal(DEFAULT_CHAT_MODEL, 'gpt-5.6-sol')
})

test('retired and unknown model keys resolve to supported defaults', () => {
  for (const key of [undefined, '', 'gemini-3.1-flash-image-preview', 'gpt-image-lite', 'custom-image']) {
    assert.equal(resolveImageModelKey(key), 'gpt-image-2')
  }
  for (const key of [undefined, '', 'gemini-2.5-flash', 'gpt-4o', 'custom-chat']) {
    assert.equal(resolveChatModelKey(key), 'gpt-5.6-sol')
  }
})

test('GPT Image does not advertise ignored size, ratio, resolution, or quality controls', () => {
  const model = IMAGE_MODELS[0]
  for (const key of ['sizes', 'ratios', 'resolutions', 'qualities']) assert.deepEqual(model[key], [])
  assert.equal(model.hideRatioCapsule, true)
  assert.equal(model.supportImageReference, true)
  assert.equal(model.maxReferenceImages, 16)
  assert.ok(model.requestTimeoutMs >= 30 * 60 * 1000)
  for (const key of ['size', 'ratio', 'resolution', 'quality']) assert.equal(Object.hasOwn(model.defaultParams, key), false)
})

test('GPT Image only advertises verified output and background controls', () => {
  assert.deepEqual(IMAGE_MODELS[0].backgrounds.map((item) => item.key), ['auto', 'opaque'])
  assert.deepEqual(IMAGE_MODELS[0].outputFormats.map((item) => item.key), ['png'])
})
