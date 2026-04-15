import assert from 'node:assert/strict'
import test from 'node:test'

import { buildMultiAnglePrompt } from './multiAnglePrompt.js'

test('multi angle prompt carries exact azimuth and elevation camera controls', () => {
  const prompt = buildMultiAnglePrompt({ azimuth: 90, elevation: 6, zoom: 5.2 })

  assert.match(prompt, /Camera control/i)
  assert.match(prompt, /azimuth:\s*90°/)
  assert.match(prompt, /elevation:\s*6°/)
  assert.match(prompt, /left side view/i)
  assert.match(prompt, /eye level/i)
  assert.match(prompt, /medium-wide shot/i)
})
