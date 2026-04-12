import assert from 'node:assert/strict'
import test from 'node:test'

import { recoverMissingNodeMedia, shouldApplyRemoteProjectSnapshot } from './canvasSync.js'

test('applies refreshed snapshot when route still matches and there are no pending local edits', () => {
  assert.equal(
    shouldApplyRemoteProjectSnapshot({
      refreshedProjectId: 'project-1',
      activeRouteProjectId: 'project-1',
      currentCanvasProjectId: 'project-1',
      hasPendingCanvasChanges: false
    }),
    true
  )
})

test('blocks refreshed snapshot when current canvas already has unsaved local edits', () => {
  assert.equal(
    shouldApplyRemoteProjectSnapshot({
      refreshedProjectId: 'project-1',
      activeRouteProjectId: 'project-1',
      currentCanvasProjectId: 'project-1',
      hasPendingCanvasChanges: true
    }),
    false
  )
})

test('recovers blank image nodes from saved asset records', () => {
  const result = recoverMissingNodeMedia({
    nodes: [
      {
        id: 'image-node-1',
        type: 'image',
        data: {
          url: '',
          previewUrl: '',
          base64: ''
        }
      }
    ],
    edges: [
      {
        source: 'config-node-1',
        target: 'image-node-1'
      }
    ],
    assets: [
      {
        sourceNodeId: 'config-node-1',
        kind: 'image',
        url: 'https://cdn.example.com/output.png'
      }
    ]
  })

  assert.equal(result.restoredCount, 1)
  assert.equal(result.restoredNodeIds[0], 'image-node-1')
  assert.equal(result.nodes[0].data.url, 'https://cdn.example.com/output.png')
  assert.equal(result.nodes[0].data.persistStatus, 'saved')
})

test('recovers blank 3d config nodes from saved asset records', () => {
  const result = recoverMissingNodeMedia({
    nodes: [
      {
        id: 'node-3d-1',
        type: 'model3dConfig',
        data: {
          status: 'completed',
          url: '',
          previewImageUrl: '',
          assetUrls: {}
        }
      }
    ],
    edges: [],
    assets: [
      {
        sourceNodeId: 'node-3d-1',
        kind: 'model3d',
        url: 'https://cdn.example.com/model.glb',
        fileName: 'model.glb',
        previewUrl: 'https://cdn.example.com/model-preview.png'
      },
      {
        sourceNodeId: 'node-3d-1',
        kind: 'model3d',
        url: 'https://cdn.example.com/model.obj',
        fileName: 'model.obj',
        previewUrl: 'https://cdn.example.com/model-preview.png'
      }
    ]
  })

  assert.equal(result.restoredCount, 1)
  assert.deepEqual(result.nodes[0].data.assetUrls, {
    glb: 'https://cdn.example.com/model.glb',
    obj: 'https://cdn.example.com/model.obj'
  })
  assert.equal(result.nodes[0].data.url, 'https://cdn.example.com/model.glb')
  assert.equal(result.nodes[0].data.previewImageUrl, 'https://cdn.example.com/model-preview.png')
})
