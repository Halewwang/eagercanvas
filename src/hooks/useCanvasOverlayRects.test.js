import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { computed, ref } from 'vue'

const hookUrl = new URL('./useCanvasOverlayRects.js', import.meta.url)
const canvasInteractionUrl = new URL('../utils/canvasInteraction.js', import.meta.url)
const vueUrl = import.meta.resolve('vue')
const hookSource = readFileSync(hookUrl, 'utf8')
  .replace("from 'vue'", `from '${vueUrl}'`)
  .replace("from '@/utils/canvasInteraction'", `from '${canvasInteractionUrl.href}'`)
const { useCanvasOverlayRects } = await import(`data:text/javascript;base64,${Buffer.from(hookSource).toString('base64')}`)

const createHarness = (overrides = {}) => {
  const calls = []
  const rafCallbacks = []
  const timeoutCallbacks = []
  const selectedGroupId = ref(overrides.selectedGroupId ?? 'group-1')
  const nodes = ref(overrides.nodes || [
    { id: 'node-a', type: 'text', selected: true, position: { x: 0, y: 0 } },
    { id: 'node-b', type: 'text', position: { x: 420, y: 20 } },
    { id: 'node-c', type: 'text', selected: true, position: { x: 900, y: 40 } }
  ])
  const groups = ref(overrides.groups || [
    { id: 'group-1', name: 'Group One', nodeIds: ['node-a', 'node-b'] }
  ])
  const selectedNodeIds = computed(() =>
    nodes.value.filter((node) => node.selected || node.data?.selected).map((node) => node.id)
  )

  const overlay = useCanvasOverlayRects({
    canvasShellRef: ref({}),
    groups,
    isCanvasZooming: ref(false),
    isGroupDragging: overrides.isGroupDragging || (() => false),
    isNodeDragging: ref(false),
    nodes,
    selectedGroupId,
    selectedNodeIds,
    viewport: ref({ x: 0, y: 0, zoom: 1 }),
    nextTickFn: (callback) => {
      calls.push(['nextTick'])
      callback()
    },
    requestAnimationFrameFn: (callback) => {
      calls.push(['raf'])
      rafCallbacks.push(callback)
      return rafCallbacks.length
    },
    cancelAnimationFrameFn: (id) => calls.push(['cancel-raf', id]),
    setTimeoutFn: (callback, delay) => {
      calls.push(['timeout', delay])
      timeoutCallbacks.push(callback)
      return timeoutCallbacks.length
    },
    clearTimeoutFn: (id) => calls.push(['clear-timeout', id]),
    recordPerf: (label, startedAt, details) => calls.push(['perf', label, details])
  })

  return {
    calls,
    groups,
    nodes,
    overlay,
    rafCallbacks,
    selectedGroupId,
    timeoutCallbacks
  }
}

test('canvas overlay rects derive group, selected group, body hit, and multiselect overlays', () => {
  const { overlay, selectedGroupId } = createHarness()

  overlay.updateOverlayRects()

  assert.equal(overlay.renderedGroups.value.length, 1)
  assert.equal(overlay.renderedGroups.value[0].id, 'group-1')
  assert.deepEqual(overlay.selectedGroupMenuRect.value, overlay.groupRects.value['group-1'])
  assert.equal(overlay.groupBodyHitRectsById.value['group-1'].length > 0, true)
  assert.equal(overlay.multiSelectMenuRect.value, null)

  selectedGroupId.value = null

  assert.deepEqual(overlay.multiSelectMenuRect.value, overlay.multiSelectRect.value)
  assert.deepEqual(overlay.groupBodyHitRectsById.value, {})
})

test('canvas overlay rects schedule measurement, skip while dragging, and cleanup pending work', () => {
  let dragging = true
  const { calls, overlay, rafCallbacks } = createHarness({
    isGroupDragging: () => dragging
  })

  overlay.scheduleOverlayRectUpdate()
  assert.deepEqual(calls, [])

  overlay.scheduleOverlayRectUpdate({ force: true })
  assert.deepEqual(calls.splice(0), [
    ['nextTick'],
    ['raf']
  ])

  rafCallbacks.shift()()
  assert.equal(overlay.renderedGroups.value.length, 1)
  assert.deepEqual(calls.filter((call) => call[0] === 'perf'), [
    ['perf', 'overlay-rects', { nodeCount: 3, groupCount: 1 }]
  ])

  dragging = false
  overlay.scheduleOverlayRectUpdate()
  overlay.cleanupOverlayRectUpdates()

  assert.deepEqual(calls.slice(-3), [
    ['nextTick'],
    ['raf'],
    ['cancel-raf', 1]
  ])
})
