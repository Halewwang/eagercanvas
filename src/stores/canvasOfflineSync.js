import { createCanvasPersistenceSnapshots } from './canvasSnapshots.js'
import {
  CANVAS_SYNC_STATES,
  buildRevisionSavePayload,
  isConflictError
} from './canvasSyncStatus.js'

const defaultCanvasData = {
  nodes: [],
  edges: [],
  groups: [],
  viewport: { x: 100, y: 50, zoom: 0.8 }
}

const getCanvasData = (draftRecord = {}) => draftRecord.canvasData || defaultCanvasData

const getBaseRevision = (project = {}, draftRecord = {}) =>
  String(
    draftRecord.baseRevision
    || draftRecord.baseVersion
    || project.serverUpdatedAt
    || project.updatedAt
    || ''
  ).trim() || null

const getRemoteProject = (row = {}, fallback = {}) => ({
  id: row.id || fallback.id,
  name: row.name || fallback.name,
  thumbnail: row.thumbnail_url || fallback.thumbnail || '',
  createdAt: row.created_at || fallback.createdAt || null,
  updatedAt: row.updated_at || fallback.updatedAt || new Date().toISOString(),
  lastOpenedAt: fallback.lastOpenedAt || null,
  serverUpdatedAt: row.updated_at || fallback.serverUpdatedAt || null,
  readState: 'remote',
  canvasData: Object.prototype.hasOwnProperty.call(row || {}, 'canvas_json')
    ? (row.canvas_json || defaultCanvasData)
    : fallback.canvasData
})

const isPersistedUploadUrl = (value = '') => String(value || '').includes('/storage/v1/object/public/uploads/')

const getProjectThumbnailUrl = (project = '') => {
  const thumbnail = String(project.thumbnail || '').trim()
  return isPersistedUploadUrl(thumbnail) ? thumbnail : null
}

export const shouldSyncOfflineCanvasDraft = ({ project, draftRecord } = {}) => {
  if (!project?.id || !draftRecord?.projectId) return false
  if (String(project.id).startsWith('local-')) return false
  if (draftRecord.remoteSynced === true) return false
  return !!draftRecord.canvasData
}

export const createOfflineCanvasDraftSyncPayload = ({
  project,
  draftRecord,
  forceOverwrite = false
} = {}) => {
  const canvasData = getCanvasData(draftRecord)
  const { containsTransientMedia, localSnapshot, remoteSnapshot } = createCanvasPersistenceSnapshots({
    nodes: canvasData.nodes || [],
    edges: canvasData.edges || [],
    groups: canvasData.groups || [],
    viewport: canvasData.viewport || defaultCanvasData.viewport
  })
  const baseRevision = getBaseRevision(project, draftRecord)
  const payload = buildRevisionSavePayload({
    name: project?.name,
    canvasData: remoteSnapshot,
    thumbnailUrl: getProjectThumbnailUrl(project),
    baseRevision,
    forceOverwrite
  })

  return {
    baseRevision,
    containsTransientMedia,
    localSnapshot,
    payload,
    remoteSnapshot
  }
}

export const syncOfflineCanvasDraftRecord = async ({
  project,
  draftRecord,
  patchProject,
  saveDraft,
  publishRemoteSynced = () => {}
} = {}) => {
  if (!shouldSyncOfflineCanvasDraft({ project, draftRecord })) {
    return {
      status: 'skipped',
      remoteSynced: false,
      localDraftPreserved: false,
      project
    }
  }

  const {
    containsTransientMedia,
    localSnapshot,
    payload
  } = createOfflineCanvasDraftSyncPayload({ project, draftRecord })

  try {
    const response = await patchProject(project.id, payload)
    const remoteProject = getRemoteProject(response?.data, {
      ...project,
      canvasData: payload.canvasData
    })
    const baseRevision = remoteProject.serverUpdatedAt || remoteProject.updatedAt || null

    if (containsTransientMedia) {
      const localDraftProject = {
        ...remoteProject,
        canvasData: localSnapshot,
        readState: 'local-draft',
        serverUpdatedAt: baseRevision,
        updatedAt: draftRecord.draftUpdatedAt || remoteProject.updatedAt
      }
      await saveDraft(project.id, {
        canvasData: localSnapshot,
        draftUpdatedAt: draftRecord.draftUpdatedAt || remoteProject.updatedAt || new Date().toISOString(),
        baseRevision,
        remoteSynced: false,
        status: CANVAS_SYNC_STATES.localPersisted
      })
      return {
        status: CANVAS_SYNC_STATES.localPersisted,
        remoteSynced: false,
        localDraftPreserved: true,
        project: localDraftProject
      }
    }

    await saveDraft(project.id, {
      canvasData: remoteProject.canvasData || payload.canvasData,
      draftUpdatedAt: remoteProject.updatedAt || new Date().toISOString(),
      baseRevision,
      remoteSynced: true,
      status: CANVAS_SYNC_STATES.synced
    })
    publishRemoteSynced({
      projectId: project.id,
      baseRevision,
      draftUpdatedAt: remoteProject.updatedAt || new Date().toISOString()
    })
    return {
      status: CANVAS_SYNC_STATES.synced,
      remoteSynced: true,
      localDraftPreserved: false,
      project: remoteProject
    }
  } catch (error) {
    return {
      status: isConflictError(error) ? CANVAS_SYNC_STATES.conflict : CANVAS_SYNC_STATES.offline,
      remoteSynced: false,
      localDraftPreserved: true,
      error,
      project
    }
  }
}
