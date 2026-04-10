import assert from 'node:assert/strict'
import test from 'node:test'

import { VIDEO_MODELS } from './models.js'

test('Seedance 2.0 exposes video reference support and model-specific options', () => {
  const model = VIDEO_MODELS.find((item) => item.key === 'seedance-2.0')

  assert.ok(model, 'Seedance 2.0 model should exist')
  assert.equal(model.supportVideoReference, true)
  assert.equal(model.supportAudioToggle, true)
  assert.ok(Array.isArray(model.resolutions) && model.resolutions.length > 0)
  assert.ok(Array.isArray(model.generationTypes) && model.generationTypes.length > 0)
})
