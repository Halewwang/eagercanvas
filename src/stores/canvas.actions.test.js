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

test('new empty image nodes persist square 1K export defaults without changing other node types', () => {
  for (const type of ['image', 'imageConfig']) {
    const node = createCanvasNode({
      id: 'empty-image', type, defaultData: { url: '', label: 'Image' },
      data: { sourcePrompt: 'brief', sourceRefImages: ['reference.png'], sourceConfigId: 'legacy-config', assetUrls: {} }, now: 100
    })
    assert.equal(node.data.exportRatio, '1:1')
    assert.equal(node.data.exportSize, 1024)
    assert.equal(node.data.url, '')
    assert.equal(node.data.sourcePrompt, 'brief')
  }
  const text = createCanvasNode({ id: 'text', type: 'text', now: 100 })
  assert.equal(Object.hasOwn(text.data, 'exportRatio'), false)
  assert.equal(Object.hasOwn(text.data, 'exportSize'), false)
})

test('image creation preserves original media without adding a crop or output size', () => {
  const mediaSources = [
    { url: 'image.png' }, { previewUrl: 'blob:preview' }, { base64: 'data:image/png;base64,abc' },
    { sourceUrl: 'image.png' }, { src: 'image.png' }, { dataUrl: 'data:image/png;base64,abc' },
    { assetId: 'asset-1' }, { assetUrl: 'image.png' }, { assetUrls: { original: 'image.png' } }
  ]
  for (const source of mediaSources) {
    for (const input of [{ defaultData: source }, { data: source }]) {
      const node = createCanvasNode({
        id: 'media-image', type: 'image', ...input,
        data: { ...(input.data || {}), ratio: '3:2', size: '1536x1024' }, now: 100
      })
      assert.equal(Object.hasOwn(node.data, 'exportRatio'), false, JSON.stringify(source))
      assert.equal(Object.hasOwn(node.data, 'exportSize'), false, JSON.stringify(source))
      assert.equal(node.data.ratio, '3:2')
      assert.equal(node.data.size, '1536x1024')
      for (const [key, value] of Object.entries(source)) assert.deepEqual(node.data[key], value)
    }
  }
})

test('image creation preserves explicit export parameters including original ratio and original pixels', () => {
  for (const exportParameters of [
    { exportRatio: '16:9', exportSize: 4096 },
    { exportRatio: '', exportSize: 0 }
  ]) {
    for (const media of [{}, { url: 'image.png' }]) {
      const data = { ...media, ...exportParameters }
      const node = createCanvasNode({ id: 'image', type: 'image', data, now: 100 })
      assert.equal(node.data.exportRatio, exportParameters.exportRatio)
      assert.equal(node.data.exportSize, exportParameters.exportSize)
      assert.deepEqual(data, { ...media, ...exportParameters })
    }
  }
  const ratioOnly = createCanvasNode({ id: 'ratio', type: 'image', data: { exportRatio: '' }, now: 100 })
  assert.equal(ratioOnly.data.exportRatio, '')
  assert.equal(ratioOnly.data.exportSize, 1024)
  const sizeOnly = createCanvasNode({ id: 'size', type: 'image', data: { exportSize: 0 }, now: 100 })
  assert.equal(sizeOnly.data.exportRatio, '1:1')
  assert.equal(sizeOnly.data.exportSize, 0)
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
