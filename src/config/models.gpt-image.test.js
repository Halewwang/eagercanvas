import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'

const modelsSource = readFileSync(new URL('./models.js', import.meta.url), 'utf8')
  .replace("from '@/utils/gptImageParameters'", `from '${new URL('../utils/gptImageParameters.js', import.meta.url).href}'`)
const {
  CHAT_MODELS,
  DEFAULT_CHAT_MODEL,
  DEFAULT_IMAGE_MODEL,
  IMAGE_MODELS,
  resolveChatModelKey,
  resolveImageModelKey
} = await import(`data:text/javascript;base64,${Buffer.from(modelsSource).toString('base64')}`)

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

test('GPT Image advertises body-backed generation parameters', () => {
  const model = IMAGE_MODELS[0]
  assert.deepEqual(model.ratios, ['auto', '1:1', '3:2', '2:3', '4:3', '3:4', '5:4', '4:5', '16:9', '9:16', '2:1', '1:2', '3:1', '1:3', '21:9', '9:21'])
  assert.deepEqual(model.resolutions.map(item => item.key), ['1k', '2k', '4k'])
  assert.equal(model.qualities, undefined)
  assert.equal(model.hideRatioCapsule, false)
  assert.equal(model.supportImageReference, true)
  assert.equal(model.maxReferenceImages, 15)
  assert.ok(model.requestTimeoutMs >= 30 * 60 * 1000)
})

test('APIMart does not advertise unsupported quality background or output-format controls', () => {
  for (const name of ['qualities', 'backgrounds', 'outputFormats']) assert.equal(IMAGE_MODELS[0][name], undefined)
})
