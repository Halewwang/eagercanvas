import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { ref } from 'vue'

const hookUrl = new URL('./useCanvasGroupDrag.js', import.meta.url)
const canvasInteractionUrl = new URL('../utils/canvasInteraction.js', import.meta.url)
const hookSource = readFileSync(hookUrl, 'utf8')
  .replace("from '@/utils/canvasInteraction'", `from '${canvasInteractionUrl.href}'`)
const { useCanvasGroupDrag } = await import(`data:text/javascript;base64,${Buffer.from(hookSource).toString('base64')}`)

const createEventTarget = () => {
  const listeners = new Map()

  return {
    addEventListener(name, handler) {
      listeners.set(name, handler)
    },
    dispatch(name, event) {
      listeners.get(name)?.(event)
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
      pointerId: overrides.pointerId ?? 7,
      clientX: overrides.clientX ?? 100,
      clientY: overrides.clientY ?? 100,
      target: overrides.target || null,
      preventDefault: () => calls.push('prevent'),
      stopPropagation: () => calls.push('stop')
    }
  }
}

const createHarness = () => {
  const calls = []
  const eventTarget = createEventTarget()
  const groups = ref([{ id: 'group-1', nodeIds: ['node-a', 'node-b'] }])
  const nodes = ref([
    { id: 'node-a', type: 'text', position: { x: 0, y: 0 } },
    { id: 'node-b', type: 'text', position: { x: 420, y: 20 } }
  ])
  const groupRects = ref({
    'group-1': { left: 80, top: 70, width: 740, height: 390 }
  })
  const selectedGroupId = ref('')
  const viewport = ref({ x: 0, y: 0, zoom: 2 })

  const drag = useCanvasGroupDrag({
    groups,
    nodes,
    groupRects,
    selectedGroupId,
    viewport,
    selectGroup: (groupId) => {
      calls.push(['select', groupId])
      selectedGroupId.value = groupId
    },
    beginNodeDragInteraction: () => calls.push(['begin-drag']),
    endNodeDragInteraction: (options) => calls.push(['end-drag', options]),
    translateNodesByIds: (nodeIds, delta, saveHistory) => {
      calls.push(['translate', nodeIds, delta, saveHistory])
    },
    scheduleOverlayRectUpdate: (options) => calls.push(['schedule', options]),
    eventTarget
  })

  return {
    calls,
    drag,
    eventTarget,
    groupRects,
    groups,
    selectedGroupId
  }
}

test('canvas group drag owns listener lifecycle, movement, rect translation, and history flag', () => {
  const { calls, drag, eventTarget, groupRects, groups, selectedGroupId } = createHarness()
  const { calls: eventCalls, event } = createPointerEvent({
    clientX: 120,
    clientY: 140,
    pointerId: 9
  })

  drag.startGroupDrag(groups.value[0], event)

  assert.equal(selectedGroupId.value, 'group-1')
  assert.deepEqual(eventCalls, ['prevent', 'stop'])
  assert.equal(drag.isGroupDragging(), true)
  assert.equal(eventTarget.has('pointermove'), true)
  assert.equal(eventTarget.has('mousemove'), true)
  assert.deepEqual(calls.splice(0), [
    ['select', 'group-1'],
    ['begin-drag']
  ])

  eventTarget.dispatch('pointermove', {
    type: 'pointermove',
    pointerId: 9,
    clientX: 150,
    clientY: 160
  })

  assert.deepEqual(calls.splice(0), [
    ['translate', ['node-a', 'node-b'], { x: 15, y: 10 }, false]
  ])
  assert.deepEqual(groupRects.value['group-1'], {
    left: 110,
    top: 90,
    width: 740,
    height: 390
  })

  eventTarget.dispatch('pointerup', { type: 'pointerup', pointerId: 9 })

  assert.equal(drag.isGroupDragging(), false)
  assert.equal(eventTarget.has('pointermove'), false)
  assert.deepEqual(calls.splice(0), [
    ['end-drag', { saveHistory: true }],
    ['schedule', { force: true }]
  ])
})

test('canvas group drag starts from blank group body and ignores interactive targets', () => {
  const { calls, drag, eventTarget, selectedGroupId } = createHarness()
  const ignoredTarget = { closest: () => ({}) }
  const ignoredPointer = createPointerEvent({
    clientX: 790,
    clientY: 450,
    target: ignoredTarget
  })

  drag.handleCanvasPointerDownCapture(ignoredPointer.event)

  assert.equal(selectedGroupId.value, '')
  assert.deepEqual(ignoredPointer.calls, [])
  assert.deepEqual(calls, [])

  const { calls: eventCalls, event } = createPointerEvent({
    clientX: 790,
    clientY: 450,
    target: { closest: () => null }
  })

  drag.handleCanvasPointerDownCapture(event)

  assert.equal(selectedGroupId.value, 'group-1')
  assert.deepEqual(eventCalls, ['prevent', 'stop'])
  assert.equal(eventTarget.has('pointermove'), true)
  assert.deepEqual(calls.splice(0), [
    ['select', 'group-1'],
    ['begin-drag']
  ])

  drag.stopGroupDrag()

  assert.deepEqual(calls.splice(0), [
    ['end-drag', { saveHistory: false }],
    ['schedule', { force: true }]
  ])
})
