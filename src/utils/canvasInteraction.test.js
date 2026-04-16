import assert from 'node:assert/strict'
import test from 'node:test'

import {
  getInteractionOverlayDelay,
  getNodeCapsuleScale,
  getOverlayScheduleMode,
  shouldRenderMinimap
} from './canvasInteraction.js'

test('minimap stays mounted during interactions unless the canvas is too large', () => {
  assert.equal(shouldRenderMinimap({ isMobile: false, isInteracting: true, nodeCount: 12 }), true)
  assert.equal(shouldRenderMinimap({ isMobile: false, isInteracting: false, nodeCount: 121, nodeLimit: 120 }), false)
  assert.equal(shouldRenderMinimap({ isMobile: false, isInteracting: true, nodeCount: 121, nodeLimit: 120 }), false)
  assert.equal(shouldRenderMinimap({ isMobile: false, isInteracting: false, nodeCount: 120, nodeLimit: 120 }), true)
})

test('overlay updates are delayed only while interacting', () => {
  assert.equal(getInteractionOverlayDelay({ isInteracting: false }), 0)
  assert.equal(getInteractionOverlayDelay({ isInteracting: true }), 80)
})

test('overlay updates are deferred while zooming', () => {
  assert.equal(getOverlayScheduleMode({ isDragging: false, isZooming: false }), 'raf')
  assert.equal(getOverlayScheduleMode({ isDragging: true, isZooming: false }), 'delayed')
  assert.equal(getOverlayScheduleMode({ isDragging: false, isZooming: true }), 'skip')
  assert.equal(getOverlayScheduleMode({ isDragging: true, isZooming: true }), 'skip')
})

test('node capsule scale matches the previous clamped inverse zoom behavior', () => {
  assert.equal(getNodeCapsuleScale(1), 1)
  assert.equal(getNodeCapsuleScale(2), 0.82)
  assert.equal(getNodeCapsuleScale(0.5), 1.06)
})
