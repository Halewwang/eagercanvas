import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'

import { createCanvasPersistenceSnapshots, createCanvasSnapshot, normalizeImageNodeParameters } from './canvasSnapshots.js'
import { createCanvasNode, duplicateCanvasNode } from './canvasActionsCore.js'

test('canvas persistence snapshots preserve local transient media while pruning remote payloads in one node traversal', () => {
  const visits = []
  const nodes = [
    {
      id: 'image-node-1',
      type: 'image',
      selected: true,
      dragging: true,
      data: {
        url: 'blob:https://app.local/temporary-image',
        base64: 'raw-base64',
        previewUrl: 'blob:https://app.local/preview',
        previewImageUrl: 'blob:https://app.local/preview-image',
        sourceRefImages: [
          'blob:https://app.local/source',
          'https://storage.example.com/storage/v1/object/public/uploads/source.png',
          ''
        ],
        assetUrls: {
          temp: 'blob:https://app.local/asset',
          saved: 'https://storage.example.com/storage/v1/object/public/uploads/asset.png',
          empty: ''
        },
        label: 'Image'
      }
    },
    {
      id: 'text-node-1',
      type: 'text',
      data: {
        text: 'Keep me'
      }
    }
  ]
  const iterableNodes = {
    map(callback) {
      throw new Error('createCanvasPersistenceSnapshots must not use a second nodes.map pass')
    },
    [Symbol.iterator]: function* () {
      for (const node of nodes) {
        visits.push(node.id)
        yield node
      }
    }
  }

  const { containsTransientMedia, localSnapshot, remoteSnapshot } = createCanvasPersistenceSnapshots({
    nodes: iterableNodes,
    edges: [
      {
        id: 'edge-1',
        source: 'text-node-1',
        target: 'image-node-1',
        selected: true,
        updatable: true,
        focusable: true
      }
    ],
    groups: [{ id: 'group-1', name: 'Field 1' }],
    viewport: { x: 10, y: 20, zoom: 0.8 }
  })

  assert.deepEqual(visits, ['image-node-1', 'text-node-1'])
  assert.equal(containsTransientMedia, true)
  assert.equal(localSnapshot.nodes[0].selected, undefined)
  assert.equal(localSnapshot.nodes[0].dragging, undefined)
  assert.equal(localSnapshot.nodes[0].data.base64, undefined)
  assert.equal(localSnapshot.nodes[0].data.previewUrl, undefined)
  assert.equal(localSnapshot.nodes[0].data.url, 'blob:https://app.local/temporary-image')
  assert.deepEqual(localSnapshot.nodes[0].data.sourceRefImages, [
    'blob:https://app.local/source',
    'https://storage.example.com/storage/v1/object/public/uploads/source.png'
  ])
  assert.deepEqual(localSnapshot.nodes[0].data.assetUrls, {
    temp: 'blob:https://app.local/asset',
    saved: 'https://storage.example.com/storage/v1/object/public/uploads/asset.png'
  })
  assert.equal(localSnapshot.nodes[0].data.previewImageUrl, 'blob:https://app.local/preview-image')

  assert.equal(remoteSnapshot.nodes[0].data.url, undefined)
  assert.deepEqual(remoteSnapshot.nodes[0].data.sourceRefImages, ['https://storage.example.com/storage/v1/object/public/uploads/source.png'])
  assert.deepEqual(remoteSnapshot.nodes[0].data.assetUrls, { saved: 'https://storage.example.com/storage/v1/object/public/uploads/asset.png' })
  assert.equal(remoteSnapshot.nodes[0].data.previewImageUrl, undefined)
  assert.equal(remoteSnapshot.edges[0].selected, undefined)
  assert.equal(remoteSnapshot.edges[0].updatable, undefined)
  assert.equal(remoteSnapshot.edges[0].focusable, undefined)
  assert.deepEqual(localSnapshot.groups, remoteSnapshot.groups)
  assert.notEqual(localSnapshot.groups, remoteSnapshot.groups)
  assert.deepEqual(localSnapshot.viewport, { x: 10, y: 20, zoom: 0.8 })
  assert.deepEqual(remoteSnapshot.viewport, { x: 10, y: 20, zoom: 0.8 })
})

test('saveProject uses the paired persistence snapshot helper instead of building local and remote snapshots separately', () => {
  const canvasSource = readFileSync(new URL('./canvas.js', import.meta.url), 'utf8')
  const saveProjectStart = canvasSource.indexOf('const saveProject = async')
  const saveProjectEnd = canvasSource.indexOf('const runSave = async', saveProjectStart)
  const saveProjectSetup = canvasSource.slice(saveProjectStart, saveProjectEnd)

  assert.match(canvasSource, /import \{[^}]*createCanvasPersistenceSnapshots[^}]*\} from '\.\/canvasSnapshots'/)
  assert.match(canvasSource, /return \{[\s\S]*\bsaveProject,/)
  assert.match(saveProjectSetup, /createCanvasPersistenceSnapshots\(\{/)
  assert.doesNotMatch(saveProjectSetup, /createCanvasSnapshot\(\{ preserveTransientMedia: true \}\)/)
  assert.doesNotMatch(saveProjectSetup, /createCanvasSnapshot\(\)/)
})


test('old image generation controls are removed while media metadata and references survive', () => {
  const data = {
    size: '1536x1024', ratio: '3:2', quality: 'high', resolution: '4k', aspect_ratio: '16:9',
    output_format: 'webp', outputFormat: 'jpeg', output_compression: 100, moderation: 'auto',
    enable_sync_mode: true, enable_base64_output: false,
    background: 'opaque', sourcePrompt: 'Keep this creative brief', sourceRefImages: ['ref.png'], url: 'image.png'
  }
  const image = normalizeImageNodeParameters({ type: 'image', data })
  assert.deepEqual(image.data, {
    size: '1536x1024', ratio: '3:2', background: 'opaque', sourcePrompt: data.sourcePrompt,
    sourceRefImages: data.sourceRefImages, url: 'image.png'
  })
  const config = normalizeImageNodeParameters({ type: 'imageConfig', data })
  assert.equal(Object.hasOwn(config.data, 'size'), false)
  assert.equal(Object.hasOwn(config.data, 'ratio'), false)
  assert.equal(config.data.sourcePrompt, data.sourcePrompt)
  const video = { type: 'video', data }
  assert.equal(normalizeImageNodeParameters(video), video)
  assert.equal(data.quality, 'high', 'normalization must not mutate the source')
})

test('image export settings survive serialization, load normalization and duplication independently of removed generation controls', () => {
  const emptyImage = createCanvasNode({ id: 'empty', type: 'image', position: { x: 0, y: 0 }, now: 100 })
  const originalImage = createCanvasNode({
    id: 'original', type: 'image', position: { x: 100, y: 0 }, now: 100,
    data: { url: 'https://storage.example.com/storage/v1/object/public/uploads/image.png', ratio: '3:2', size: '1536x1024' }
  })
  const nodes = [emptyImage, originalImage, ...[
    { exportRatio: '16:9', exportSize: 4096 }, { exportRatio: '', exportSize: 0 }
  ].map((parameters, index) => createCanvasNode({
    id: `export-${index}`, type: 'image', position: { x: 200, y: index * 100 }, now: 100,
    data: { ...parameters, quality: 'high', resolution: '4k', output_format: 'png', moderation: 'auto' }
  }))]
  const { localSnapshot, remoteSnapshot } = createCanvasPersistenceSnapshots({ nodes })
  for (const snapshot of [localSnapshot, remoteSnapshot]) {
    const loaded = JSON.parse(JSON.stringify(snapshot)).nodes.map(normalizeImageNodeParameters)
    assert.equal(loaded[0].data.exportRatio, '1:1')
    assert.equal(loaded[0].data.exportSize, 1024)
    assert.equal(Object.hasOwn(loaded[1].data, 'exportRatio'), false)
    assert.equal(Object.hasOwn(loaded[1].data, 'exportSize'), false)
    assert.equal(loaded[1].data.ratio, '3:2')
    assert.equal(loaded[1].data.size, '1536x1024')
    for (const node of loaded) {
      const { duplicatedNode } = duplicateCanvasNode({ nodes: loaded, sourceId: node.id, newId: `${node.id}-copy` })
      assert.deepEqual(duplicatedNode.data, node.data)
      assert.equal(Object.hasOwn(node.data, 'quality'), false)
      assert.equal(Object.hasOwn(node.data, 'resolution'), false)
      assert.equal(Object.hasOwn(node.data, 'output_format'), false)
      assert.equal(Object.hasOwn(node.data, 'moderation'), false)
    }
    assert.equal(loaded[2].data.exportRatio, '16:9')
    assert.equal(loaded[2].data.exportSize, 4096)
    assert.equal(loaded[3].data.exportRatio, '')
    assert.equal(loaded[3].data.exportSize, 0)
  }
})

test('both snapshot formats migrate old image configuration graphs and round trip without a settings card', () => {
  const original = { nodes: [
    { id: 'text', type: 'text', data: { content: 'brief' } },
    { id: 'config', type: 'imageConfig', data: { model: 'gpt-image-2', background: 'opaque', quality: 'high', size: '1024x1024' } },
    { id: 'out', type: 'image', data: { url: 'https://storage.example.com/storage/v1/object/public/uploads/image.png', size: '1774x887', ratio: '2:1', runId: 'keep-run' } }
  ], edges: [{ id: 'input', source: 'text', target: 'config' }, { id: 'output', source: 'config', target: 'out' }], groups: [], viewport: { zoom: 0.8 } }
  const { localSnapshot, remoteSnapshot } = createCanvasPersistenceSnapshots(original)
  assert.deepEqual(localSnapshot, remoteSnapshot)
  assert.deepEqual(localSnapshot.nodes.map(n => n.type), ['text', 'image'])
  assert.deepEqual(localSnapshot.edges.map(e => [e.source, e.target]), [['text', 'out']])
  const image = localSnapshot.nodes[1]
  assert.equal(image.data.background, 'opaque')
  assert.equal(image.data.size, '1774x887')
  assert.equal(image.data.runId, 'keep-run')
  assert.equal(image.data.sourceConfigId, 'config')
  assert.equal(Object.hasOwn(image.data, 'quality'), false)
  assert.deepEqual(createCanvasSnapshot(localSnapshot), localSnapshot)
  assert.equal(original.nodes[1].type, 'imageConfig')
})

test('load, undo and template insertion normalize the full graph before rendering', () => {
  const canvasSource = readFileSync(new URL('./canvas.js', import.meta.url), 'utf8')
  const factorySource = readFileSync(new URL('../hooks/useNodesFactory.js', import.meta.url), 'utf8')
  assert.match(canvasSource, /const sanitizedCanvas = migrateLegacyImageConfigNodes\(/)
  assert.match(canvasSource, /groups\.value = normalizeGroups\(sanitizedCanvas\.groups/)
  assert.match(canvasSource, /const restored = migrateLegacyImageConfigNodes\(cloneCanvasData\(state\)\)/)
  assert.match(factorySource, /migrateLegacyImageConfigNodes\(workflow\.createNodes\(/)
  assert.doesNotMatch(canvasSource, /addNode\('imageConfig'/)
})
