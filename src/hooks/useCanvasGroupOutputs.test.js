import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { nextTick, ref } from 'vue'

const hookUrl = new URL('./useCanvasGroupOutputs.js', import.meta.url)
const canvasInteractionUrl = new URL('../utils/canvasInteraction.js', import.meta.url)
const vueUrl = import.meta.resolve('vue')
const hookSource = readFileSync(hookUrl, 'utf8')
  .replace("from 'vue'", `from '${vueUrl}'`)
  .replace("from '@/utils/canvasInteraction'", `from '${canvasInteractionUrl.href}'`)
const { useCanvasGroupOutputs } = await import(`data:text/javascript;base64,${Buffer.from(hookSource).toString('base64')}`)

test('canvas group outputs use the shared auto placement helper', () => {
  assert.match(hookSource, /getCanvasAutoPlacementPosition/)
})

const createEventTarget = () => {
  const listeners = new Map()

  return {
    addEventListener(name, handler) {
      listeners.set(name, handler)
    },
    dispatch(name, event) {
      return listeners.get(name)?.(event)
    },
    has(name) {
      return listeners.has(name)
    },
    removeEventListener(name, handler) {
      if (listeners.get(name) === handler) listeners.delete(name)
    }
  }
}

const createPointerEvent = (overrides = {}) => {
  const calls = []
  return {
    calls,
    event: {
      type: overrides.type || 'pointerdown',
      button: overrides.button ?? 0,
      pointerId: overrides.pointerId ?? 8,
      clientX: overrides.clientX ?? 400,
      clientY: overrides.clientY ?? 180,
      preventDefault: () => calls.push('prevent'),
      stopPropagation: () => calls.push('stop')
    }
  }
}

const createHarness = (overrides = {}) => {
  const calls = []
  const eventTarget = createEventTarget()
  const group = { id: 'group-1', nodeIds: ['node-a'] }
  const groupRects = ref({
    'group-1': { left: 100, top: 80, width: 300, height: 200 }
  })
  const nodes = ref([{ id: 'node-a', type: 'text', position: { x: 0, y: 0 } }])
  const renderedGroups = ref([{ ...group, rect: groupRects.value['group-1'] }])
  let createdNodeIndex = 0

  const outputs = useCanvasGroupOutputs({
    addGroupOutputLink: (groupId, targetNodeId, options) => {
      calls.push(['add-link', groupId, targetNodeId, options])
      return `link-${targetNodeId}`
    },
    addNode: (type, position, data, options) => {
      createdNodeIndex += 1
      const nodeId = `image-${createdNodeIndex}`
      calls.push(['add-node', type, position, data, options])
      nodes.value.push({ id: nodeId, type, position, data })
      return nodeId
    },
    groupRects,
    isReadOnlyProject: ref(overrides.readOnly ?? false),
    nodes,
    notify: {
      success: (message) => calls.push(['success', message])
    },
    renderedGroups,
    removeNodesByIds: (nodeIds, saveHistory) => calls.push(['remove-nodes', nodeIds, saveHistory]),
    scheduleOverlayRectUpdate: (options) => calls.push(['schedule', options]),
    updateNodeInternals: (nodeId) => calls.push(['update-internals', nodeId]),
    viewport: ref({ x: 0, y: 0, zoom: 2 }),
    warnReadOnly: () => calls.push(['warn-read-only']),
    eventTarget
  })

  return {
    calls,
    eventTarget,
    group,
    outputs
  }
}

test('canvas group outputs drag a pending group line and create an image output at the release point', async () => {
  const { calls, eventTarget, group, outputs } = createHarness()
  const { calls: eventCalls, event } = createPointerEvent({
    clientX: 400,
    clientY: 180,
    pointerId: 4
  })

  outputs.handleGroupOutputPointerDown(group, event)

  assert.deepEqual(eventCalls, ['prevent', 'stop'])
  assert.equal(eventTarget.has('pointermove'), true)
  assert.deepEqual(outputs.pendingGroupOutputLine.value, {
    id: 'pending-group-output-group-1',
    groupId: 'group-1',
    pending: true,
    source: { x: 400, y: 180 },
    target: { x: 400, y: 180 }
  })

  eventTarget.dispatch('pointermove', {
    type: 'pointermove',
    pointerId: 4,
    clientX: 700,
    clientY: 420
  })

  assert.deepEqual(outputs.pendingGroupOutputLine.value.target, { x: 700, y: 420 })

  await eventTarget.dispatch('pointerup', {
    type: 'pointerup',
    pointerId: 4,
    clientX: 760,
    clientY: 460
  })
  await nextTick()

  assert.equal(eventTarget.has('pointermove'), false)
  assert.equal(outputs.pendingGroupOutputLine.value, null)
  assert.deepEqual(calls, [
    ['add-node', 'image', { x: 760, y: 120 }, { label: '图片输出' }, { saveHistory: false }],
    ['add-link', 'group-1', 'image-1', { saveHistory: true }],
    ['update-internals', 'image-1'],
    ['schedule', { force: true }],
    ['success', '已创建下游图片节点']
  ])
})

test('canvas group outputs keep click creation as a default placement without opening normal edges', async () => {
  const { calls, eventTarget, group, outputs } = createHarness()
  const { event } = createPointerEvent()

  outputs.handleGroupOutputPointerDown(group, event)
  await eventTarget.dispatch('pointerup', {
    type: 'pointerup',
    pointerId: 8,
    clientX: 401,
    clientY: 181
  })
  await nextTick()

  assert.deepEqual(calls, [
    ['add-node', 'image', { x: 680, y: 40 }, { label: '图片输出' }, { saveHistory: false }],
    ['add-link', 'group-1', 'image-1', { saveHistory: true }],
    ['update-internals', 'image-1'],
    ['schedule', { force: true }],
    ['success', '已创建下游图片节点']
  ])
})

test('canvas group outputs block pointer creation in read-only projects', () => {
  const { calls, eventTarget, group, outputs } = createHarness({ readOnly: true })
  const { event } = createPointerEvent()

  outputs.handleGroupOutputPointerDown(group, event)

  assert.deepEqual(calls, [['warn-read-only']])
  assert.equal(eventTarget.has('pointermove'), false)
  assert.equal(outputs.pendingGroupOutputLine.value, null)
})
