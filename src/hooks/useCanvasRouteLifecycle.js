import { nextTick, onMounted, onUnmounted, watch } from 'vue'
import { getMediaAssets } from '@/api'
import { getWorkflowById } from '@/config/workflows'
import { isLocalPreviewEnabled } from '@/utils/localPreview'
import {
  recoverMissingNodeMedia,
  shouldApplyRemoteProjectSnapshot,
  shouldUseCachedProjectBeforeRemote
} from '@/utils/canvasSync'

export const useCanvasRouteLifecycle = ({
  route,
  currentCanvasProjectId,
  edges,
  flowKey,
  groups,
  isLocalPreviewEnabledFn = isLocalPreviewEnabled,
  isMobile,
  nodes,
  nodesFactory,
  bootstrapAuth,
  cleanupOverlayRectUpdates,
  clearViewportSettleTimer,
  consoleRef = console,
  documentRef = typeof document === 'undefined' ? null : document,
  flushSave,
  getMediaAssetsFn = getMediaAssets,
  getProjectCanvas,
  getWorkflowByIdFn = getWorkflowById,
  hasPendingCanvasChanges,
  initProjectsStore,
  loadCachedProjects,
  loadProject,
  nextTickFn = nextTick,
  nowFn = () => Date.now(),
  onMountedFn = onMounted,
  onProjectLoadStateChange = () => {},
  onUnmountedFn = onUnmounted,
  recoverMissingNodeMediaFn = recoverMissingNodeMedia,
  refreshProjectById,
  resetCanvasSession,
  scheduleOverlayRectUpdate,
  sessionStorageRef = typeof sessionStorage === 'undefined' ? null : sessionStorage,
  shouldApplyRemoteProjectSnapshotFn = shouldApplyRemoteProjectSnapshot,
  shouldUseCachedProjectBeforeRemoteFn = shouldUseCachedProjectBeforeRemote,
  stopGroupDrag,
  updateNodeInternals,
  watchFn = watch,
  windowRef = typeof window === 'undefined' ? null : window,
  handleGlobalKeydown
} = {}) => {
  const checkMobile = () => {
    if (!windowRef || !isMobile) return
    isMobile.value = windowRef.innerWidth < 768
  }

  const recoverBlankMediaNodes = async (projectId) => {
    const id = String(projectId || '').trim()
    if (!id || id === 'new') return
    if (isLocalPreviewEnabledFn()) return

    const response = await getMediaAssetsFn({ projectId: id, limit: 100 })
    const items = Array.isArray(response?.items) ? response.items : []
    if (items.length === 0) return

    const recovery = recoverMissingNodeMediaFn({
      nodes: nodes.value,
      edges: edges.value,
      assets: items,
      now: nowFn()
    })

    if (recovery.restoredCount === 0) return

    nodes.value = recovery.nodes
    await nextTickFn()
    recovery.restoredNodeIds.forEach((nodeId) => updateNodeInternals(nodeId))
    await flushSave()
  }

  const loadProjectById = async (projectId) => {
    flowKey.value = nowFn()

    if (projectId && projectId !== 'new') {
      loadProject(projectId)
      onProjectLoadStateChange({ status: 'ready', projectId, error: '' })
      try {
        await recoverBlankMediaNodes(projectId)
      } catch (error) {
        consoleRef.warn('Blank media recovery skipped:', error?.message || error)
      }
      return true
    }

    resetCanvasSession()
    onProjectLoadStateChange({ status: 'ready', projectId: '', error: '' })
    return true
  }

  const ensureProjectSnapshot = async (projectId) => {
    const id = String(projectId || '')
    if (!id || id === 'new') return loadProjectById(id)

    onProjectLoadStateChange({ status: 'loading', projectId: id, error: '' })
    let refreshError = null
    try {
      await refreshProjectById(id)
    } catch (error) {
      refreshError = error
    }

    if (refreshError && !getProjectCanvas(id)) {
      if (String(route.params.id || '') !== id) return false
      onProjectLoadStateChange({
        status: 'error',
        projectId: id,
        error: refreshError?.message || 'Project could not be loaded'
      })
      return false
    }

    if (!shouldApplyRemoteProjectSnapshotFn({
      refreshedProjectId: id,
      activeRouteProjectId: String(route.params.id || ''),
      currentCanvasProjectId: currentCanvasProjectId.value,
      hasPendingCanvasChanges: hasPendingCanvasChanges()
    })) {
      if (String(route.params.id || '') === id) {
        onProjectLoadStateChange({ status: 'ready', projectId: id, error: '' })
      }
      return true
    }

    return loadProjectById(id)
  }

  const applyPendingWorkflowTemplate = async () => {
    const raw = sessionStorageRef?.getItem('ai-canvas-workflow-template')
    if (!raw) return

    sessionStorageRef.removeItem('ai-canvas-workflow-template')

    let payload = null
    try {
      payload = JSON.parse(raw)
    } catch {
      return
    }

    const workflowId = String(payload?.workflowId || '')
    if (!workflowId || nodes.value.length > 0) return

    const workflow = getWorkflowByIdFn(workflowId)
    if (!workflow) return

    await nodesFactory.createFromWorkflow(workflow, {})
  }

  const handlePageHide = () => {
    flushSave()
  }

  const handleVisibilityChange = () => {
    if (documentRef?.visibilityState === 'hidden') {
      flushSave()
    }
  }

  watchFn(
    () => route.params.id,
    async (newId, oldId) => {
      if (newId && newId !== oldId) {
        if (oldId) {
          await flushSave()
        }
        await ensureProjectSnapshot(newId)
      }
    }
  )

  onMountedFn(async () => {
    checkMobile()
    windowRef?.addEventListener?.('resize', checkMobile)
    windowRef?.addEventListener?.('resize', scheduleOverlayRectUpdate)
    windowRef?.addEventListener?.('pagehide', handlePageHide)
    if (handleGlobalKeydown) {
      windowRef?.addEventListener?.('keydown', handleGlobalKeydown)
    }
    documentRef?.addEventListener?.('visibilitychange', handleVisibilityChange)

    const routeProjectId = String(route.params.id || '')
    await bootstrapAuth()
    await loadCachedProjects()
    const cachedCanvasData = routeProjectId && routeProjectId !== 'new'
      ? getProjectCanvas(routeProjectId)
      : null
    const hasWarmProject = shouldUseCachedProjectBeforeRemoteFn({
      projectId: routeProjectId,
      cachedCanvasData
    })

    if (routeProjectId === 'new' || hasWarmProject) {
      void loadProjectById(route.params.id).catch((error) => {
        consoleRef.warn('Cached project load skipped:', error?.message || error)
      })
    }

    let projectsReady
    try {
      projectsReady = Promise.resolve(initProjectsStore())
    } catch (error) {
      projectsReady = Promise.reject(error)
    }
    projectsReady = projectsReady.catch((error) => {
      consoleRef.warn('Project list refresh skipped:', error?.message || error)
      return null
    })

    if (!hasWarmProject) {
      await ensureProjectSnapshot(route.params.id)
    } else if (routeProjectId && routeProjectId !== 'new') {
      void refreshProjectById(routeProjectId).then((project) => {
        if (!shouldApplyRemoteProjectSnapshotFn({
          refreshedProjectId: project?.id || routeProjectId,
          activeRouteProjectId: String(route.params.id || ''),
          currentCanvasProjectId: currentCanvasProjectId.value,
          hasPendingCanvasChanges: hasPendingCanvasChanges()
        })) return
        if (!project?.canvasData) return
        return loadProjectById(routeProjectId)
      }).catch(() => {
        // Keep the already-rendered local draft.
      })
    }
    void projectsReady

    await nextTickFn()
    await applyPendingWorkflowTemplate()
    scheduleOverlayRectUpdate()
  })

  onUnmountedFn(() => {
    windowRef?.removeEventListener?.('resize', checkMobile)
    windowRef?.removeEventListener?.('resize', scheduleOverlayRectUpdate)
    windowRef?.removeEventListener?.('pagehide', handlePageHide)
    if (handleGlobalKeydown) {
      windowRef?.removeEventListener?.('keydown', handleGlobalKeydown)
    }
    documentRef?.removeEventListener?.('visibilitychange', handleVisibilityChange)
    stopGroupDrag()
    cleanupOverlayRectUpdates()
    clearViewportSettleTimer()
    flushSave()
  })

  return {
    applyPendingWorkflowTemplate,
    checkMobile,
    ensureProjectSnapshot,
    handlePageHide,
    handleVisibilityChange,
    loadProjectById,
    recoverBlankMediaNodes,
    retryProjectLoad: () => ensureProjectSnapshot(route.params.id)
  }
}

export default useCanvasRouteLifecycle
