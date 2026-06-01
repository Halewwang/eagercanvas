import assert from 'node:assert/strict'
import test from 'node:test'

import {
  CANVAS_SYNC_STATES,
  buildRevisionSavePayload,
  deriveLoadSyncStatus,
  deriveSyncStatusFromSaveResult,
  isConflictError
} from './canvasSyncStatus.js'

test('offline save result is localPersisted and not remote success', () => {
  const status = deriveSyncStatusFromSaveResult({
    localSaved: true,
    remoteSynced: false,
    error: { message: 'Network Error' }
  })

  assert.equal(status.status, CANVAS_SYNC_STATES.offline)
  assert.equal(status.localSaved, true)
  assert.equal(status.remoteSynced, false)
})

test('conflict errors map to conflict state', () => {
  const status = deriveSyncStatusFromSaveResult({
    localSaved: true,
    remoteSynced: false,
    error: { status: 409, code: 'PROJECT_CONFLICT' }
  })

  assert.equal(isConflictError(status.error), true)
  assert.equal(status.status, CANVAS_SYNC_STATES.conflict)
})

test('remote success without local persistence is not displayed as synced', () => {
  const status = deriveSyncStatusFromSaveResult({
    localSaved: false,
    remoteSynced: true
  })

  assert.equal(status.status, CANVAS_SYNC_STATES.failed)
  assert.equal(status.localSaved, false)
  assert.equal(status.remoteSynced, true)
})

test('revision save payload includes base revision explicitly', () => {
  const payload = buildRevisionSavePayload({
    canvasData: { nodes: [], edges: [] },
    thumbnailUrl: 'https://cdn.example.com/thumb.png',
    baseRevision: '2026-04-14T01:00:00.000Z'
  })

  assert.equal(payload.baseRevision, '2026-04-14T01:00:00.000Z')
  assert.equal(payload.currentUpdatedAt, '2026-04-14T01:00:00.000Z')
  assert.deepEqual(payload.canvasData, { nodes: [], edges: [] })
})

test('force overwrite save payload omits base revision', () => {
  const payload = buildRevisionSavePayload({
    canvasData: { nodes: [{ id: 'node_1' }], edges: [] },
    baseRevision: 'stale-revision',
    forceOverwrite: true
  })

  assert.equal(Object.hasOwn(payload, 'baseRevision'), false)
  assert.equal(Object.hasOwn(payload, 'currentUpdatedAt'), false)
  assert.deepEqual(payload.canvasData, { nodes: [{ id: 'node_1' }], edges: [] })
})

test('loaded draft without explicit remote success stays local persisted', () => {
  const status = deriveLoadSyncStatus({
    loadSource: 'local-draft',
    remoteSynced: undefined
  })

  assert.equal(status.status, CANVAS_SYNC_STATES.localPersisted)
  assert.equal(status.localSaved, true)
  assert.equal(status.remoteSynced, false)
})

test('loaded remote project is synced only with explicit remote success', () => {
  const status = deriveLoadSyncStatus({
    loadSource: 'remote',
    remoteSynced: true
  })

  assert.equal(status.status, CANVAS_SYNC_STATES.synced)
  assert.equal(status.localSaved, true)
  assert.equal(status.remoteSynced, true)
})


test('loaded cached draft with a remote-synced revision displays as synced', () => {
  const status = deriveLoadSyncStatus({
    loadSource: 'local-draft',
    remoteSynced: true
  })

  assert.equal(status.status, CANVAS_SYNC_STATES.synced)
  assert.equal(status.localSaved, true)
  assert.equal(status.remoteSynced, true)
  assert.equal(status.reason, 'loaded-synced-cache')
})
