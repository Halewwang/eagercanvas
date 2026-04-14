import assert from 'node:assert/strict'
import test from 'node:test'

import {
  CANVAS_SYNC_STATES,
  buildRevisionSavePayload,
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
