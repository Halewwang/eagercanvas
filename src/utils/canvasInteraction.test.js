import assert from 'node:assert/strict'
import test from 'node:test'

import {
  getInteractionOverlayDelay,
  shouldRenderMinimap
} from './canvasInteraction.js'

test('minimap is hidden during canvas interactions and on very large canvases', () => {
  assert.equal(shouldRenderMinimap({ isMobile: false, isInteracting: true, nodeCount: 12 }), false)
  assert.equal(shouldRenderMinimap({ isMobile: false, isInteracting: false, nodeCount: 121, nodeLimit: 120 }), false)
  assert.equal(shouldRenderMinimap({ isMobile: false, isInteracting: false, nodeCount: 120, nodeLimit: 120 }), true)
})

test('overlay updates are delayed only while interacting', () => {
  assert.equal(getInteractionOverlayDelay({ isInteracting: false }), 0)
  assert.equal(getInteractionOverlayDelay({ isInteracting: true }), 80)
})
