import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'

import {
  createCanvasNode,
  duplicateCanvasNode,
  removeCanvasNodeGraph,
  updateCanvasNodeData
} from './canvasActionsCore.js'

test('createCanvasNode merges defaults, incoming data and stable timestamps', () => {
  const node = createCanvasNode({
    id: 'node_7',
    type: 'image',
    position: { x: 12, y: 24 },
    defaultData: {
      label: 'Image',
      quality: 'standard',
      createdAt: 1,
      updatedAt: 2
    },
    data: {
      quality: 'hd',
      url: 'https://storage.example.com/image.png',
      createdAt: 88
    },
    now: 100
  })

  assert.deepEqual(node, {
    id: 'node_7',
    type: 'image',
    position: { x: 12, y: 24 },
    data: {
      label: 'Image',
      quality: 'hd',
      url: 'https://storage.example.com/image.png',
      createdAt: 88,
      updatedAt: 100
    }
  })
})

test('updateCanvasNodeData only merges data for the targeted node', () => {
  const sourceNodes = [
    {
      id: 'node_1',
      type: 'text',
      position: { x: 0, y: 0 },
      data: { content: 'old', label: 'Text' }
    },
    {
      id: 'node_2',
      type: 'image',
      position: { x: 100, y: 0 },
      data: { url: 'https://example.com/image.png' }
    }
  ]

  const nextNodes = updateCanvasNodeData(sourceNodes, 'node_1', {
    content: 'new',
    updatedAt: 200
  })

  assert.notEqual(nextNodes, sourceNodes)
  assert.notEqual(nextNodes[0], sourceNodes[0])
  assert.equal(nextNodes[1], sourceNodes[1])
  assert.deepEqual(nextNodes[0].data, {
    content: 'new',
    label: 'Text',
    updatedAt: 200
  })
  assert.deepEqual(sourceNodes[0].data, { content: 'old', label: 'Text' })
})

test('removeCanvasNodeGraph removes selected nodes and directly connected edges', () => {
  const result = removeCanvasNodeGraph({
    nodes: [
      { id: 'node_a' },
      { id: 'node_b' },
      { id: 'node_c' }
    ],
    edges: [
      { id: 'edge_ab', source: 'node_a', target: 'node_b' },
      { id: 'edge_bc', source: 'node_b', target: 'node_c' },
      { id: 'edge_cd', source: 'node_c', target: 'node_d' }
    ],
    nodeIds: ['node_b']
  })

  assert.deepEqual(result.nodes.map((node) => node.id), ['node_a', 'node_c'])
  assert.deepEqual(result.edges.map((edge) => edge.id), ['edge_cd'])
})

test('duplicateCanvasNode offsets the copied node and raises its z-index', () => {
  const result = duplicateCanvasNode({
    nodes: [
      {
        id: 'node_a',
        type: 'text',
        position: { x: 10, y: 20 },
        data: { content: 'copy me' },
        zIndex: 3
      },
      {
        id: 'node_b',
        type: 'image',
        position: { x: 50, y: 60 },
        data: {},
        zIndex: 9
      }
    ],
    sourceId: 'node_a',
    newId: 'node_c',
    offset: { x: 50, y: 50 }
  })

  assert.equal(result.duplicatedNode.id, 'node_c')
  assert.deepEqual(result.duplicatedNode, {
    id: 'node_c',
    type: 'text',
    position: { x: 60, y: 70 },
    data: { content: 'copy me' },
    zIndex: 10
  })
  assert.notEqual(result.duplicatedNode.data, result.nodes[0].data)
  assert.deepEqual(result.nodes.map((node) => node.id), ['node_a', 'node_b', 'node_c'])
})

test('canvas store delegates node actions to pure canvas action helpers', () => {
  const canvasSource = readFileSync(new URL('./canvas.js', import.meta.url), 'utf8')

  assert.match(canvasSource, /from '\.\/canvasActionsCore\.js'/)
  assert.match(canvasSource, /getCanvasAutoPlacementPosition/)
  assert.match(canvasSource, /const getAutoPlacementPosition = \(type, preferredPosition, data = \{\}\) =>/)
  assert.match(canvasSource, /existingNodes: nodes\.value/)
  assert.match(canvasSource, /createCanvasNode\(\{/)
  assert.match(canvasSource, /updateCanvasNodeData\(nodes\.value, id, data\)/)
  assert.match(canvasSource, /removeCanvasNodeGraph\(\{/)
  assert.match(canvasSource, /duplicateCanvasNode\(\{/)
  assert.match(canvasSource, /getAutoPlacementPosition,/)
})

test('canvas store can update runtime node state without scheduling autosave', () => {
  const canvasSource = readFileSync(new URL('./canvas.js', import.meta.url), 'utf8')

  assert.match(canvasSource, /const updateNode = \(id, data, options = \{\}\) => \{/)
  assert.match(canvasSource, /if \(options\.persist === false\) return/)
  assert.match(canvasSource, /markCanvasDirty\(options\.changeType\)/)
})

test('canvas store keeps group output links scoped inside groups and cleans them with node removal', () => {
  const canvasSource = readFileSync(new URL('./canvas.js', import.meta.url), 'utf8')

  assert.match(canvasSource, /const addNodesToGroup = \(groupIdToUpdate, nodeIdsToAdd, options = \{\}\) => \{/)
  assert.match(canvasSource, /const addGroupOutputLink = \(groupIdToUpdate, targetNodeId, options = \{\}\) => \{/)
  assert.match(canvasSource, /const removeGroupOutputLinkById = \(outputLinkId, options = \{\}\) => \{/)
  assert.match(canvasSource, /const removeGroupOutputLinksForNodes = \(nodeIdsToRemove\) => \{/)
  assert.match(canvasSource, /addNodesToGroup,/)
  assert.match(canvasSource, /addGroupOutputLink,/)
  assert.match(canvasSource, /removeGroupOutputLinkById,/)
  assert.doesNotMatch(canvasSource, /const groupLinks = shallowRef/)
})
