import assert from 'node:assert/strict'
import test from 'node:test'

import {
  createMemoryDraftDriver,
  createCanvasDraftStorage,
  normalizeCanvasDraftRecord
} from './canvasDrafts.js'

const sampleCanvas = (label = 'draft') => ({
  nodes: [{ id: 'node_1', type: 'text', data: { label } }],
  edges: [],
  groups: [],
  viewport: { x: 10, y: 20, zoom: 1 }
})

test('reload loads durable canvas draft from IndexedDB driver', async () => {
  const driver = createMemoryDraftDriver()
  const firstSession = createCanvasDraftStorage({ driver, userId: 'user-1' })
  const secondSession = createCanvasDraftStorage({ driver, userId: 'user-1' })

  await firstSession.saveDraft('project-1', {
    canvasData: sampleCanvas('saved locally'),
    baseRevision: 'remote-rev-1',
    remoteSynced: false,
    status: 'localPersisted'
  })

  const loaded = await secondSession.loadDraft('project-1')

  assert.equal(loaded.canvasData.nodes[0].data.label, 'saved locally')
  assert.equal(loaded.baseRevision, 'remote-rev-1')
  assert.equal(loaded.status, 'localPersisted')
})

test('migrates legacy localStorage canvas draft and removes the full payload key', async () => {
  const removedKeys = []
  const localStorageLike = {
    values: new Map([
      [
        'ai-canvas-project-canvas-draft:user-1:project-1',
        JSON.stringify({
          canvasData: sampleCanvas('legacy'),
          baseVersion: 'legacy-rev',
          draftUpdatedAt: '2026-04-14T00:00:00.000Z',
          remoteSynced: false
        })
      ]
    ]),
    key(index) {
      return Array.from(this.values.keys())[index] || null
    },
    get length() {
      return this.values.size
    },
    getItem(key) {
      return this.values.get(key) || null
    },
    removeItem(key) {
      removedKeys.push(key)
      this.values.delete(key)
    }
  }
  const storage = createCanvasDraftStorage({
    driver: createMemoryDraftDriver(),
    userId: 'user-1',
    localStorage: localStorageLike
  })

  const migrated = await storage.migrateLegacyLocalStorageDrafts()
  const loaded = await storage.loadDraft('project-1')

  assert.equal(migrated, 1)
  assert.equal(loaded.canvasData.nodes[0].data.label, 'legacy')
  assert.equal(loaded.baseRevision, 'legacy-rev')
  assert.deepEqual(removedKeys, ['ai-canvas-project-canvas-draft:user-1:project-1'])
})

test('normalizes legacy draft version fields to baseRevision', () => {
  const normalized = normalizeCanvasDraftRecord({
    canvasData: sampleCanvas(),
    baseVersion: 'updated-at-value',
    remoteSynced: true
  })

  assert.equal(normalized.baseRevision, 'updated-at-value')
  assert.equal(normalized.remoteSynced, true)
})
