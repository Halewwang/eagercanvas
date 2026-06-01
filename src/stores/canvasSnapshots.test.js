import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'

import { createCanvasPersistenceSnapshots } from './canvasSnapshots.js'

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
