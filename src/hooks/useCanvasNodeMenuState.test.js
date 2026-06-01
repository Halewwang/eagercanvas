import assert from 'node:assert/strict'
import test from 'node:test'

import { useCanvasNodeMenuState } from './useCanvasNodeMenuState.js'

test('canvas node menu state owns labels, count bounds, and toolbar toggle behavior', () => {
  const menu = useCanvasNodeMenuState({
    getFlowPointFromScreenPoint: (point) => ({ x: point.x - 10, y: point.y - 20 })
  })

  assert.equal(menu.showNodeMenu.value, false)
  assert.equal(menu.nodeMenuMode.value, 'toolbar')
  assert.equal(menu.nodeMenuTitle.value, 'Choose A Base Module')
  assert.equal(menu.nodeMenuCopy.value, 'Pick a module type, then add between 1 and 5 modules at once.')
  assert.deepEqual(menu.nodeTypeOptions.map((item) => item.type), ['text', 'image', 'video'])

  menu.decreaseNodeCount()
  assert.equal(menu.nodeCreateCount.value, 1)
  for (let index = 0; index < 8; index += 1) menu.increaseNodeCount()
  assert.equal(menu.nodeCreateCount.value, 5)
  menu.decreaseNodeCount()
  assert.equal(menu.nodeCreateCount.value, 4)

  menu.toggleToolbarNodeMenu()
  assert.equal(menu.showNodeMenu.value, true)
  menu.toggleToolbarNodeMenu()
  assert.equal(menu.showNodeMenu.value, false)
  assert.equal(menu.nodeMenuMode.value, 'toolbar')
})

test('canvas node menu state opens connect and pane menus with flow coordinates', () => {
  const cleared = []
  const menu = useCanvasNodeMenuState({
    getFlowPointFromScreenPoint: (point) => ({ x: point.x / 2, y: point.y / 2 }),
    clearGroupSelection: () => cleared.push('group'),
    clearNodeSelection: () => cleared.push('node')
  })

  menu.openConnectNodeMenu({ x: 80, y: 120 }, {
    nodeId: 'node-1',
    handleId: 'source',
    handleType: 'source'
  })

  assert.equal(menu.showNodeMenu.value, true)
  assert.equal(menu.nodeMenuMode.value, 'connect')
  assert.equal(menu.nodeMenuTitle.value, 'Create And Link A Module')
  assert.deepEqual(menu.nodeMenuScreenPosition.value, { x: 92, y: 108 })
  assert.deepEqual(menu.pendingConnectMenuContext.value, {
    nodeId: 'node-1',
    handleId: 'source',
    handleType: 'source',
    flowPosition: { x: 40, y: 60 }
  })
  assert.equal(menu.pendingPaneCreatePosition.value, null)

  menu.openPaneNodeMenu({ x: 180, y: 220 })

  assert.equal(menu.showNodeMenu.value, true)
  assert.equal(menu.nodeMenuMode.value, 'pane')
  assert.equal(menu.nodeMenuTitle.value, 'Create Module')
  assert.deepEqual(menu.pendingPaneCreatePosition.value, { x: 90, y: 110 })
  assert.equal(menu.pendingConnectMenuContext.value, null)
  assert.deepEqual(cleared, ['group', 'node'])

  menu.clearNodeMenuContext()
  assert.equal(menu.nodeMenuMode.value, 'toolbar')
  assert.equal(menu.nodeMenuScreenPosition.value, null)
  assert.equal(menu.pendingPaneCreatePosition.value, null)
  assert.equal(menu.pendingConnectMenuContext.value, null)
})

test('canvas node menu state clamps floating menu style to the viewport', () => {
  const originalWindow = global.window
  global.window = {
    innerWidth: 420,
    innerHeight: 360
  }

  try {
    const menu = useCanvasNodeMenuState()
    menu.nodeMenuScreenPosition.value = { x: 999, y: -40 }

    assert.deepEqual(menu.nodeMenuStyle.value, {
      left: '92px',
      top: '18px'
    })
  } finally {
    global.window = originalWindow
  }
})
