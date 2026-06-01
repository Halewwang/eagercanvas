import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { ref } from 'vue'

const hookUrl = new URL('./useCanvasViewportInteraction.js', import.meta.url)
const canvasInteractionUrl = new URL('../utils/canvasInteraction.js', import.meta.url)
const vueUrl = import.meta.resolve('vue')
const hookSource = readFileSync(hookUrl, 'utf8')
  .replace("from 'vue'", `from '${vueUrl}'`)
  .replace("from '@/utils/canvasInteraction'", `from '${canvasInteractionUrl.href}'`)
const { useCanvasViewportInteraction } = await import(`data:text/javascript;base64,${Buffer.from(hookSource).toString('base64')}`)

const createHarness = (overrides = {}) => {
  const calls = []
  const timeoutCallbacks = []
  const viewport = ref(overrides.viewport || { x: 0, y: 0, zoom: 1 })
  const isCanvasZooming = ref(overrides.isCanvasZooming ?? false)
  const showGrid = ref(overrides.showGrid ?? true)

  const interaction = useCanvasViewportInteraction({
    viewport,
    isCanvasZooming,
    showGrid,
    beginCanvasZoomInteraction: () => calls.push(['begin-zoom']),
    endCanvasZoomInteraction: () => calls.push(['end-zoom']),
    updateViewport: (nextViewport, options) => {
      calls.push(['update-viewport', nextViewport, options])
      viewport.value = nextViewport
    },
    scheduleOverlayRectUpdate: (options) => calls.push(['schedule-overlay', options]),
    nowFn: () => 1000,
    recordPerf: (label, startedAt, details) => calls.push(['perf', label, startedAt, details]),
    setTimeoutFn: (callback, delay) => {
      calls.push(['set-timeout', delay])
      timeoutCallbacks.push(callback)
      return timeoutCallbacks.length
    },
    clearTimeoutFn: (id) => calls.push(['clear-timeout', id])
  })

  return {
    calls,
    interaction,
    isCanvasZooming,
    showGrid,
    timeoutCallbacks,
    viewport
  }
}

test('canvas viewport interaction owns grid style and freezes it while zooming', () => {
  const { interaction, isCanvasZooming, showGrid, viewport } = createHarness()

  assert.equal(interaction.canvasFlowStyle.value['--node-capsule-scale'], '1')
  assert.equal(interaction.canvasFlowStyle.value['--canvas-grid-image'], 'radial-gradient(rgba(255,255,255,0.05) 1px, transparent 1px)')
  assert.equal(interaction.canvasFlowStyle.value['--canvas-grid-size'], '20px 20px')
  assert.equal(interaction.canvasFlowStyle.value['--canvas-grid-position'], '0px 0px')

  isCanvasZooming.value = true
  viewport.value = { x: -5, y: 31, zoom: 2 }
  assert.equal(interaction.canvasFlowStyle.value['--canvas-grid-size'], '20px 20px')

  isCanvasZooming.value = false
  assert.equal(interaction.canvasFlowStyle.value['--node-capsule-scale'], '0.82')
  assert.equal(interaction.canvasFlowStyle.value['--canvas-grid-size'], '40px 40px')
  assert.equal(interaction.canvasFlowStyle.value['--canvas-grid-position'], '35px 31px')

  showGrid.value = false
  assert.equal(interaction.canvasFlowStyle.value['--canvas-grid-image'], 'none')
})

test('canvas viewport interaction persists settled viewport and clears pending timers', () => {
  const { calls, interaction, timeoutCallbacks, viewport } = createHarness()

  interaction.handleViewportChange({ x: 10, y: 20, zoom: 1.5 })

  assert.deepEqual(calls, [
    ['begin-zoom'],
    ['update-viewport', { x: 10, y: 20, zoom: 1.5 }, { persist: false }],
    ['schedule-overlay', undefined],
    ['perf', 'viewport-change', 1000, { zoom: 1.5 }],
    ['set-timeout', 220]
  ])

  interaction.handleViewportChange({ x: 12, y: 24, zoom: 1.6 })
  assert.deepEqual(calls.slice(-6), [
    ['begin-zoom'],
    ['update-viewport', { x: 12, y: 24, zoom: 1.6 }, { persist: false }],
    ['schedule-overlay', undefined],
    ['perf', 'viewport-change', 1000, { zoom: 1.6 }],
    ['clear-timeout', 1],
    ['set-timeout', 220]
  ])

  timeoutCallbacks.at(-1)()

  assert.deepEqual(calls.slice(-3), [
    ['update-viewport', viewport.value, { persist: true }],
    ['end-zoom'],
    ['schedule-overlay', { force: true }]
  ])

  interaction.handleViewportChange({ x: 20, y: 40, zoom: 2 })
  interaction.clearViewportSettleTimer()

  assert.deepEqual(calls.slice(-2), [
    ['set-timeout', 220],
    ['clear-timeout', 3]
  ])
})
