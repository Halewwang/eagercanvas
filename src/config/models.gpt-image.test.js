import assert from 'node:assert/strict'
import test from 'node:test'

import {
  GPT_IMAGE_2_BASE_SIZES,
  GPT_IMAGE_2_RESOLUTION_OPTIONS,
  IMAGE_MODELS,
  resolveGptImage2Size
} from './models.js'

test('GPT Image 2 is available as a built-in image model', () => {
  const model = IMAGE_MODELS.find((item) => item.key === 'gpt-image-2')

  assert.ok(model, 'gpt-image-2 model should exist')
  assert.equal(model.label, 'GPT Image 2')
  assert.equal(model.supportImageReference, true)
  assert.notEqual(model.hideRatioCapsule, true)
  assert.equal(model.showAdvancedCapsuleParams, true)
  assert.equal(model.requestTimeoutMs, 600000)
  assert.deepEqual(model.resolutions, GPT_IMAGE_2_RESOLUTION_OPTIONS)
})

test('GPT Image 2 exposes the same ratio list as Gemini image models', () => {
  assert.deepEqual(
    GPT_IMAGE_2_BASE_SIZES.map((item) => item.ratio),
    ['1:1', '3:2', '2:3', '4:3', '3:4', '4:5', '5:4', '16:9', '9:16', '21:9']
  )
})

test('Gemini image models do not expose GPT Image 2 advanced capsule params', () => {
  const model = IMAGE_MODELS.find((item) => item.key === 'gemini-3-pro-image-preview')

  assert.ok(model, 'Gemini image model should exist')
  assert.notEqual(model.showAdvancedCapsuleParams, true)
})

test('GPT Image 2 maps capsule resolution to safe square sizes by default', () => {
  assert.equal(resolveGptImage2Size({ resolution: '1k' }), '1024x1024')
  assert.equal(resolveGptImage2Size({ resolution: '2k' }), '2048x2048')
  assert.equal(resolveGptImage2Size({ resolution: '4k' }), '2880x2880')
})

test('GPT Image 2 4K sizes obey max edge and total pixel limits', () => {
  const landscape = resolveGptImage2Size({ ratio: '16:9', resolution: '4k' })
  const portrait = resolveGptImage2Size({ ratio: '9:16', resolution: '4k' })
  const classic = resolveGptImage2Size({ ratio: '3:2', resolution: '4k' })
  const ultraWide = resolveGptImage2Size({ ratio: '21:9', resolution: '4k' })

  assert.equal(landscape, '3840x2160')
  assert.equal(portrait, '2160x3840')
  assert.equal(classic, '3528x2352')
  assert.equal(ultraWide, '3840x1645')

  for (const size of [landscape, portrait, classic, ultraWide]) {
    const [width, height] = size.split('x').map(Number)
    assert.ok(Math.max(width, height) <= 3840)
    assert.ok(width * height <= 8_300_000)
  }
})
