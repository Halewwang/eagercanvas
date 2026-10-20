import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'

const parametersUrl = new URL('../utils/gptImageParameters.js', import.meta.url).href
const legacySource = readFileSync(new URL('./legacyImageConfig.js', import.meta.url), 'utf8')
  .replace("from '@/utils/gptImageParameters.js'", `from '${parametersUrl}'`)
  .replace("from '@/utils/imageDimensions.js'", `from '${new URL('../utils/imageDimensions.js', import.meta.url).href}'`)
const legacyUrl = `data:text/javascript;base64,${Buffer.from(legacySource).toString('base64')}`
const snapshotsSource = readFileSync(new URL('./canvasSnapshots.js', import.meta.url), 'utf8')
  .replace("from './canvasClone.js'", `from '${new URL('./canvasClone.js', import.meta.url).href}'`)
  .replace("from './legacyImageConfig.js'", `from '${legacyUrl}'`)
  .replace("from '@/utils/gptImageParameters.js'", `from '${parametersUrl}'`)
const { createCanvasPersistenceSnapshots, createCanvasSnapshot, normalizeImageNodeParameters } =
  await import(`data:text/javascript;base64,${Buffer.from(snapshotsSource).toString('base64')}`)
const actionsSource = readFileSync(new URL('./canvasActionsCore.js', import.meta.url), 'utf8')
  .replace("from '@/utils/gptImageParameters.js'", `from '${parametersUrl}'`)
const { createCanvasNode, duplicateCanvasNode } =
  await import(`data:text/javascript;base64,${Buffer.from(actionsSource).toString('base64')}`)

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


test('image generation settings migrate without changing actual media dimensions', () => {
  const data = {
    size: '1536x1024', ratio: '3:2', resolution: '4k',
    exportRatio: '16:9', exportSize: 4096,
    output_format: 'webp', moderation: 'auto', url: 'image.png'
  }
  const image = normalizeImageNodeParameters({ type: 'image', data })
  assert.deepEqual(image.data, {
    size: '1536x1024', ratio: '3:2', url: 'image.png',
    generationRatio: '16:9', generationResolution: '4k', })
  assert.deepEqual(normalizeImageNodeParameters(image), image)
  const canonical = normalizeImageNodeParameters({ type: 'image', data: {
    ...data, generationRatio: '4:5', generationResolution: '2k', } })
  assert.equal(canonical.data.generationRatio, '4:5')
  assert.equal(canonical.data.generationResolution, '2k')
  assert.equal(canonical.data.generationQuality, undefined)
  assert.equal(data.exportSize, 4096, 'normalization must not mutate source data')
  const video = { type: 'video', data }
  assert.equal(normalizeImageNodeParameters(video), video)
})

test('canonical generation settings survive snapshots and duplication independently of media metadata', () => {
  const empty = createCanvasNode({ id: 'empty', type: 'image', now: 100 })
  assert.equal(empty.data.generationRatio, '1:1')
  assert.equal(empty.data.generationResolution, '1k')
  assert.equal(empty.data.generationQuality, undefined)
  assert.equal(Object.hasOwn(empty.data, 'exportRatio'), false)
  const media = createCanvasNode({ id: 'media', type: 'image', data: {
    url: 'https://storage.example.com/storage/v1/object/public/uploads/image.png', size: '1536x1024', ratio: '3:2',
    generationRatio: '16:9', generationResolution: '4k', } })
  const { localSnapshot, remoteSnapshot } = createCanvasPersistenceSnapshots({ nodes: [empty, media,
    { id: 'auto', type: 'image', position: { x: 0, y: 0 }, data: { exportRatio: '', exportSize: 0 } }
  ] })
  for (const snapshot of [localSnapshot, remoteSnapshot]) {
    const loaded = JSON.parse(JSON.stringify(snapshot)).nodes.map(normalizeImageNodeParameters)
    assert.equal(loaded[0].data.generationRatio, '1:1')
    assert.equal(loaded[1].data.size, '1536x1024')
    assert.equal(loaded[1].data.ratio, '3:2')
    assert.equal(loaded[1].data.generationRatio, '16:9')
    assert.equal(loaded[1].data.generationResolution, '4k')
    assert.equal(loaded[1].data.generationQuality, undefined)
    assert.equal(loaded[2].data.generationRatio, 'auto')
    assert.equal(loaded[2].data.generationResolution, '1k')
    for (const node of loaded) {
      const { duplicatedNode } = duplicateCanvasNode({ nodes: loaded, sourceId: node.id, newId: `${node.id}-copy` })
      assert.deepEqual(duplicatedNode.data, node.data)
      for (const key of ['exportRatio', 'exportSize', 'quality', 'resolution']) assert.equal(Object.hasOwn(node.data, key), false)
    }
  }
})

test('both snapshot formats migrate old image configuration graphs and round trip without a settings card', () => {
  const original = { nodes: [
    { id: 'text', type: 'text', data: { content: 'brief' } },
    { id: 'config', type: 'imageConfig', data: { model: 'gpt-image-2', size: '1024x1024' } },
    { id: 'out', type: 'image', data: { url: 'https://storage.example.com/storage/v1/object/public/uploads/image.png', size: '1774x887', ratio: '2:1', runId: 'keep-run' } }
  ], edges: [{ id: 'input', source: 'text', target: 'config' }, { id: 'output', source: 'config', target: 'out' }], groups: [], viewport: { zoom: 0.8 } }
  const { localSnapshot, remoteSnapshot } = createCanvasPersistenceSnapshots(original)
  assert.deepEqual(localSnapshot, remoteSnapshot)
  assert.deepEqual(localSnapshot.nodes.map(n => n.type), ['text', 'image'])
  assert.deepEqual(localSnapshot.edges.map(e => [e.source, e.target]), [['text', 'out']])
  const image = localSnapshot.nodes[1]
  assert.equal(image.data.background, undefined)
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

test('APIMart migration drops unsupported options and normalizes former Auto resolution without touching media', () => {
  const oldData = { url: 'image.png', size: '1536x1024', ratio: '3:2', generationRatio: 'auto', generationResolution: 'auto', generationQuality: 'high', quality: 'high', background: 'opaque', output_format: 'webp' }
  const result = normalizeImageNodeParameters({ type: 'image', data: oldData })
  assert.deepEqual(result.data, { url: 'image.png', size: '1536x1024', ratio: '3:2', generationRatio: 'auto', generationResolution: '1k' })
  assert.equal(oldData.generationQuality, 'high')
})

test('unfinished image tasks persist across refresh without embedding request image data', () => {
  const node = { id: 'pending-image', type: 'image', data: { loading: true, imageTaskId: 'durable-task', imageTaskMetadata: {
    model: 'gpt-image-2', generationRatio: '16:9', generationResolution: '4k', sourcePrompt: 'creative brief',
    sourceRefImages: ['https://cdn.example.com/ref.png', 'data:image/png;base64,secret'], image: 'data:image/png;base64,secret'
  } } }
  const { localSnapshot, remoteSnapshot } = createCanvasPersistenceSnapshots({ nodes: [node] })
  for (const snapshot of [localSnapshot, remoteSnapshot]) {
    const restored = JSON.parse(JSON.stringify(snapshot)).nodes[0].data
    assert.equal(restored.imageTaskId, 'durable-task')
    assert.equal(restored.imageTaskMetadata.generationResolution, '4k')
    assert.deepEqual(restored.imageTaskMetadata.sourceRefImages, ['https://cdn.example.com/ref.png'])
    assert.equal(Object.hasOwn(restored.imageTaskMetadata, 'image'), false)
    assert.equal(Object.hasOwn(restored, 'loading'), false)
  }
})
