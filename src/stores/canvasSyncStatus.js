export const CANVAS_SYNC_STATES = Object.freeze({
  dirty: 'dirty',
  localPersisted: 'localPersisted',
  syncing: 'syncing',
  synced: 'synced',
  offline: 'offline',
  conflict: 'conflict',
  failed: 'failed'
})

export const createSyncStatus = ({
  status = CANVAS_SYNC_STATES.dirty,
  localSaved = false,
  remoteSynced = false,
  hasTransientMedia = false,
  reason = '',
  error = null
} = {}) => ({
  status,
  localSaved,
  remoteSynced,
  hasTransientMedia,
  reason,
  error
})

export const isConflictError = (error) =>
  Number(error?.status || error?.response?.status || 0) === 409
  || error?.code === 'PROJECT_CONFLICT'
  || error?.response?.data?.code === 'PROJECT_CONFLICT'

export const isOfflineError = (error) => {
  const status = Number(error?.status || error?.response?.status || 0)
  if (status) return false
  const message = String(error?.message || '').toLowerCase()
  return !message || message.includes('network') || message.includes('offline') || message.includes('timeout') || message.includes('failed to fetch')
}

export const deriveSyncStatusFromSaveResult = ({
  localSaved = false,
  remoteSynced = false,
  hasTransientMedia = false,
  error = null,
  status = ''
} = {}) => {
  if (remoteSynced) {
    return createSyncStatus({
      status: CANVAS_SYNC_STATES.synced,
      localSaved,
      remoteSynced: true,
      hasTransientMedia,
      reason: 'remote-saved',
      error: null
    })
  }

  if (isConflictError(error) || status === CANVAS_SYNC_STATES.conflict) {
    return createSyncStatus({
      status: CANVAS_SYNC_STATES.conflict,
      localSaved,
      remoteSynced: false,
      hasTransientMedia,
      reason: 'revision-conflict',
      error
    })
  }

  if (localSaved && (isOfflineError(error) || status === CANVAS_SYNC_STATES.offline)) {
    return createSyncStatus({
      status: CANVAS_SYNC_STATES.offline,
      localSaved: true,
      remoteSynced: false,
      hasTransientMedia,
      reason: 'remote-unavailable',
      error
    })
  }

  if (localSaved) {
    return createSyncStatus({
      status: CANVAS_SYNC_STATES.localPersisted,
      localSaved: true,
      remoteSynced: false,
      hasTransientMedia,
      reason: hasTransientMedia ? 'transient-media-local' : 'local-draft',
      error
    })
  }

  return createSyncStatus({
    status: CANVAS_SYNC_STATES.failed,
    localSaved: false,
    remoteSynced: false,
    hasTransientMedia,
    reason: 'local-persist-failed',
    error
  })
}

export const buildRevisionSavePayload = ({
  name,
  canvasData,
  thumbnailUrl,
  baseRevision
} = {}) => {
  const payload = {}
  if (name !== undefined) payload.name = name
  if (canvasData !== undefined) payload.canvasData = canvasData
  if (thumbnailUrl !== undefined) payload.thumbnailUrl = thumbnailUrl
  if (baseRevision) {
    payload.baseRevision = baseRevision
    payload.currentUpdatedAt = baseRevision
  }
  return payload
}
