import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'

import {
  cloneProjectCanvasData,
  defaultCanvasData,
  getProjectBaseVersion,
  getProjectCanvasDataKey,
  hasCanvasContent,
  mapProjectFromApi,
  mapProjectToApi,
  mergeCachedProjectSummaries,
  resolveProjectThumbnail,
  sortProjectsByActivity,
  toProjectSummary
} from './projectsData.js'

const persistedUrl = (name) => `https://cdn.example.com/storage/v1/object/public/uploads/${name}`

test('project data helpers preserve API mapping and thumbnail sanitization', () => {
  const remoteWithCanvas = mapProjectFromApi({
    id: 'project-1',
    name: 'Remote Project',
    thumbnail_url: 'https://example.com/thumb.png',
    created_at: '2026-05-01T00:00:00.000Z',
    updated_at: '2026-05-02T00:00:00.000Z',
    canvas_json: null
  })

  assert.deepEqual(remoteWithCanvas, {
    id: 'project-1',
    name: 'Remote Project',
    thumbnail: 'https://example.com/thumb.png',
    workspaceId: '',
    accessMode: 'private',
    permission: 'owner',
    ownerUserId: '',
    ownerDisplayName: '',
    ownerAvatarUrl: '',
    ownerUsername: '',
    ownerEmail: '',
    createdAt: '2026-05-01T00:00:00.000Z',
    updatedAt: '2026-05-02T00:00:00.000Z',
    lastOpenedAt: null,
    serverUpdatedAt: '2026-05-02T00:00:00.000Z',
    readState: 'remote',
    canvasData: { ...defaultCanvasData }
  })

  assert.equal(
    mapProjectFromApi({
      id: 'project-2',
      name: 'Remote Without Canvas',
      created_at: '2026-05-01T00:00:00.000Z',
      updated_at: '2026-05-02T00:00:00.000Z'
    }).canvasData,
    undefined
  )

  assert.deepEqual(mapProjectToApi({
    name: 'Local Project',
    canvasData: { nodes: [{ id: 'n1' }] },
    thumbnail: persistedUrl('thumb.png')
  }), {
    name: 'Local Project',
    canvasData: { nodes: [{ id: 'n1' }] },
    thumbnailUrl: persistedUrl('thumb.png')
  })

  assert.equal(mapProjectToApi({ name: 'Draft', thumbnail: 'blob:local-preview' }).thumbnailUrl, null)
  assert.equal(mapProjectToApi({ name: 'Remote Temporary', thumbnail: 'https://example.com/tmp.png' }).thumbnailUrl, null)
})

test('project data helpers preserve canvas cloning, summary, content, and version behavior', () => {
  const canvasData = {
    nodes: [{ id: 'node-1', data: { text: 'hello' } }],
    edges: [],
    viewport: { x: 1, y: 2, zoom: 0.7 }
  }
  const cloned = cloneProjectCanvasData(canvasData)

  assert.deepEqual(cloned, canvasData)
  assert.notEqual(cloned, canvasData)
  assert.notEqual(cloned.nodes, canvasData.nodes)
  assert.equal(getProjectCanvasDataKey(canvasData), JSON.stringify(canvasData))
  assert.equal(hasCanvasContent({ nodes: [] }), false)
  assert.equal(hasCanvasContent({ groups: [{ id: 'group-1' }] }), true)
  assert.equal(getProjectBaseVersion({ serverUpdatedAt: 'server', updatedAt: 'local' }, 'fallback'), 'server')
  assert.equal(getProjectBaseVersion({ updatedAt: 'local' }, 'fallback'), 'fallback')
  assert.equal(getProjectBaseVersion({ updatedAt: 'local' }), 'local')
  assert.equal(getProjectBaseVersion({}), null)

  assert.deepEqual(toProjectSummary({
    id: 'project-1',
    name: 'Untitled',
    thumbnail: '',
    serverUpdatedAt: '2026-05-02T00:00:00.000Z'
  }, '2026-05-03T00:00:00.000Z'), {
    id: 'project-1',
    name: 'Untitled',
    thumbnail: '',
    workspaceId: '',
    accessMode: 'private',
    permission: 'owner',
    ownerUserId: '',
    ownerDisplayName: '',
    ownerAvatarUrl: '',
    ownerUsername: '',
    ownerEmail: '',
    createdAt: '2026-05-03T00:00:00.000Z',
    updatedAt: '2026-05-03T00:00:00.000Z',
    lastOpenedAt: null,
    serverUpdatedAt: '2026-05-02T00:00:00.000Z'
  })
})

test('project thumbnail resolution keeps image priority and ignores transient media', () => {
  const imageUrl = persistedUrl('image-new.png')
  const olderImageUrl = persistedUrl('image-old.png')
  const videoUrl = persistedUrl('video-new.mp4')

  assert.equal(resolveProjectThumbnail({
    nodes: [
      { type: 'image', data: { url: olderImageUrl, updatedAt: '2026-05-01T00:00:00.000Z' } },
      { type: 'video', data: { url: videoUrl, updatedAt: '2026-05-04T00:00:00.000Z' } },
      { type: 'image', data: { url: 'blob:local-preview', updatedAt: '2026-05-05T00:00:00.000Z' } },
      { type: 'image', data: { url: imageUrl, updatedAt: '2026-05-03T00:00:00.000Z' } }
    ]
  }, 'current-thumb'), imageUrl)

  assert.equal(resolveProjectThumbnail({
    nodes: [
      { type: 'image', data: { url: 'https://example.com/tmp.png', updatedAt: '2026-05-05T00:00:00.000Z' } },
      { type: 'video', data: { url: videoUrl, updatedAt: '2026-05-04T00:00:00.000Z' } }
    ]
  }, 'current-thumb'), videoUrl)

  assert.equal(resolveProjectThumbnail({ nodes: [] }, 'current-thumb'), 'current-thumb')
})

test('project activity sorting ignores last-opened timestamps', () => {
  const sorted = sortProjectsByActivity([
    {
      id: 'old-activity',
      createdAt: '2026-05-01T00:00:00.000Z',
      updatedAt: '2026-05-01T00:00:00.000Z',
      lastOpenedAt: '2026-06-01T00:00:00.000Z'
    },
    {
      id: 'new-activity',
      createdAt: '2026-05-02T00:00:00.000Z',
      updatedAt: '2026-05-02T00:00:00.000Z',
      lastOpenedAt: '2026-05-02T00:00:00.000Z'
    }
  ])

  assert.deepEqual(sorted.map((item) => item.id), ['new-activity', 'old-activity'])
})

test('cached project summaries preserve existing remote project details', () => {
  const merged = mergeCachedProjectSummaries([
    {
      id: 'project-1',
      name: 'Cached Summary',
      updatedAt: '2026-05-01T00:00:00.000Z',
      lastOpenedAt: '2026-05-03T00:00:00.000Z',
      remoteSynced: true
    }
  ], [
    {
      id: 'project-1',
      name: 'Remote Detail',
      updatedAt: '2026-05-02T00:00:00.000Z',
      serverUpdatedAt: '2026-05-02T00:00:00.000Z',
      readState: 'remote',
      canvasData: { nodes: [{ id: 'remote-node' }], edges: [], groups: [] }
    },
    {
      id: 'project-2',
      name: 'Remote Only',
      updatedAt: '2026-05-04T00:00:00.000Z',
      readState: 'remote'
    }
  ])

  assert.equal(merged[0].name, 'Remote Detail')
  assert.equal(merged[0].readState, 'remote')
  assert.deepEqual(merged[0].canvasData.nodes, [{ id: 'remote-node' }])
  assert.equal(merged[0].lastOpenedAt, '2026-05-03T00:00:00.000Z')
  assert.equal(merged[1].id, 'project-2')
})

test('cached project summaries keep unsynced local drafts ahead of remote details', () => {
  const merged = mergeCachedProjectSummaries([
    {
      id: 'project-1',
      name: 'Unsynced Draft Summary',
      updatedAt: '2026-05-03T00:00:00.000Z',
      remoteSynced: false
    }
  ], [
    {
      id: 'project-1',
      name: 'Remote Detail',
      updatedAt: '2026-05-02T00:00:00.000Z',
      readState: 'remote',
      canvasData: { nodes: [{ id: 'remote-node' }], edges: [] }
    }
  ])

  assert.equal(merged[0].name, 'Unsynced Draft Summary')
  assert.equal(merged[0].readState, 'local-cache')
  assert.equal(merged[0].canvasData, undefined)
})

test('cached project summaries do not replace newer synced cache with older remote detail', () => {
  const merged = mergeCachedProjectSummaries([
    {
      id: 'project-1',
      name: 'Newer Synced Cache',
      updatedAt: '2026-05-03T00:00:00.000Z',
      remoteSynced: true
    }
  ], [
    {
      id: 'project-1',
      name: 'Older Remote Detail',
      updatedAt: '2026-05-02T00:00:00.000Z',
      readState: 'remote',
      canvasData: { nodes: [{ id: 'old-remote-node' }], edges: [] }
    }
  ])

  assert.equal(merged[0].name, 'Newer Synced Cache')
  assert.equal(merged[0].readState, 'local-cache')
  assert.equal(merged[0].canvasData, undefined)
})

test('projects store delegates pure project data helpers to projectsData', () => {
  const source = readFileSync(new URL('./projects.js', import.meta.url), 'utf8')

  assert.match(source, /from '\.\/projectsData\.js'/)
  assert.doesNotMatch(source, /const defaultCanvasData =/)
  assert.doesNotMatch(source, /const mapProjectFromApi =/)
  assert.doesNotMatch(source, /const resolveProjectThumbnail =/)
  assert.doesNotMatch(source, /const sortProjectsByActivity =/)
})
