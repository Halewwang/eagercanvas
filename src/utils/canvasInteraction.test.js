import assert from 'node:assert/strict'
import test from 'node:test'

import {
  getInteractionOverlayDelay,
  getNodeCapsuleScale,
  getOverlayScheduleMode,
  shouldRenderMinimap,
  translateNodePositionsInPlace
} from './canvasInteraction.js'

test('minimap stays mounted during interactions unless the canvas is too large', () => {
  assert.equal(shouldRenderMinimap({ isMobile: false, isInteracting: true, nodeCount: 12 }), true)
  assert.equal(shouldRenderMinimap({ isMobile: false, isInteracting: false, nodeCount: 121, nodeLimit: 120 }), false)
  assert.equal(shouldRenderMinimap({ isMobile: false, isInteracting: true, nodeCount: 121, nodeLimit: 120 }), false)
  assert.equal(shouldRenderMinimap({ isMobile: false, isInteracting: false, nodeCount: 120, nodeLimit: 120 }), true)
})

test('overlay delay helper keeps the previous delay value available', () => {
  assert.equal(getInteractionOverlayDelay({ isInteracting: false }), 0)
  assert.equal(getInteractionOverlayDelay({ isInteracting: true }), 80)
})

test('overlay updates stay live while dragging and zooming', () => {
  assert.equal(getOverlayScheduleMode({ isDragging: false, isZooming: false }), 'raf')
  assert.equal(getOverlayScheduleMode({ isDragging: true, isZooming: false }), 'raf')
  assert.equal(getOverlayScheduleMode({ isDragging: false, isZooming: true }), 'raf')
  assert.equal(getOverlayScheduleMode({ isDragging: true, isZooming: true }), 'raf')
})

test('node capsule scale matches the previous clamped inverse zoom behavior', () => {
  assert.equal(getNodeCapsuleScale(1), 1)
  assert.equal(getNodeCapsuleScale(2), 0.82)
  assert.equal(getNodeCapsuleScale(0.5), 1.06)
})

test('group drag position updates mutate only targeted nodes without replacing the node list', () => {
  const untouched = { id: 'node-a', position: { x: 0, y: 0 } }
  const moved = { id: 'node-b', position: { x: 10, y: 20 } }
  const nodes = [untouched, moved]
  const lookup = new Map(nodes.map((node) => [node.id, node]))

  const movedCount = translateNodePositionsInPlace(nodes, ['node-b'], { x: 5, y: -4 }, { lookup })

  assert.equal(movedCount, 1)
  assert.equal(nodes[0], untouched)
  assert.equal(nodes[1], moved)
  assert.deepEqual(untouched.position, { x: 0, y: 0 })
  assert.deepEqual(moved.position, { x: 15, y: 16 })
})
