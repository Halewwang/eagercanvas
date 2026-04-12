import assert from 'node:assert/strict'
import test from 'node:test'

import {
  VIDEO_MODELS,
  getVideoConnectionProfile,
  getVideoGenerationProfile,
  resolveSeedanceGenerationType
} from './models.js'

test('Seedance 2.0 exposes video reference support and model-specific options', () => {
  const model = VIDEO_MODELS.find((item) => item.key === 'seedance-2.0')

  assert.ok(model, 'Seedance 2.0 model should exist')
  assert.equal(model.supportVideoReference, true)
  assert.equal(model.supportAudioToggle, true)
  assert.ok(Array.isArray(model.resolutions) && model.resolutions.length > 0)
  assert.ok(Array.isArray(model.generationTypes) && model.generationTypes.length > 0)
})

test('Seedance 2.0 hides type capsule and resolves first-last mode from connected frames', () => {
  const profile = getVideoGenerationProfile(
    'seedance-2.0',
    resolveSeedanceGenerationType({
      firstFrameImage: 'https://example.com/first.png',
      lastFrameImage: 'https://example.com/last.png'
    })
  )

  assert.equal(profile.allowFirstFrame, true)
  assert.equal(profile.allowLastFrame, true)
  assert.equal(profile.allowType, false)
  assert.equal(profile.allowRatio, false)
})

test('Seedance 2.0 connection profile keeps all supported reference tags available', () => {
  const profile = getVideoConnectionProfile('seedance-2.0', 'text_to_video')

  assert.equal(profile.allowPrompt, true)
  assert.equal(profile.allowFirstFrame, true)
  assert.equal(profile.allowLastFrame, true)
  assert.equal(profile.allowImageReference, true)
  assert.equal(profile.allowVideoReference, true)
  assert.equal(profile.allowType, false)
})
