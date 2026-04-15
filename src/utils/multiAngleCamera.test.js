import assert from 'node:assert/strict'
import test from 'node:test'

import {
  QWEN_MULTI_ANGLE_MODEL,
  buildQwenMultiAngleCameraInput
} from './multiAngleCamera.js'

test('multi angle camera input maps current left-side UI direction to qwen left-side direction', () => {
  const input = buildQwenMultiAngleCameraInput({ azimuth: 90, elevation: 6, zoom: 5.2 })

  assert.deepEqual(input, {
    model: QWEN_MULTI_ANGLE_MODEL,
    horizontal_angle: 270,
    vertical_angle: 6,
    zoom: 5.2
  })
})

test('multi angle camera input only returns model and camera parameters', () => {
  const input = buildQwenMultiAngleCameraInput({ azimuth: 0, elevation: 78, zoom: 3.4 })

  assert.deepEqual(Object.keys(input).sort(), [
    'horizontal_angle',
    'model',
    'vertical_angle',
    'zoom'
  ])
  assert.equal(input.horizontal_angle, 0)
  assert.equal(input.vertical_angle, 78)
  assert.equal(input.zoom, 3.4)
})
