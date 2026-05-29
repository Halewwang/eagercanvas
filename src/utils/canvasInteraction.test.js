import assert from 'node:assert/strict'
import test from 'node:test'

import {
  createCanvasContentSnapshot,
  getGroupBodyHitRects,
  findGroupBodyDragTarget,
  getFlowPointFromScreenPoint,
  getGroupDragListenerNames,
  getGroupBoxPointerEvents,
  getInteractionOverlayDelay,
  getNodeCapsuleScale,
  getOverlayScheduleMode,
  getSelectedGroupGripPointerAction,
  translateViewportRect,
  shouldAcceptGroupDragMove,
  shouldMeasureGroupRects,
  shouldStartSelectedGroupBodyDrag,
  shouldTriggerCanvasRemoteSync,
  translateNodePositions,
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

test('immutable group drag position updates replace only moved node objects', () => {
  const untouched = { id: 'node-a', position: { x: 0, y: 0 } }
  const moved = { id: 'node-b', position: { x: 10, y: 20 } }
  const nodes = [untouched, moved]

  const result = translateNodePositions(nodes, ['node-b'], { x: 5, y: -4 })

  assert.equal(result.movedCount, 1)
  assert.notEqual(result.items, nodes)
  assert.equal(result.items[0], untouched)
  assert.notEqual(result.items[1], moved)
  assert.deepEqual(untouched.position, { x: 0, y: 0 })
  assert.deepEqual(moved.position, { x: 10, y: 20 })
  assert.deepEqual(result.items[1].position, { x: 15, y: 16 })
})

test('group drag overlay translation preserves the original frame size', () => {
  assert.deepEqual(translateViewportRect(
    { left: 100, top: 80, width: 300, height: 200 },
    { x: 45, y: -20 }
  ), { left: 145, top: 60, width: 300, height: 200 })
})

test('group rect measurement pauses during group drag unless forced', () => {
  assert.equal(shouldMeasureGroupRects({ isGroupDragging: false, force: false }), true)
  assert.equal(shouldMeasureGroupRects({ isGroupDragging: true, force: false }), false)
  assert.equal(shouldMeasureGroupRects({ isGroupDragging: true, force: true }), true)
})

test('group box overlay does not capture pointer events over grouped nodes', () => {
  assert.equal(getGroupBoxPointerEvents({ selected: false }), 'none')
  assert.equal(getGroupBoxPointerEvents({ selected: true }), 'none')
})

test('selected group body drag only starts from blank space inside the group rect', () => {
  const groupRect = { left: 100, top: 100, width: 300, height: 200 }
  const nodeRects = [{ left: 140, top: 130, right: 240, bottom: 210 }]

  assert.equal(shouldStartSelectedGroupBodyDrag({
    selected: true,
    point: { x: 280, y: 250 },
    groupRect,
    nodeRects
  }), true)

  assert.equal(shouldStartSelectedGroupBodyDrag({
    selected: true,
    point: { x: 180, y: 160 },
    groupRect,
    nodeRects
  }), false)

  assert.equal(shouldStartSelectedGroupBodyDrag({
    selected: false,
    point: { x: 280, y: 250 },
    groupRect,
    nodeRects
  }), false)
})

test('selected group body hit rects cover blank space without covering node rects', () => {
  assert.deepEqual(getGroupBodyHitRects({
    groupRect: { left: 100, top: 50, width: 100, height: 100 },
    nodeRects: [{ left: 120, top: 70, right: 160, bottom: 100 }]
  }), [
    { left: 0, top: 0, width: 20, height: 100 },
    { left: 20, top: 0, width: 40, height: 20 },
    { left: 20, top: 50, width: 40, height: 50 },
    { left: 60, top: 0, width: 40, height: 100 }
  ])
})

test('group grip pointer action starts drag on the first gesture', () => {
  assert.equal(getSelectedGroupGripPointerAction({ selected: false }), 'drag')
  assert.equal(getSelectedGroupGripPointerAction({ selected: true }), 'drag')
})

test('group body drag target is found from blank group space', () => {
  const groups = [
    { id: 'group-a', nodeIds: ['node-a'] },
    { id: 'group-b', nodeIds: ['node-b'] }
  ]
  const groupRects = {
    'group-a': { left: 100, top: 100, width: 240, height: 180 },
    'group-b': { left: 160, top: 140, width: 240, height: 180 }
  }
  const nodeRectsByGroup = {
    'group-b': [{ left: 180, top: 160, right: 260, bottom: 230 }]
  }

  assert.equal(findGroupBodyDragTarget({
    groups,
    groupRects,
    nodeRectsByGroup,
    point: { x: 310, y: 250 }
  })?.id, 'group-b')

  assert.equal(findGroupBodyDragTarget({
    groups,
    groupRects,
    nodeRectsByGroup,
    point: { x: 210, y: 190 }
  })?.id, 'group-a')

  assert.equal(findGroupBodyDragTarget({
    groups,
    groupRects,
    nodeRectsByGroup,
    point: { x: 40, y: 40 }
  }), null)
})

test('screen point converts to flow point using viewport pan and zoom', () => {
  assert.deepEqual(getFlowPointFromScreenPoint(
    { x: 300, y: 180 },
    { x: -100, y: -60, zoom: 2 }
  ), { x: 200, y: 120 })
})

test('group drag listens to pointer and mouse events for fallback movement', () => {
  assert.deepEqual(getGroupDragListenerNames(), {
    move: ['pointermove', 'mousemove'],
    end: ['pointerup', 'mouseup'],
    cancel: ['pointercancel']
  })
})

test('group drag accepts mousemove fallback after pointer start', () => {
  assert.equal(shouldAcceptGroupDragMove({
    activePointerId: 1,
    eventType: 'pointermove',
    eventPointerId: 2
  }), false)

  assert.equal(shouldAcceptGroupDragMove({
    activePointerId: 1,
    eventType: 'pointermove',
    eventPointerId: 1
  }), true)

  assert.equal(shouldAcceptGroupDragMove({
    activePointerId: 1,
    eventType: 'mousemove',
    eventPointerId: null
  }), true)
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
