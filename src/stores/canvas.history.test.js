import assert from 'node:assert/strict'
import { test } from 'node:test'

import {
  createCanvasHistoryEntry,
  createCanvasHistoryState,
  getRedoHistoryState,
  getUndoHistoryState,
  measureCanvasHistorySize,
  pushCanvasHistoryState,
  resolveCanvasHistoryState
} from './canvasHistoryCore.js'

const clone = (value) => JSON.parse(JSON.stringify(value))

test('createCanvasHistoryState captures an isolated nodes edges groups snapshot', () => {
  const nodes = [{ id: 'node_1', data: { content: 'draft' } }]
  const edges = [{ id: 'edge_1', source: 'node_1', target: 'node_2' }]
  const groups = [{ id: 'group_1', nodeIds: ['node_1', 'node_2'] }]

  const state = createCanvasHistoryState({ nodes, edges, groups }, clone)

  assert.deepEqual(state, { nodes, edges, groups })
  assert.notEqual(state.nodes, nodes)
  assert.notEqual(state.nodes[0], nodes[0])
  assert.notEqual(state.edges, edges)
  assert.notEqual(state.groups, groups)
})

test('createCanvasHistoryEntry stores node add as a patch instead of a full snapshot', () => {
  const previousState = createCanvasHistoryState({
    nodes: [
      {
        id: 'node_1',
        type: 'text',
        position: { x: 0, y: 0 },
        data: { content: 'large payload '.repeat(100) }
      }
    ],
    edges: [],
    groups: []
  }, clone)
  const nextState = createCanvasHistoryState({
    nodes: [
      previousState.nodes[0],
      {
        id: 'node_2',
        type: 'image',
        position: { x: 100, y: 0 },
        data: { url: 'https://example.com/image.png' }
      }
    ],
    edges: [],
    groups: []
  }, clone)

  const entry = createCanvasHistoryEntry({ previousState, nextState }, clone)

  assert.equal(entry.type, 'add')
  assert.equal(entry.payload.collection, 'nodes')
  assert.equal(entry.payload.id, 'node_2')
  assert.deepEqual(entry.payload.item, nextState.nodes[1])
  assert.equal(Object.hasOwn(entry, 'nodes'), false)
})

test('createCanvasHistoryEntry classifies update, move, remove, and edge patches', () => {
  const previousState = createCanvasHistoryState({
    nodes: [
      { id: 'node_1', type: 'text', position: { x: 0, y: 0 }, data: { content: 'old' } },
      { id: 'node_2', type: 'image', position: { x: 50, y: 50 }, data: { url: 'image.png' } }
    ],
    edges: [{ id: 'edge_1', source: 'node_1', target: 'node_2' }],
    groups: []
  }, clone)
  const nextState = createCanvasHistoryState({
    nodes: [
      { id: 'node_1', type: 'text', position: { x: 10, y: 20 }, data: { content: 'new' } }
    ],
    edges: [{ id: 'edge_2', source: 'node_2', target: 'node_1' }],
    groups: []
  }, clone)

  const entry = createCanvasHistoryEntry({ previousState, nextState }, clone)

  assert.equal(entry.type, 'transaction')
  assert.deepEqual(entry.payload.patches.map((patch) => `${patch.type}:${patch.payload.collection}:${patch.payload.id}`), [
    'update:nodes:node_1',
    'remove:nodes:node_2',
    'remove:edges:edge_1',
    'add:edges:edge_2'
  ])
})

test('pushCanvasHistoryState trims future patch entries before appending a new one', () => {
  let result = pushCanvasHistoryState({
    history: [],
    historyIndex: -1,
    state: { nodes: [{ id: 'node_1' }], edges: [], groups: [] },
    maxHistory: 50
  })
  result = pushCanvasHistoryState({
    history: result.history,
    historyIndex: result.historyIndex,
    state: { nodes: [{ id: 'node_2' }], edges: [], groups: [] },
    maxHistory: 50
  })
  result = pushCanvasHistoryState({
    history: result.history,
    historyIndex: result.historyIndex,
    state: { nodes: [{ id: 'node_3' }], edges: [], groups: [] },
    maxHistory: 50
  })

  const branched = pushCanvasHistoryState({
    history: result.history,
    historyIndex: 1,
    state: { nodes: [{ id: 'node_4' }], edges: [], groups: [] },
    maxHistory: 50
  })

  assert.equal(branched.historyIndex, 2)
  assert.equal(branched.history.length, 3)
  assert.deepEqual(resolveCanvasHistoryState({ history: branched.history, historyIndex: 2 }), {
    nodes: [{ id: 'node_4' }],
    edges: [],
    groups: []
  })
})

test('pushCanvasHistoryState keeps a restorable snapshot base when max history rolls', () => {
  let result = {
    history: [],
    historyIndex: -1
  }

  for (let index = 1; index <= 4; index += 1) {
    result = pushCanvasHistoryState({
      history: result.history,
      historyIndex: result.historyIndex,
      state: { nodes: [{ id: `node_${index}` }], edges: [], groups: [] },
      maxHistory: 3
    })
  }

  assert.equal(result.historyIndex, 2)
  assert.equal(result.history[0].type, 'snapshot')
  assert.deepEqual(resolveCanvasHistoryState({ history: result.history, historyIndex: 0 }), {
    nodes: [{ id: 'node_2' }],
    edges: [],
    groups: []
  })
  assert.deepEqual(resolveCanvasHistoryState({ history: result.history, historyIndex: 2 }), {
    nodes: [{ id: 'node_4' }],
    edges: [],
    groups: []
  })
})

test('undo and redo helpers return the next restorable legacy history entry', () => {
  const history = [
    { nodes: [{ id: 'node_1' }], edges: [], groups: [] },
    { nodes: [{ id: 'node_2' }], edges: [], groups: [] },
    { nodes: [{ id: 'node_3' }], edges: [], groups: [] }
  ]

  assert.deepEqual(getUndoHistoryState({ history, historyIndex: 0 }), {
    changed: false,
    historyIndex: 0,
    state: null
  })
  assert.deepEqual(getUndoHistoryState({ history, historyIndex: 2 }), {
    changed: true,
    historyIndex: 1,
    state: history[1]
  })
  assert.deepEqual(getRedoHistoryState({ history, historyIndex: 2 }), {
    changed: false,
    historyIndex: 2,
    state: null
  })
  assert.deepEqual(getRedoHistoryState({ history, historyIndex: 1 }), {
    changed: true,
    historyIndex: 2,
    state: history[2]
  })
})

test('undo and redo helpers apply patch entries for add, remove, move, and edge changes', () => {
  const states = [
    { nodes: [], edges: [], groups: [] },
    { nodes: [{ id: 'node_1', position: { x: 0, y: 0 }, data: { content: 'draft' } }], edges: [], groups: [] },
    { nodes: [{ id: 'node_1', position: { x: 25, y: 40 }, data: { content: 'draft' } }], edges: [], groups: [] },
    {
      nodes: [{ id: 'node_1', position: { x: 25, y: 40 }, data: { content: 'draft' } }],
      edges: [{ id: 'edge_1', source: 'node_1', target: 'node_2' }],
      groups: []
    },
    { nodes: [], edges: [], groups: [] }
  ]
  let result = {
    history: [],
    historyIndex: -1
  }
  states.forEach((state) => {
    result = pushCanvasHistoryState({
      history: result.history,
      historyIndex: result.historyIndex,
      state,
      maxHistory: 50
    })
  })

  const undoRemove = getUndoHistoryState({
    history: result.history,
    historyIndex: result.historyIndex,
    currentState: states[4]
  })
  assert.deepEqual(undoRemove.state, states[3])

  const undoEdge = getUndoHistoryState({
    history: result.history,
    historyIndex: undoRemove.historyIndex,
    currentState: undoRemove.state
  })
  assert.deepEqual(undoEdge.state, states[2])

  const redoEdge = getRedoHistoryState({
    history: result.history,
    historyIndex: undoEdge.historyIndex,
    currentState: undoEdge.state
  })
  assert.deepEqual(redoEdge.state, states[3])
})

test('transaction patches restore multi-node moves and group changes', () => {
  const previousState = {
    nodes: [
      { id: 'node_1', position: { x: 0, y: 0 }, data: {} },
      { id: 'node_2', position: { x: 20, y: 20 }, data: {} }
    ],
    edges: [],
    groups: [{ id: 'group_1', name: 'Field 1', nodeIds: ['node_1', 'node_2'] }]
  }
  const nextState = {
    nodes: [
      { id: 'node_1', position: { x: 50, y: 60 }, data: {} },
      { id: 'node_2', position: { x: 70, y: 80 }, data: {} }
    ],
    edges: [],
    groups: [{ id: 'group_1', name: 'Renamed', nodeIds: ['node_1', 'node_2'] }]
  }

  const entry = createCanvasHistoryEntry({ previousState, nextState }, clone)

  assert.equal(entry.type, 'transaction')
  assert.deepEqual(entry.payload.patches.map((patch) => patch.type), ['move', 'move', 'update'])
  assert.deepEqual(getUndoHistoryState({
    history: [{ type: 'snapshot', payload: previousState }, entry],
    historyIndex: 1,
    currentState: nextState
  }).state, previousState)
})

test('100 operations can undo 50 and redo 50 while patch history stays at least 80 percent smaller', () => {
  const baseNodes = Array.from({ length: 200 }, (_, index) => ({
    id: `node_${index}`,
    type: 'text',
    position: { x: index * 4, y: index * 2 },
    data: {
      content: `node ${index} ${'payload '.repeat(40)}`,
      label: `Text ${index}`
    }
  }))
  const states = [{ nodes: baseNodes, edges: [], groups: [] }]

  for (let step = 1; step <= 100; step += 1) {
    const previous = states[step - 1]
    states.push({
      nodes: previous.nodes.map((node) => (
        node.id === 'node_42'
          ? {
              ...node,
              position: { x: node.position.x + 1, y: node.position.y + 1 }
            }
          : node
      )),
      edges: previous.edges,
      groups: previous.groups
    })
  }

  let result = {
    history: [],
    historyIndex: -1
  }
  states.forEach((state) => {
    result = pushCanvasHistoryState({
      history: result.history,
      historyIndex: result.historyIndex,
      state,
      maxHistory: 150
    })
  })

  let cursor = {
    historyIndex: result.historyIndex,
    state: states[100]
  }
  for (let index = 0; index < 50; index += 1) {
    cursor = getUndoHistoryState({
      history: result.history,
      historyIndex: cursor.historyIndex,
      currentState: cursor.state
    })
  }
  assert.deepEqual(cursor.state, states[50])

  for (let index = 0; index < 50; index += 1) {
    cursor = getRedoHistoryState({
      history: result.history,
      historyIndex: cursor.historyIndex,
      currentState: cursor.state
    })
  }
  assert.deepEqual(cursor.state, states[100])

  const fullSnapshotHistory = states.map((state) => createCanvasHistoryState(state, clone))
  assert.ok(
    measureCanvasHistorySize(result.history) <= measureCanvasHistorySize(fullSnapshotHistory) * 0.2,
    'patch history should serialize to at most 20% of the full snapshot history'
  )
})
