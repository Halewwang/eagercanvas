import { deleteProject, duplicateProject, projects, renameProject } from '@/stores/projects'
import { useCanvasProjectUiState } from './useCanvasProjectUiState.js'

export const useCanvasProjectActions = ({
  route,
  router,
  notifier,
  getProjectTemplateStatus,
  publishProjectTemplate,
  unpublishProjectTemplate,
  currentWorkspace
}) => {
  const uiState = useCanvasProjectUiState({
    route,
    projects,
    currentWorkspace
  })
  const {
    applySharedTemplateRemoval,
    applySharedTemplateSave,
    applyShareTemplateStatus,
    closeDeleteModal,
    closeRenameModal,
    finishShareDialog,
    isTemplatePublished,
    openDeleteModal,
    openRenameModal,
    openShareDialog: openShareModal,
    projectName,
    renameValue,
    setShareActionLoading,
    shareTemplateDescription,
    shareTemplateName
  } = uiState

  const openShareDialog = async () => {
    openShareModal()

    try {
      const template = await getProjectTemplateStatus(route.params.id)
      applyShareTemplateStatus(template)
    } catch {
      // Keep fallback values when template status is unavailable.
    } finally {
      finishShareDialog()
    }
  }

  const saveSharedTemplate = async () => {
    const projectId = route.params.id
    if (!projectId) return

    setShareActionLoading(true)
    try {
      const wasPublished = isTemplatePublished.value
      const template = await publishProjectTemplate(projectId, {
        title: shareTemplateName.value || projectName.value || 'Untitled',
        description: shareTemplateDescription.value || ''
      })
      applySharedTemplateSave(template)
      notifier.success(wasPublished ? 'Template updated' : 'Template published to workspace')
    } finally {
      setShareActionLoading(false)
    }
  }

  const removeSharedTemplate = async () => {
    const projectId = route.params.id
    if (!projectId) return

    setShareActionLoading(true)
    try {
      await unpublishProjectTemplate(projectId)
      applySharedTemplateRemoval()
      notifier.success('Template unpublished')
    } finally {
      setShareActionLoading(false)
    }
  }

  const handleProjectAction = async (key) => {
    const projectId = route.params.id
    switch (key) {
      case 'rename':
        openRenameModal()
        break
      case 'duplicate': {
        if (!projectId) return
        const newId = await duplicateProject(projectId)
        if (newId) {
          notifier.success('Project duplicated')
          router.push(`/canvas/${newId}`)
        } else {
          notifier.error('Duplicate failed')
        }
        break
      }
      case 'delete':
        openDeleteModal()
        break
    }
  }

  const confirmRename = async () => {
    const projectId = route.params.id
    if (renameValue.value.trim()) {
      await renameProject(projectId, renameValue.value.trim())
      notifier.success('Project renamed')
    }
    closeRenameModal()
  }

  const confirmDelete = async () => {
    const projectId = route.params.id
    if (!projectId) return
    closeDeleteModal()
    await deleteProject(projectId)
    notifier.success('Project deleted')
    router.push('/')
  }

  return {
    ...uiState,
    confirmDelete,
    confirmRename,
    handleProjectAction,
    openShareDialog,
    removeSharedTemplate,
    saveSharedTemplate
  }
}

export default useCanvasProjectActions
