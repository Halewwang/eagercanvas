import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const moduleUrl = new URL('./canvasOfflineSync.js', import.meta.url)
const offlineSync = await import(moduleUrl).catch(() => ({}))
const projectsSource = readFileSync(new URL('./projects.js', import.meta.url), 'utf8')
const canvasDraftsSource = readFileSync(new URL('./canvasDrafts.js', import.meta.url), 'utf8')

const project = {
  id: 'project-1',
  name: 'Offline draft',
  thumbnail: '',
  updatedAt: '2026-05-30T01:00:00.000Z',
  serverUpdatedAt: 'remote-rev-1',
  canvasData: {
    nodes: [],
    edges: [],
    groups: [],
    viewport: { x: 100, y: 50, zoom: 0.8 }
  }
}

test('offline canvas draft sync pushes safe drafts with revision payload and marks draft remote synced', async () => {
  assert.equal(typeof offlineSync.syncOfflineCanvasDraftRecord, 'function')
  const calls = []

  const result = await offlineSync.syncOfflineCanvasDraftRecord({
    project,
    draftRecord: {
      projectId: 'project-1',
      canvasData: {
        nodes: [{ id: 'node_1', type: 'text', data: { label: 'Recovered' } }],
        edges: [],
        groups: [],
        viewport: { x: 10, y: 20, zoom: 1 }
      },
      baseRevision: 'remote-rev-1',
      remoteSynced: false
    },
    patchProject: async (id, payload) => {
      calls.push(['patch', id, payload])
      return {
        data: {
          id,
          name: project.name,
          thumbnail_url: '',
          updated_at: 'remote-rev-2',
          canvas_json: payload.canvasData
        }
      }
    },
    saveDraft: async (id, record) => {
      calls.push(['saveDraft', id, record])
      return true
    },
    publishRemoteSynced: (message) => calls.push(['broadcast', message])
  })

  assert.equal(result.status, 'synced')
  assert.equal(result.remoteSynced, true)
  assert.equal(calls[0][0], 'patch')
  assert.equal(calls[0][1], 'project-1')
  assert.equal(calls[0][2].baseRevision, 'remote-rev-1')
  assert.equal(calls[0][2].currentUpdatedAt, 'remote-rev-1')
  assert.equal(calls[0][2].canvasData.nodes[0].data.label, 'Recovered')
  assert.equal(calls[1][0], 'saveDraft')
  assert.equal(calls[1][2].baseRevision, 'remote-rev-2')
  assert.equal(calls[1][2].remoteSynced, true)
  assert.equal(calls[1][2].status, 'synced')
  assert.equal(calls[2][0], 'broadcast')
  assert.equal(calls[2][1].baseRevision, 'remote-rev-2')
})

test('offline canvas draft sync sanitizes transient media remotely and keeps local draft unsynced', async () => {
  assert.equal(typeof offlineSync.syncOfflineCanvasDraftRecord, 'function')
  const calls = []

  const result = await offlineSync.syncOfflineCanvasDraftRecord({
    project,
    draftRecord: {
      projectId: 'project-1',
      canvasData: {
        nodes: [{
          id: 'image-1',
          type: 'image',
          data: {
            url: 'blob:https://app.local/image',
            previewImageUrl: 'data:image/png;base64,abc',
            label: 'Local media'
          }
        }],
        edges: [],
        groups: [],
        viewport: { x: 0, y: 0, zoom: 1 }
      },
      baseRevision: 'remote-rev-1',
      remoteSynced: false
    },
    patchProject: async (id, payload) => {
      calls.push(['patch', id, payload])
      return {
        data: {
          id,
          name: project.name,
          thumbnail_url: '',
          updated_at: 'remote-rev-2',
          canvas_json: payload.canvasData
        }
      }
    },
    saveDraft: async (id, record) => {
      calls.push(['saveDraft', id, record])
      return true
    },
    publishRemoteSynced: (message) => calls.push(['broadcast', message])
  })

  assert.equal(result.status, 'localPersisted')
  assert.equal(result.remoteSynced, false)
  assert.equal(result.localDraftPreserved, true)
  assert.equal(calls[0][2].canvasData.nodes[0].data.url, undefined)
  assert.equal(calls[0][2].canvasData.nodes[0].data.previewImageUrl, undefined)
  assert.equal(calls[1][2].canvasData.nodes[0].data.url, 'blob:https://app.local/image')
  assert.equal(calls[1][2].remoteSynced, false)
  assert.equal(calls[1][2].baseRevision, 'remote-rev-2')
  assert.equal(calls.some(([type]) => type === 'broadcast'), false)
})

test('projects store exposes online recovery sync for cached draft records', () => {
  assert.match(projectsSource, /syncOfflineCanvasDrafts/)
  assert.match(projectsSource, /syncOfflineCanvasDraftRecord/)
  assert.match(projectsSource, /storage\.hydrate\(\)/)
  assert.match(projectsSource, /canvasBroadcast\.publishRemoteSynced/)
  assert.match(canvasDraftsSource, /projectId: String\(raw\.projectId\)/)
})
