import { computed, ref, watch } from 'vue'

import { shouldShowRemoteRefreshControl } from '@/utils/canvasSync'

export const useCanvasSyncResolution = ({
  currentCanvasProjectId,
  projectSaveState,
  route,
  router,
  duplicateProject = async () => '',
  flushSave = async () => false,
  loadProjectById = async () => {},
  notify = {},
  refreshProjectById = async () => {}
} = {}) => {
  const showConflictModal = ref(false)
  const conflictAction = ref('')
  const showRemoteRefreshModal = ref(false)
  const remoteRefreshAction = ref('')

  const syncIndicator = computed(() => {
    if (!currentCanvasProjectId?.value) return null

    const state = projectSaveState?.value || {}
    const status = String(state.status || 'idle')

    if (state.reason === 'read-only') {
      return {
        label: 'Read-only',
        title: 'This team project can be viewed but not edited.',
        dotClass: 'bg-sky-400'
      }
    }

    if (status === 'dirty') {
      return {
        label: 'Unsaved',
        title: 'Changes are waiting to be saved on this device.',
        dotClass: 'bg-amber-400'
      }
    }

    if (status === 'syncing') {
      return {
        label: 'Syncing...',
        title: 'Changes are being uploaded to the cloud.',
        dotClass: 'bg-amber-400'
      }
    }

    if (status === 'conflict') {
      return {
        label: 'Sync conflict',
        title: 'Another device has newer changes. Refresh before editing further.',
        dotClass: 'bg-rose-400'
      }
    }

    if (status === 'synced' && state.remoteSynced === true) {
      return {
        label: 'Synced',
        title: 'This canvas is synced to the cloud.',
        dotClass: 'bg-emerald-400'
      }
    }

    if (status === 'synced') {
      return {
        label: 'Saved locally',
        title: 'Changes are saved on this device. Cloud sync has not completed.',
        dotClass: 'bg-amber-400'
      }
    }

    if (status === 'localPersisted' || status === 'offline') {
      return {
        label: status === 'offline' ? 'Offline saved' : 'Saved locally',
        title: 'Changes are saved on this device. Cloud sync has not completed.',
        dotClass: 'bg-amber-400'
      }
    }

    if (status === 'failed') {
      return {
        label: 'Save failed',
        title: 'The latest changes could not be saved. Keep this page open and try again.',
        dotClass: 'bg-rose-400'
      }
    }

    return null
  })

  const showRemoteRefreshControl = computed(() =>
    shouldShowRemoteRefreshControl(projectSaveState?.value)
  )

  const getActiveProjectId = () => String(currentCanvasProjectId?.value || route?.params?.id || '')

  watch(
    () => projectSaveState?.value?.status,
    (status) => {
      if (status === 'conflict') {
        showConflictModal.value = true
      }
    }
  )

  const cancelConflictResolution = () => {
    if (conflictAction.value) return
    showConflictModal.value = false
  }

  const refreshRemoteConflict = async () => {
    const projectId = getActiveProjectId()
    if (!projectId || conflictAction.value) return
    conflictAction.value = 'refresh'
    try {
      await refreshProjectById(projectId, { preferLocalDraft: false })
      await loadProjectById(projectId)
      showConflictModal.value = false
      notify.success?.('Remote version loaded')
    } catch (error) {
      notify.error?.(error?.message || 'Refresh failed')
    } finally {
      conflictAction.value = ''
    }
  }

  const overwriteRemoteConflict = async () => {
    if (conflictAction.value) return
    conflictAction.value = 'overwrite'
    try {
      const saved = await flushSave({ forceRemoteOverwrite: true })
      if (saved && projectSaveState?.value?.status !== 'conflict') {
        showConflictModal.value = false
        notify.success?.('Remote version overwritten')
      }
    } catch (error) {
      notify.error?.(error?.message || 'Overwrite failed')
    } finally {
      conflictAction.value = ''
    }
  }

  const openRemoteRefreshModal = () => {
    if (remoteRefreshAction.value) return
    showRemoteRefreshModal.value = true
  }

  const confirmRemoteRefresh = async () => {
    const projectId = getActiveProjectId()
    if (!projectId || remoteRefreshAction.value) return
    remoteRefreshAction.value = 'refresh'
    try {
      await refreshProjectById(projectId, { preferLocalDraft: false })
      await loadProjectById(projectId)
      showRemoteRefreshModal.value = false
      notify.success?.('Cloud canvas refreshed')
    } catch (error) {
      notify.error?.(error?.message || 'Refresh failed')
    } finally {
      remoteRefreshAction.value = ''
    }
  }

  const saveConflictAsCopy = async () => {
    const projectId = getActiveProjectId()
    if (!projectId || conflictAction.value) return
    conflictAction.value = 'copy'
    try {
      const newId = await duplicateProject(projectId)
      if (!newId) {
        notify.error?.('Save copy failed')
        return
      }
      showConflictModal.value = false
      notify.success?.('Saved as copy')
      router?.push?.(`/canvas/${newId}`)
    } catch (error) {
      notify.error?.(error?.message || 'Save copy failed')
    } finally {
      conflictAction.value = ''
    }
  }

  return {
    conflictAction,
    remoteRefreshAction,
    showConflictModal,
    showRemoteRefreshControl,
    showRemoteRefreshModal,
    syncIndicator,
    cancelConflictResolution,
    confirmRemoteRefresh,
    openRemoteRefreshModal,
    overwriteRemoteConflict,
    refreshRemoteConflict,
    saveConflictAsCopy
  }
}
