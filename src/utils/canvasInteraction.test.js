import assert from 'node:assert/strict'
import test from 'node:test'

import {
  createCanvasContentSnapshot,
  getGroupBoxPointerEvents,
  getInteractionOverlayDelay,
  getNodeCapsuleScale,
  getOverlayScheduleMode,
  shouldTriggerCanvasRemoteSync,
  translateNodePositionsInPlace
} from './canvasInteraction.js'

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

test('selected group box can receive pointer events for body dragging', () => {
  assert.equal(getGroupBoxPointerEvents({ selected: false }), 'none')
  assert.equal(getGroupBoxPointerEvents({ selected: true }), 'auto')
})

test('remote sync is limited to content changes', () => {
  assert.equal(shouldTriggerCanvasRemoteSync('content'), true)
  assert.equal(shouldTriggerCanvasRemoteSync('node-generated'), true)
  assert.equal(shouldTriggerCanvasRemoteSync('node-position'), false)
  assert.equal(shouldTriggerCanvasRemoteSync('viewport'), false)
})

test('content snapshot ignores viewport and node positions', () => {
  const first = createCanvasContentSnapshot({
    viewport: { x: 10, y: 20, zoom: 0.5 },
    nodes: [
      { id: 'node-a', type: 'text', position: { x: 0, y: 0 }, data: { content: 'same' } }
    ],
    edges: [],
    groups: []
  })
  const second = createCanvasContentSnapshot({
    viewport: { x: 300, y: 600, zoom: 1.6 },
    nodes: [
      { id: 'node-a', type: 'text', position: { x: 120, y: 80 }, data: { content: 'same' } }
    ],
    edges: [],
    groups: []
  })

  assert.deepEqual(first, second)
})
