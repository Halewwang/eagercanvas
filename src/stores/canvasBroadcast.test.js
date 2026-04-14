import assert from 'node:assert/strict'
import test from 'node:test'

import {
  createCanvasBroadcastCoordinator,
  createMemoryBroadcastBus
} from './canvasBroadcast.js'

test('multi-tab broadcast sends project status without full canvas payload', () => {
  const bus = createMemoryBroadcastBus()
  const tabA = createCanvasBroadcastCoordinator({ bus, tabId: 'tab-a' })
  const tabB = createCanvasBroadcastCoordinator({ bus, tabId: 'tab-b' })
  const received = []

  tabB.subscribe((message) => received.push(message))
  tabA.publishDraftSaved({
    projectId: 'project-1',
    draftUpdatedAt: '2026-04-14T00:00:00.000Z',
    baseRevision: 'rev-1',
    status: 'localPersisted',
    canvasData: { nodes: [{ id: 'node_1' }] }
  })

  assert.equal(received.length, 1)
  assert.equal(received[0].projectId, 'project-1')
  assert.equal(received[0].baseRevision, 'rev-1')
  assert.equal(Object.hasOwn(received[0], 'canvasData'), false)
})
