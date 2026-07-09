import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildMultiAngleCameraInput,
  buildMultiAngleCameraPrompt
} from './multiAngleCamera.js'

test('multi angle camera input maps current left-side UI direction to model camera direction', () => {
  const input = buildMultiAngleCameraInput({ azimuth: 90, elevation: 6, zoom: 5.2 })

  assert.deepEqual(input, {
    horizontal_angle: 270,
    vertical_angle: 6,
    zoom: 5.2
  })
})

test('multi angle camera input only returns model and camera parameters', () => {
  const input = buildMultiAngleCameraInput({ azimuth: 0, elevation: 78, zoom: 3.4 })

  assert.deepEqual(Object.keys(input).sort(), [
    'horizontal_angle',
    'vertical_angle',
    'zoom'
  ])
  assert.equal(input.horizontal_angle, 0)
  assert.equal(input.vertical_angle, 78)
  assert.equal(input.zoom, 3.4)
})

test('multi angle camera prompt converts UI camera controls into natural language', () => {
  const prompt = buildMultiAngleCameraPrompt({
    azimuth: 90,
    elevation: 6,
    horizontal_angle: 270,
    vertical_angle: 6,
    zoom: 5.2
  })

  assert.match(prompt, /left side profile view/i)
  assert.match(prompt, /90 degrees around the image content from the front/i)
  assert.match(prompt, /slightly high/i)
  assert.match(prompt, /zoom=5\.2/)
  assert.doesNotMatch(prompt, /horizontal_angle|vertical_angle/)
  assert.doesNotMatch(prompt, /person|subject|scene|background|outfit|identity|re-photograph/i)
})
