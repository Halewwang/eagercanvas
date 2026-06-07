import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import test from 'node:test'
import { ref } from 'vue'

const linkedNodesUrl = new URL('./useImageNodeLinkedNodes.js', import.meta.url)
const linkedNodesPath = fileURLToPath(linkedNodesUrl)
const canvasInteractionUrl = new URL('../../../utils/canvasInteraction.js', import.meta.url)

const loadLinkedNodes = async () => {
  assert.ok(existsSync(linkedNodesPath), 'useImageNodeLinkedNodes.js should exist')
  const linkedNodesSource = readFileSync(linkedNodesUrl, 'utf8')
    .replace("from '@/utils/canvasInteraction'", `from '${canvasInteractionUrl.href}'`)
  return import(`data:text/javascript;base64,${Buffer.from(linkedNodesSource).toString('base64')}`)
}

const createHarness = async (overrides = {}) => {
  const { useImageNodeLinkedNodes } = await loadLinkedNodes()
  const calls = []
  const nodes = ref(overrides.nodes || [
    { id: 'source-node', position: { x: 100, y: 200 }, selected: true, data: { selected: true } },
    { id: 'existing-node', position: { x: 20, y: 30 }, selected: false, data: { selected: false } }
  ])
  const defaults = overrides.defaults || {
    model: 'model-a',
    quality: 'hd',
    ratio: '16:9',
    resolution: '2k',
    size: '2560x1440'
  }

  const linked = useImageNodeLinkedNodes({
    addEdge: (edge) => calls.push(['add-edge', edge]),
    addNode: (type, position, data) => {
      calls.push(['add-node', type, position, data])
      nodes.value = [
        ...nodes.value,
        { id: 'new-image-node', type, position, data, selected: false }
      ]
      return 'new-image-node'
    },
    buildCreateData: ({ payload, defaults }) => ({ created: true, payload, defaults }),
    buildPosition: overrides.buildPosition || (({ currentNode, stageWidth }) => ({
      x: currentNode.position.x + Number.parseFloat(stageWidth),
      y: currentNode.position.y
    })),
    buildSelectionState: ({ nodes, selectedNodeId }) => nodes.map((node) => ({
      ...node,
      selected: node.id === selectedNodeId,
      data: {
        ...(node.data || {}),
        selected: node.id === selectedNodeId
      }
    })),
    buildUpdatePatch: ({ payload, defaults }) => ({ updated: true, payload, defaults }),
    edgeStrategy: {
      resolve: (edge) => ({ resolved: true, ...edge })
    },
    flushSave: async () => {
      calls.push(['flush-save'])
      return 'saved'
    },
    getDefaults: () => defaults,
    nodeId: () => 'source-node',
    nodes,
    setTimeoutFn: (callback, delay) => {
      calls.push(['timeout', delay])
      callback()
      return `timer-${delay}`
    },
    stageStyle: () => ({ width: '420px' }),
    updateNode: (id, patch) => calls.push(['update-node', id, patch]),
    updateNodeInternals: (id) => calls.push(['internals', id])
  })

  return {
    calls,
    linked,
    nodes
  }
}

test('image node linked nodes create a right-side image node with edge and selection sync', async () => {
  const { calls, linked, nodes } = await createHarness()

  const newNodeId = linked.createLinkedImageNode({ label: 'Enhanced', loading: true })

  assert.equal(newNodeId, 'new-image-node')
  assert.deepEqual(calls, [
    [
      'add-node',
      'image',
      { x: 520, y: 200 },
      {
        created: true,
        payload: { label: 'Enhanced', loading: true },
        defaults: {
          model: 'model-a',
          quality: 'hd',
          ratio: '16:9',
          resolution: '2k',
          size: '2560x1440'
        }
      }
    ],
    [
      'add-edge',
      {
        resolved: true,
        source: 'source-node',
        target: 'new-image-node',
        sourceHandle: 'right',
        targetHandle: 'left'
      }
    ],
    ['timeout', 60],
    ['internals', 'source-node'],
    ['internals', 'new-image-node']
  ])
  assert.equal(nodes.value.find((node) => node.id === 'source-node').selected, false)
  assert.equal(nodes.value.find((node) => node.id === 'new-image-node').selected, true)
  assert.equal(nodes.value.find((node) => node.id === 'new-image-node').data.selected, true)
})

test('image node linked nodes skip creation when source node or position is missing', async () => {
  const missingSource = await createHarness({ nodes: [] })
  assert.equal(missingSource.linked.createLinkedImageNode({ label: 'Skipped' }), null)
  assert.deepEqual(missingSource.calls, [])

  const missingPosition = await createHarness({
    buildPosition: () => null
  })
  assert.equal(missingPosition.linked.createLinkedImageNode({ label: 'Skipped' }), null)
  assert.deepEqual(missingPosition.calls, [])
})

test('image node linked nodes update existing linked nodes and save non-loading results', async () => {
  const { calls, linked } = await createHarness()

  const saved = await linked.updateLinkedImageNode('target-node', { url: 'https://cdn.example.com/result.png' })

  assert.equal(saved, 'saved')
  assert.deepEqual(calls, [
    [
      'update-node',
      'target-node',
      {
        updated: true,
        payload: { url: 'https://cdn.example.com/result.png' },
        defaults: {
          model: 'model-a',
          quality: 'hd',
          ratio: '16:9',
          resolution: '2k',
          size: '2560x1440'
        }
      }
    ],
    ['timeout', 40],
    ['internals', 'target-node'],
    ['flush-save']
  ])
})

test('image node linked nodes keep loading updates unsaved until final result arrives', async () => {
  const { calls, linked } = await createHarness()

  const result = await linked.updateLinkedImageNode('target-node', { loading: true })

  assert.equal(result, true)
  assert.deepEqual(calls, [
    [
      'update-node',
      'target-node',
      {
        updated: true,
        payload: { loading: true },
        defaults: {
          model: 'model-a',
          quality: 'hd',
          ratio: '16:9',
          resolution: '2k',
          size: '2560x1440'
        }
      }
    ],
    ['timeout', 40],
    ['internals', 'target-node']
  ])
})
