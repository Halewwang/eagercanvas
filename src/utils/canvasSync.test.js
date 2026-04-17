import assert from 'node:assert/strict'
import test from 'node:test'

import {
  recoverMissingNodeMedia,
  shouldApplyRemoteProjectSnapshot,
  shouldUseCachedProjectBeforeRemote
} from './canvasSync.js'

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

test('uses cached project canvas before remote refresh when cache has content', () => {
  assert.equal(
    shouldUseCachedProjectBeforeRemote({
      projectId: 'project-1',
      cachedCanvasData: {
        nodes: [{ id: 'node-1' }],
        edges: [],
        groups: []
      }
    }),
    true
  )
  assert.equal(shouldUseCachedProjectBeforeRemote({ projectId: 'project-1', cachedCanvasData: { nodes: [] } }), false)
  assert.equal(shouldUseCachedProjectBeforeRemote({ projectId: 'new', cachedCanvasData: { nodes: [{ id: 'node-1' }] } }), false)
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
