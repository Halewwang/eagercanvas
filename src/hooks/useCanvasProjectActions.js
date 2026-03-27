import { computed, ref } from 'vue'
import { deleteProject, duplicateProject, projects, renameProject } from '@/stores/projects'

export const useCanvasProjectActions = ({
  route,
  router,
  notifier,
  getProjectTemplateStatus,
  publishProjectTemplate,
  unpublishProjectTemplate,
  currentWorkspace
}) => {
  const showRenameModal = ref(false)
  const showDeleteModal = ref(false)
  const showShareModal = ref(false)
  const renameValue = ref('')
  const isTemplatePublished = ref(false)
  const shareTemplateName = ref('')
  const shareTemplateDescription = ref('')
  const shareDialogLoading = ref(false)
  const shareActionLoading = ref(false)
  const lastPublishedAt = ref('')

  const projectName = computed(() => {
    const project = projects.value.find((item) => item.id === route.params.id)
    return project?.name || 'Untitled'
  })

  const projectOptions = [
    { label: 'Rename', key: 'rename' },
    { label: 'Duplicate', key: 'duplicate' },
    { label: 'Delete', key: 'delete' }
  ]

  const openShareDialog = async () => {
    shareDialogLoading.value = true
    shareTemplateName.value = projectName.value
    shareTemplateDescription.value = ''
    lastPublishedAt.value = ''
    isTemplatePublished.value = false
    showShareModal.value = true

    try {
      const template = await getProjectTemplateStatus(route.params.id)
      if (template) {
        isTemplatePublished.value = template.isPublished
        shareTemplateName.value = template.title || projectName.value
        shareTemplateDescription.value = template.description || ''
        lastPublishedAt.value = template.updatedAt || template.publishedAt || ''
      }
    } catch {
      // Keep fallback values when template status is unavailable.
    } finally {
      shareDialogLoading.value = false
    }
  }

  const saveSharedTemplate = async () => {
    const projectId = route.params.id
    if (!projectId) return

    shareActionLoading.value = true
    try {
      const wasPublished = isTemplatePublished.value
      const template = await publishProjectTemplate(projectId, {
        title: shareTemplateName.value || projectName.value || 'Untitled',
        description: shareTemplateDescription.value || ''
      })
      isTemplatePublished.value = !!template?.isPublished
      lastPublishedAt.value = template?.updatedAt || template?.publishedAt || ''
      notifier.success(wasPublished ? 'Template updated' : 'Template published to workspace')
    } finally {
      shareActionLoading.value = false
    }
  }

  const removeSharedTemplate = async () => {
    const projectId = route.params.id
    if (!projectId) return

    shareActionLoading.value = true
    try {
      await unpublishProjectTemplate(projectId)
      isTemplatePublished.value = false
      lastPublishedAt.value = ''
      notifier.success('Template unpublished')
    } finally {
      shareActionLoading.value = false
    }
  }

  const handleProjectAction = async (key) => {
    const projectId = route.params.id
    switch (key) {
      case 'rename':
        renameValue.value = projectName.value
        showRenameModal.value = true
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
        showDeleteModal.value = true
        break
    }
  }

  const confirmRename = async () => {
    const projectId = route.params.id
    if (renameValue.value.trim()) {
      await renameProject(projectId, renameValue.value.trim())
      notifier.success('Project renamed')
    }
    showRenameModal.value = false
  }

  const confirmDelete = async () => {
    const projectId = route.params.id
    if (!projectId) return
    showDeleteModal.value = false
    await deleteProject(projectId)
    notifier.success('Project deleted')
    router.push('/')
  }

  return {
    confirmDelete,
    confirmRename,
    handleProjectAction,
    isTemplatePublished,
    lastPublishedAt,
    openShareDialog,
    projectName,
    projectOptions,
    renameValue,
    removeSharedTemplate,
    saveSharedTemplate,
    shareActionLoading,
    shareDialogLoading,
    shareTemplateDescription,
    shareTemplateName,
    showDeleteModal,
    showRenameModal,
    showShareModal,
    workspaceName: computed(() => currentWorkspace.value?.name || 'Shared Workspace')
  }
}

export default useCanvasProjectActions
