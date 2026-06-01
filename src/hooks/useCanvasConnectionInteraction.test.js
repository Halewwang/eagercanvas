import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { nextTick } from 'vue'

const hookUrl = new URL('./useCanvasConnectionInteraction.js', import.meta.url)
const vueUrl = import.meta.resolve('vue')
const hookSource = readFileSync(hookUrl, 'utf8')
  .replace("from 'vue'", `from '${vueUrl}'`)
const { useCanvasConnectionInteraction } = await import(`data:text/javascript;base64,${Buffer.from(hookSource).toString('base64')}`)

const createHarness = (overrides = {}) => {
  const calls = []
  const edgeStrategy = overrides.edgeStrategy || {
    resolve: (params) => ({ id: 'edge-1', ...params })
  }
  const interaction = useCanvasConnectionInteraction({
    addEdge: (edge) => calls.push(['add-edge', edge]),
    edgeStrategy,
    isConnectionValid: overrides.isConnectionValid || (() => true),
    manualSaveHistory: () => calls.push(['manual-save-history']),
    notify: {
      warning: (message) => calls.push(['warning', message])
    },
    refreshCanvasCollectionRefs: (collections) => calls.push(['refresh-refs', collections]),
    openConnectNodeMenu: (point, context) => calls.push(['open-connect-menu', point, context]),
    openPaneNodeMenu: (point) => calls.push(['open-pane-menu', point])
  })

  return {
    calls,
    interaction
  }
}

const createPointerEvent = (overrides = {}) => {
  const calls = []
  return {
    calls,
    event: {
      clientX: overrides.clientX ?? 320,
      clientY: overrides.clientY ?? 240,
      target: overrides.target || { closest: () => null },
      preventDefault: () => calls.push('prevent'),
      stopPropagation: () => calls.push('stop')
    }
  }
}

test('canvas connection interaction resolves valid edges and suppresses the connect menu after success', () => {
  const { calls, interaction } = createHarness()

  interaction.onConnectStart({
    nodeId: 'source-node',
    handleId: 'right',
    handleType: 'source',
    event: { clientX: 10, clientY: 20 }
  })
  interaction.onConnect({ source: 'source-node', target: 'target-node' })
  interaction.onConnectEnd({ clientX: 400, clientY: 360 })

  assert.deepEqual(calls, [
    ['add-edge', { id: 'edge-1', source: 'source-node', target: 'target-node' }]
  ])
})

test('canvas connection interaction opens the node menu when a connection is released on empty pane', () => {
  const { calls, interaction } = createHarness()

  interaction.onConnectStart({
    nodeId: 'source-node',
    handleId: 'right',
    handleType: 'source',
    event: { touches: [{ clientX: 20, clientY: 30 }] }
  })
  interaction.onConnectEnd({ changedTouches: [{ clientX: 420, clientY: 380 }] })

  assert.deepEqual(calls, [
    ['open-connect-menu', { x: 420, y: 380 }, {
      nodeId: 'source-node',
      handleId: 'right',
      handleType: 'source',
      startPoint: { x: 20, y: 30 }
    }]
  ])
})

test('canvas connection interaction warns and skips invalid connections', () => {
  const { calls, interaction } = createHarness({
    isConnectionValid: () => false
  })

  interaction.onConnectStart({
    nodeId: 'source-node',
    handleId: 'right',
    handleType: 'source'
  })
  interaction.onConnect({ source: 'source-node', target: 'target-node' })
  interaction.onConnectEnd({ clientX: 420, clientY: 380 })

  assert.deepEqual(calls, [
    ['warning', 'This connection is not supported for the selected modules']
  ])
})

test('canvas connection interaction opens pane menus and ignores context menus from interactive targets', () => {
  const { calls, interaction } = createHarness()
  const panePointer = createPointerEvent({ clientX: 500, clientY: 300 })

  interaction.onPaneContextMenu(panePointer.event)
  assert.deepEqual(panePointer.calls, ['prevent', 'stop'])
  assert.deepEqual(calls.splice(0), [
    ['open-pane-menu', { x: 500, y: 300 }]
  ])

  const ignoredPointer = createPointerEvent({
    target: { closest: () => ({}) }
  })
  interaction.handleCanvasContextMenu(ignoredPointer.event)
  assert.deepEqual(ignoredPointer.calls, [])
  assert.deepEqual(calls, [])

  const canvasPointer = createPointerEvent({ clientX: 640, clientY: 420 })
  interaction.handleCanvasContextMenu(canvasPointer.event)
  assert.deepEqual(canvasPointer.calls, ['prevent', 'stop'])
  assert.deepEqual(calls, [
    ['open-pane-menu', { x: 640, y: 420 }]
  ])
})

test('canvas connection interaction saves history after edge removals on the next tick', async () => {
  const { calls, interaction } = createHarness()

  interaction.onEdgesChange([{ type: 'select' }])
  assert.deepEqual(calls.splice(0), [['refresh-refs', { edges: true }]])
  await nextTick()
  assert.deepEqual(calls, [])

  interaction.onEdgesChange([{ type: 'remove', id: 'edge-1' }])
  assert.deepEqual(calls.splice(0), [['refresh-refs', { edges: true }]])
  await nextTick()
  assert.deepEqual(calls, [['manual-save-history']])
})
