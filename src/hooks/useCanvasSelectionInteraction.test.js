import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { ref } from 'vue'

const hookUrl = new URL('./useCanvasSelectionInteraction.js', import.meta.url)
const vueUrl = import.meta.resolve('vue')
const hookSource = readFileSync(hookUrl, 'utf8')
  .replace("from 'vue'", `from '${vueUrl}'`)
const { useCanvasSelectionInteraction } = await import(`data:text/javascript;base64,${Buffer.from(hookSource).toString('base64')}`)

const createHarness = (overrides = {}) => {
  const calls = []
  const nodes = ref(overrides.nodes || [
    { id: 'node-1', selected: true, data: { selected: false, openPortMenu: 'out' } },
    { id: 'node-2', selected: false, data: { selected: true } },
    { id: 'node-3', selected: false, data: {} }
  ])
  const edges = ref(overrides.edges || [
    { id: 'edge-1', selected: true },
    { id: 'edge-2', selected: false }
  ])
  const groups = ref(overrides.groups || [
    { id: 'group-1', nodeIds: ['node-1', 'node-3'] }
  ])
  const selectedGroupId = ref(overrides.selectedGroupId ?? 'group-1')
  const selectedGroupOutputLinkId = ref(overrides.selectedGroupOutputLinkId ?? '')
  const showNodeMenu = ref(overrides.showNodeMenu ?? true)
  const suppressPaneClickUntil = ref(overrides.suppressPaneClickUntil ?? 0)

  const selection = useCanvasSelectionInteraction({
    nodes,
    edges,
    groups,
    selectedGroupId,
    selectedGroupOutputLinkId,
    showNodeMenu,
    suppressPaneClickUntil,
    clearNodeMenuContext: () => calls.push(['clear-node-menu']),
    handleDeleteSelectedGroup: () => calls.push(['delete-group']),
    manualSaveHistory: () => calls.push(['manual-save-history']),
    removeNodesByIds: (ids, saveHistory) => calls.push(['remove-nodes', ids, saveHistory]),
    removeGroupOutputLinkById: (id, options) => {
      calls.push(['remove-group-output-link', id, options])
      return overrides.removeGroupOutputLinkResult ?? true
    },
    nowFn: () => overrides.now ?? 1000
  })

  return {
    calls,
    edges,
    groups,
    nodes,
    selectedGroupId,
    selectedGroupOutputLinkId,
    selection,
    showNodeMenu,
    suppressPaneClickUntil
  }
}

test('canvas selection interaction derives and clears node and group selection', () => {
  const { nodes, selectedGroupId, selection } = createHarness()

  assert.deepEqual(selection.selectedNodeIds.value, ['node-1', 'node-2'])
  assert.equal(selection.selectedGroup.value.id, 'group-1')

  selection.clearNodeSelection()
  assert.deepEqual(nodes.value.map((node) => ({
    id: node.id,
    selected: node.selected,
    dataSelected: node.data.selected,
    openPortMenu: node.data.openPortMenu
  })), [
    { id: 'node-1', selected: false, dataSelected: false, openPortMenu: null },
    { id: 'node-2', selected: false, dataSelected: false, openPortMenu: null },
    { id: 'node-3', selected: false, dataSelected: false, openPortMenu: null }
  ])

  selection.clearGroupSelection()
  assert.equal(selectedGroupId.value, null)
})

test('canvas selection interaction syncs VueFlow selection flags and suppresses capsules', () => {
  const { nodes, selection } = createHarness({
    nodes: [
      { id: 'node-1', selected: true, data: { selected: false } },
      { id: 'node-2', selected: true, data: { selected: false } },
      { id: 'node-3', selected: false, data: { selected: true } }
    ]
  })

  selection.syncNodeSelectedState()

  assert.deepEqual(nodes.value.map((node) => ({
    id: node.id,
    selected: node.data.selected,
    suppressCapsule: node.data.suppressCapsule
  })), [
    { id: 'node-1', selected: true, suppressCapsule: true },
    { id: 'node-2', selected: true, suppressCapsule: true },
    { id: 'node-3', selected: false, suppressCapsule: false }
  ])
})

test('canvas selection interaction owns pane click and delete/backspace behavior', () => {
  const { calls, edges, nodes, selectedGroupId, selectedGroupOutputLinkId, selection, showNodeMenu } = createHarness()

  selection.onNodeClick()
  assert.equal(selectedGroupId.value, null)
  assert.equal(selectedGroupOutputLinkId.value, '')
  assert.equal(showNodeMenu.value, false)
  assert.deepEqual(calls.splice(0), [['clear-node-menu']])

  selectedGroupOutputLinkId.value = 'group-output-1'
  selection.onPaneClick()
  assert.equal(selectedGroupOutputLinkId.value, '')
  assert.equal(showNodeMenu.value, false)
  assert.equal(nodes.value.every((node) => !node.selected && !node.data.selected && node.data.openPortMenu === null), true)
  assert.deepEqual(calls.splice(0), [['clear-node-menu']])

  nodes.value[0].selected = true
  nodes.value[1].data.selected = true
  selectedGroupId.value = ''
  selection.handleGlobalKeydown({ key: 'Delete', target: { tagName: 'div' } })

  assert.deepEqual(calls.splice(0), [
    ['remove-nodes', ['node-1', 'node-2'], false],
    ['manual-save-history']
  ])
  assert.deepEqual(edges.value, [{ id: 'edge-2', selected: false }])

  selectedGroupId.value = 'group-1'
  let prevented = false
  selection.handleGlobalKeydown({
    key: 'Backspace',
    preventDefault: () => {
      prevented = true
    },
    target: { tagName: 'div' }
  })
  assert.equal(prevented, true)
  assert.deepEqual(calls.splice(0), [['delete-group']])
})

test('canvas selection interaction deletes a selected group output link without touching nodes or edges', () => {
  const { calls, edges, nodes, selectedGroupId, selectedGroupOutputLinkId, selection } = createHarness({
    selectedGroupId: '',
    selectedGroupOutputLinkId: 'group-output-1'
  })

  let prevented = false
  selection.handleGlobalKeydown({
    key: 'Delete',
    preventDefault: () => {
      prevented = true
    },
    target: { tagName: 'div' }
  })

  assert.equal(prevented, true)
  assert.equal(selectedGroupOutputLinkId.value, '')
  assert.equal(selectedGroupId.value, '')
  assert.deepEqual(calls.splice(0), [
    ['remove-group-output-link', 'group-output-1', { saveHistory: true }]
  ])
  assert.deepEqual(edges.value.map((edge) => edge.id), ['edge-1', 'edge-2'])
  assert.deepEqual(nodes.value.map((node) => node.id), ['node-1', 'node-2', 'node-3'])
})

test('canvas selection interaction keeps group output line selected through the pane click follow-up', () => {
  const { calls, selectedGroupOutputLinkId, selection, suppressPaneClickUntil } = createHarness()

  selection.selectGroupOutputLink('group-output-1')
  assert.equal(selectedGroupOutputLinkId.value, 'group-output-1')
  assert.equal(suppressPaneClickUntil.value, 1250)

  selection.onPaneClick()
  assert.equal(selectedGroupOutputLinkId.value, 'group-output-1')
  assert.deepEqual(calls.splice(0), [['clear-node-menu']])
})

test('canvas selection interaction ignores pane suppression and typing targets', () => {
  const { calls, selection, showNodeMenu } = createHarness({
    suppressPaneClickUntil: 2000
  })

  selection.onPaneClick()
  assert.equal(showNodeMenu.value, true)
  assert.deepEqual(calls, [])

  selection.handleGlobalKeydown({
    key: 'Delete',
    target: {
      tagName: 'textarea',
      closest: () => null
    }
  })
  assert.deepEqual(calls, [])
})
