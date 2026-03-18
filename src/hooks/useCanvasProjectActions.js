import { computed, ref } from 'vue'
import { deleteProject, duplicateProject, projects, renameProject } from '@/stores/projects'

export const useCanvasProjectActions = ({
  route,
  router,
  notifier,
  loadWorkflowTemplates,
  shareProjectAsMyTemplate
}) => {
  const showRenameModal = ref(false)
  const showDeleteModal = ref(false)
  const showShareModal = ref(false)
  const renameValue = ref('')
  const shareLinkEnabled = ref(true)
  const allowRemixing = ref(false)
  const shareTemplateName = ref('')
  const shareTemplateDescription = ref('')

  const projectName = computed(() => {
    const project = projects.value.find((item) => item.id === route.params.id)
    return project?.name || 'Untitled'
  })

  const currentProject = computed(
    () => projects.value.find((item) => item.id === route.params.id) || null
  )

  const shareLinkUrl = computed(() => `${window.location.origin}/canvas/${route.params.id}`)

  const projectOptions = [
    { label: 'Rename', key: 'rename' },
    { label: 'Duplicate', key: 'duplicate' },
    { label: 'Delete', key: 'delete' }
  ]

  const copyShareLink = async () => {
    try {
      await navigator.clipboard.writeText(shareLinkUrl.value)
      notifier.success('Share link copied')
    } catch {
      notifier.warning('Copy failed')
    }
  }

  const openShareDialog = async () => {
    await loadWorkflowTemplates()
    shareTemplateName.value = projectName.value
    shareTemplateDescription.value = ''
    showShareModal.value = true
  }

  const saveSharedTemplate = async () => {
    const project = currentProject.value
    if (!project?.id || !project?.canvasData) {
      notifier.error('Project data unavailable')
      return
    }

    const visibility = allowRemixing.value
      ? 'public'
      : shareLinkEnabled.value
        ? 'unlisted'
        : 'private'

    await shareProjectAsMyTemplate({
      projectId: project.id,
      name: shareTemplateName.value || project.name || 'Untitled',
      description: shareTemplateDescription.value || '',
      cover: project.thumbnail || '',
      canvasData: project.canvasData,
      visibility
    })

    notifier.success('Shared to My Templates')
    showShareModal.value = false
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
    allowRemixing,
    confirmDelete,
    confirmRename,
    copyShareLink,
    currentProject,
    handleProjectAction,
    openShareDialog,
    projectName,
    projectOptions,
    renameValue,
    saveSharedTemplate,
    shareLinkEnabled,
    shareLinkUrl,
    shareTemplateDescription,
    shareTemplateName,
    showDeleteModal,
    showRenameModal,
    showShareModal
  }
}

export default useCanvasProjectActions
