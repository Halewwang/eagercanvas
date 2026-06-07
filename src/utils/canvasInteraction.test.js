import assert from 'node:assert/strict'
import test from 'node:test'

import * as canvasInteraction from './canvasInteraction.js'
import {
  createCanvasContentSnapshot,
  getCanvasLibraryInsertPosition,
  getCanvasNodeGridPosition,
  getConnectMenuEdgeParams,
  getLocalImageInjectPosition,
  getGroupBodyHitRects,
  getGroupMergeCandidate,
  findGroupBodyDragTarget,
  getFlowPointFromScreenPoint,
  getGroupDragListenerNames,
  getGroupBoxPointerEvents,
  getInteractionOverlayDelay,
  getImageRatioFromDimensions,
  createLocalImageNodeData,
  getNodeCapsuleScale,
  getNodeSize,
  getNodeViewportRect,
  getRectOverlapRatio,
  getOverlayScheduleMode,
  getSelectedGroupGripPointerAction,
  mergeViewportRects,
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

test('group merge candidate uses dragged node area and requires 50 percent overlap', () => {
  const nodeRect = { left: 0, top: 0, right: 100, bottom: 100 }
  const groups = [
    { id: 'group-low', rect: { left: 60, top: 0, width: 100, height: 100 } },
    { id: 'group-hit', rect: { left: 49, top: 0, width: 100, height: 100 } }
  ]

  assert.equal(getRectOverlapRatio(nodeRect, groups[0].rect), 0.4)
  assert.equal(getRectOverlapRatio(nodeRect, groups[1].rect), 0.51)
  assert.equal(getGroupMergeCandidate({ nodeRect, groups })?.id, 'group-hit')
  assert.equal(getGroupMergeCandidate({ nodeRect, groups, threshold: 0.52 }), null)
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

test('canvas library insert position targets the visible workspace with cyclic node offsets', () => {
  assert.deepEqual(getCanvasLibraryInsertPosition({
    viewport: { x: -100, y: -60, zoom: 2 },
    shellSize: { width: 1000, height: 700 },
    nodeCount: 5
  }), { x: 258, y: 105 })

  assert.deepEqual(getCanvasLibraryInsertPosition({
    viewport: {},
    shellSize: { width: 0, height: 0 },
    nodeCount: 0
  }), { x: 666, y: 278 })
})

test('canvas node grid position keeps menu-created nodes in the existing staggered layout', () => {
  assert.deepEqual(getCanvasNodeGridPosition({
    origin: { x: 50, y: 80 },
    index: 3
  }), { x: 170, y: 212 })

  assert.deepEqual(getCanvasNodeGridPosition({
    origin: { x: 0, y: 0 },
    index: 4,
    gapX: 88,
    gapY: 118
  }), { x: 0, y: 236 })
})

test('canvas auto placement snaps preferred positions to the grid when the slot is free', () => {
  assert.equal(typeof canvasInteraction.getCanvasAutoPlacementPosition, 'function')
  assert.deepEqual(canvasInteraction.getCanvasAutoPlacementPosition({
    preferredPosition: { x: 103, y: 117 },
    nodeType: 'image',
    nodeData: { ratio: '1:1' },
    existingNodes: []
  }), { x: 100, y: 120 })
})

test('canvas auto placement skips occupied grid slots for existing and pending nodes', () => {
  assert.equal(typeof canvasInteraction.getCanvasAutoPlacementPosition, 'function')
  const existingNodes = [
    { id: 'existing-text', type: 'text', position: { x: 0, y: 0 }, data: {} }
  ]
  const firstPosition = canvasInteraction.getCanvasAutoPlacementPosition({
    preferredPosition: { x: 0, y: 0 },
    nodeType: 'text',
    nodeData: {},
    existingNodes,
    columns: 2
  })
  const secondPosition = canvasInteraction.getCanvasAutoPlacementPosition({
    preferredPosition: { x: 0, y: 0 },
    nodeType: 'text',
    nodeData: {},
    existingNodes: [
      ...existingNodes,
      { id: 'pending-text', type: 'text', position: firstPosition, data: {} }
    ],
    columns: 2
  })

  assert.deepEqual(firstPosition, { x: 420, y: 0 })
  assert.deepEqual(secondPosition, { x: 0, y: 380 })
})

test('connect menu edge params preserve source and target handle direction', () => {
  assert.deepEqual(getConnectMenuEdgeParams({
    nodeId: 'source-node',
    handleId: 'right-output',
    handleType: 'source'
  }, 'created-node'), {
    source: 'source-node',
    target: 'created-node',
    sourceHandle: 'right-output',
    targetHandle: 'left'
  })

  assert.deepEqual(getConnectMenuEdgeParams({
    nodeId: 'target-node',
    handleId: 'left-input',
    handleType: 'target'
  }, 'created-node'), {
    source: 'created-node',
    target: 'target-node',
    sourceHandle: 'right',
    targetHandle: 'left-input'
  })

  assert.equal(getConnectMenuEdgeParams(null, 'created-node'), null)
})

test('local image injection position keeps the existing three-column stagger', () => {
  assert.deepEqual(getLocalImageInjectPosition({ nodeCount: 0 }), { x: 220, y: 180 })
  assert.deepEqual(getLocalImageInjectPosition({ nodeCount: 4 }), { x: 340, y: 240 })
  assert.deepEqual(getLocalImageInjectPosition({ nodeCount: 8 }), { x: 460, y: 300 })
})

test('local image node data preserves injected file metadata and inferred dimensions', () => {
  assert.deepEqual(createLocalImageNodeData({
    dataUrl: 'data:image/png;base64,abc',
    file: { name: 'source.png', type: 'image/png' },
    dimensions: { width: 1920, height: 1080 }
  }), {
    url: 'data:image/png;base64,abc',
    base64: 'data:image/png;base64,abc',
    fileName: 'source.png',
    fileType: 'image/png',
    label: 'Image',
    ratio: '16:9',
    size: '1920x1080',
    loading: false,
    error: ''
  })

  assert.equal(createLocalImageNodeData({
    dataUrl: 'data:image/jpeg;base64,abc',
    file: { name: 'fallback.jpg', type: '' },
    dimensions: { width: 0, height: 720 }
  }).fileType, 'image/png')
})

test('image dimensions map to existing canvas ratio keys before falling back to custom dimensions', () => {
  assert.equal(getImageRatioFromDimensions(2048, 2048), '1:1')
  assert.equal(getImageRatioFromDimensions(1920, 1080), '16:9')
  assert.equal(getImageRatioFromDimensions(1080, 1920), '9:16')
  assert.equal(getImageRatioFromDimensions(1500, 1000), '3:2')
  assert.equal(getImageRatioFromDimensions(1000, 1500), '2:3')
  assert.equal(getImageRatioFromDimensions(1200, 800), '3:2')
  assert.equal(getImageRatioFromDimensions(997, 333), '997:333')
  assert.equal(getImageRatioFromDimensions(0, 333), '1:1')
})

test('node viewport rect helper preserves canvas fallback sizing', () => {
  assert.deepEqual(getNodeSize({ type: 'text' }), { width: 362, height: 330 })
  assert.deepEqual(getNodeSize({
    type: 'image',
    data: { ratio: '16:9' }
  }), { width: 422, height: 326 })
  assert.deepEqual(getNodeSize({
    type: 'image',
    data: { ratio: '7:3' }
  }), { width: 422, height: 270 })
  assert.deepEqual(getNodeSize({
    type: 'videoConfig'
  }), { width: 300, height: 350 })
  assert.deepEqual(getNodeSize({
    type: 'image',
    dimensions: { width: 512, height: 384 },
    data: { ratio: '1:1' }
  }), { width: 512, height: 384 })
})

test('node viewport rect helper converts flow nodes into screen rects', () => {
  assert.deepEqual(getNodeViewportRect({
    type: 'image',
    position: { x: 50, y: 30 },
    data: { ratio: '16:9' }
  }, { x: -100, y: 20, zoom: 2 }), {
    left: 0,
    top: 80,
    right: 844,
    bottom: 732
  })

  assert.deepEqual(getNodeViewportRect({
    type: 'text',
    computedPosition: { x: 10, y: 20 }
  }, { x: 5, y: -10, zoom: 0.5 }), {
    left: 10,
    top: 0,
    right: 191,
    bottom: 165
  })

  assert.equal(getNodeViewportRect(null, { x: 0, y: 0, zoom: 1 }), null)
})

test('overlay rect merging preserves canvas overlay padding', () => {
  assert.deepEqual(mergeViewportRects([
    { left: 100, top: 80, right: 200, bottom: 180 },
    { left: 240, top: 120, right: 300, bottom: 260 }
  ]), {
    left: 76,
    top: 58,
    width: 248,
    height: 224
  })

  assert.equal(mergeViewportRects([]), null)
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
