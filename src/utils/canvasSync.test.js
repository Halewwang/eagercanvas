import assert from 'node:assert/strict'
import test from 'node:test'

import { shouldApplyRemoteProjectSnapshot } from './canvasSync.js'

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
