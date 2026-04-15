import assert from 'node:assert/strict'
import test from 'node:test'

import { buildMultiAnglePrompt } from './multiAnglePrompt.js'

test('multi angle prompt translates side view controls into natural image instructions', () => {
  const prompt = buildMultiAnglePrompt({ azimuth: 90, elevation: 6, zoom: 5.2 })

  assert.match(prompt, /left side profile/i)
  assert.match(prompt, /not a front view/i)
  assert.match(prompt, /eye level/i)
  assert.match(prompt, /same height as the subject/i)
  assert.match(prompt, /medium-wide shot/i)
  assert.doesNotMatch(prompt, /azimuth/i)
  assert.doesNotMatch(prompt, /elevation/i)
})

test('multi angle prompt translates top view controls into concrete overhead language', () => {
  const prompt = buildMultiAnglePrompt({ azimuth: 0, elevation: 78, zoom: 3.4 })

  assert.match(prompt, /overhead/i)
  assert.match(prompt, /top of the subject/i)
  assert.match(prompt, /from above/i)
  assert.match(prompt, /not an eye-level view/i)
})
