import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { nextTick, ref } from 'vue'

const hookUrl = new URL('./useCanvasNodeDragInteraction.js', import.meta.url)
const vueUrl = import.meta.resolve('vue')
const hookSource = readFileSync(hookUrl, 'utf8')
  .replace("from 'vue'", `from '${vueUrl}'`)
const { useCanvasNodeDragInteraction } = await import(`data:text/javascript;base64,${Buffer.from(hookSource).toString('base64')}`)

const createHarness = (overrides = {}) => {
  const calls = []
  const groups = ref(overrides.groups || [
    { id: 'group-1', nodeIds: ['node-a', 'node-b', 'missing-node'] }
  ])
  const nodes = ref(overrides.nodes || [
    { id: 'node-a', position: { x: 10, y: 20 } },
    { id: 'node-b', position: { x: 80, y: 120 } }
  ])
  const selectedNodeIds = ref(overrides.selectedNodeIds || [])
  const isNodeDragging = ref(overrides.isNodeDragging ?? true)

  const interaction = useCanvasNodeDragInteraction({
    nodes,
    groups,
    selectedNodeIds,
    isNodeDragging,
    beginNodeDragInteraction: () => calls.push(['begin-drag']),
    endNodeDragInteraction: (options) => calls.push(['end-drag', options]),
    refreshCanvasCollectionRefs: (collections) => calls.push(['refresh-refs', collections]),
    translateNodesByIds: (ids, delta, saveHistory) => calls.push(['translate', ids, delta, saveHistory]),
    getGroupMergeCandidateForNode: (nodeId) => overrides.mergeCandidateByNodeId?.[nodeId] || null,
    setGroupMergeCandidateId: (groupId) => calls.push(['set-merge-candidate', groupId]),
    addNodesToGroup: (groupId, nodeIds, options) => calls.push(['add-nodes-to-group', groupId, nodeIds, options]),
    syncNodeSelectedState: () => calls.push(['sync-selection']),
    clearGroupSelection: () => calls.push(['clear-group-selection']),
    scheduleOverlayRectUpdate: (options) => calls.push(['schedule', options])
  })

  return {
    calls,
    groups,
    interaction,
    isNodeDragging,
    nodes,
    selectedNodeIds
  }
}

test('canvas node drag interaction highlights and commits external node group merge candidate', async () => {
  const { calls, interaction } = createHarness({
    groups: [{ id: 'group-1', nodeIds: ['node-a', 'node-b'] }],
    nodes: [
      { id: 'node-a', position: { x: 10, y: 20 } },
      { id: 'node-b', position: { x: 80, y: 120 } },
      { id: 'node-c', position: { x: 240, y: 120 } }
    ],
    mergeCandidateByNodeId: {
      'node-c': { id: 'group-1' }
    }
  })

  interaction.onNodeDragStart(null, { id: 'node-c' })
  assert.deepEqual(calls.splice(0), [
    ['set-merge-candidate', null],
    ['begin-drag']
  ])

  interaction.onNodesChange([
    { type: 'position', id: 'node-c', position: { x: 120, y: 120 } }
  ])
  await nextTick()
  assert.deepEqual(calls.splice(0), [
    ['refresh-refs', { nodes: true }],
    ['set-merge-candidate', 'group-1'],
    ['schedule', undefined]
  ])

  interaction.onNodeDragStop()
  assert.deepEqual(calls.splice(0), [
    ['add-nodes-to-group', 'group-1', ['node-c'], { saveHistory: false }],
    ['set-merge-candidate', null],
    ['end-drag', { saveHistory: true, changeType: 'content' }],
    ['schedule', { force: true }]
  ])
})

test('canvas node drag interaction infers dragged node id from position changes when drag start payload is narrow', async () => {
  const { calls, interaction } = createHarness({
    groups: [{ id: 'group-1', nodeIds: ['node-a', 'node-b'] }],
    nodes: [
      { id: 'node-a', position: { x: 10, y: 20 } },
      { id: 'node-b', position: { x: 80, y: 120 } },
      { id: 'node-c', position: { x: 240, y: 120 } }
    ],
    mergeCandidateByNodeId: {
      'node-c': { id: 'group-1' }
    }
  })

  interaction.onNodeDragStart({ event: 'pointerdown' })
  assert.deepEqual(calls.splice(0), [
    ['set-merge-candidate', null],
    ['begin-drag']
  ])

  interaction.onNodesChange([
    { type: 'position', id: 'node-c', position: { x: 120, y: 120 } }
  ])
  await nextTick()
  assert.deepEqual(calls.splice(0), [
    ['refresh-refs', { nodes: true }],
    ['set-merge-candidate', 'group-1'],
    ['schedule', undefined]
  ])

  interaction.onNodeDragStop()
  assert.deepEqual(calls.splice(0), [
    ['add-nodes-to-group', 'group-1', ['node-c'], { saveHistory: false }],
    ['set-merge-candidate', null],
    ['end-drag', { saveHistory: true, changeType: 'content' }],
    ['schedule', { force: true }]
  ])
})

test('canvas node drag interaction keeps grouped node drag local and saves history on drag stop', async () => {
  const { calls, interaction } = createHarness()

  interaction.onNodeDragStart(null, { id: 'node-a' })
  assert.deepEqual(calls.splice(0), [['begin-drag']])

  interaction.onNodesChange([
    { type: 'position', id: 'node-a', position: { x: 25, y: 45 } }
  ])
  await nextTick()
  assert.deepEqual(calls.splice(0), [
    ['refresh-refs', { nodes: true }],
    ['schedule', undefined]
  ])

  interaction.onNodesChange([
    { type: 'position', id: 'node-a', position: { x: 35, y: 50 } }
  ])
  await nextTick()
  assert.deepEqual(calls.splice(0), [
    ['refresh-refs', { nodes: true }],
    ['schedule', undefined]
  ])

  interaction.onNodeDragStop()
  assert.deepEqual(calls.splice(0), [
    ['end-drag', { saveHistory: true, changeType: 'node-position' }],
    ['schedule', { force: true }]
  ])
})

test('canvas node drag interaction keeps grouped node drag local when Vue Flow reports sibling position changes', async () => {
  const { calls, interaction } = createHarness()

  interaction.onNodeDragStart(null, { id: 'node-a' })
  calls.splice(0)
  interaction.onNodesChange([
    { type: 'position', id: 'node-a', position: { x: 25, y: 45 } },
    { type: 'position', id: 'node-b', position: { x: 95, y: 145 } }
  ])
  await nextTick()

  assert.deepEqual(calls.splice(0), [
    ['refresh-refs', { nodes: true }],
    ['schedule', undefined]
  ])
  interaction.onNodeDragStop()
  assert.deepEqual(calls.splice(0), [
    ['end-drag', { saveHistory: true, changeType: 'node-position' }],
    ['schedule', { force: true }]
  ])
})

test('canvas node drag interaction syncs selection on non-position changes and avoids history without movement', async () => {
  const { calls, interaction } = createHarness({
    selectedNodeIds: ['node-a'],
    isNodeDragging: false
  })

  interaction.onNodeDragStart(null, { id: 'node-a' })
  assert.deepEqual(calls.splice(0), [['begin-drag']])

  interaction.onNodesChange([
    { type: 'select', id: 'node-a', selected: true }
  ])
  await nextTick()
  assert.deepEqual(calls.splice(0), [
    ['refresh-refs', { nodes: true }],
    ['sync-selection'],
    ['clear-group-selection'],
    ['schedule', undefined]
  ])

  interaction.onNodeDragStop()
  assert.deepEqual(calls.splice(0), [
    ['end-drag', { saveHistory: false, changeType: 'node-position' }],
    ['schedule', { force: true }]
  ])
})
