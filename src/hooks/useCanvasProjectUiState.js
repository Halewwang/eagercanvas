import { computed, ref } from 'vue'

export const canvasProjectOptions = Object.freeze([
  { label: 'Rename', key: 'rename' },
  { label: 'Duplicate', key: 'duplicate' },
  { label: 'Delete', key: 'delete' }
])

export const useCanvasProjectUiState = ({
  route = { params: {} },
  projects = ref([]),
  currentWorkspace = ref(null)
} = {}) => {
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
    const projectId = String(route.params?.id || '')
    const project = projects.value.find((item) => item.id === projectId)
    return project?.name || 'Untitled'
  })

  const workspaceName = computed(() => currentWorkspace.value?.name || 'Shared Workspace')

  const openRenameModal = () => {
    renameValue.value = projectName.value
    showRenameModal.value = true
  }

  const closeRenameModal = () => {
    showRenameModal.value = false
  }

  const openDeleteModal = () => {
    showDeleteModal.value = true
  }

  const closeDeleteModal = () => {
    showDeleteModal.value = false
  }

  const openShareDialog = () => {
    shareDialogLoading.value = true
    shareTemplateName.value = projectName.value
    shareTemplateDescription.value = ''
    lastPublishedAt.value = ''
    isTemplatePublished.value = false
    showShareModal.value = true
  }

  const finishShareDialog = () => {
    shareDialogLoading.value = false
  }

  const applyShareTemplateStatus = (template) => {
    if (!template) return
    isTemplatePublished.value = !!template.isPublished
    shareTemplateName.value = template.title || projectName.value
    shareTemplateDescription.value = template.description || ''
    lastPublishedAt.value = template.updatedAt || template.publishedAt || ''
  }

  const setShareActionLoading = (loading) => {
    shareActionLoading.value = !!loading
  }

  const applySharedTemplateSave = (template) => {
    isTemplatePublished.value = !!template?.isPublished
    lastPublishedAt.value = template?.updatedAt || template?.publishedAt || ''
  }

  const applySharedTemplateRemoval = () => {
    isTemplatePublished.value = false
    lastPublishedAt.value = ''
  }

  return {
    applySharedTemplateRemoval,
    applySharedTemplateSave,
    applyShareTemplateStatus,
    closeDeleteModal,
    closeRenameModal,
    finishShareDialog,
    isTemplatePublished,
    lastPublishedAt,
    openDeleteModal,
    openRenameModal,
    openShareDialog,
    projectName,
    projectOptions: [...canvasProjectOptions],
    renameValue,
    setShareActionLoading,
    shareActionLoading,
    shareDialogLoading,
    shareTemplateDescription,
    shareTemplateName,
    showDeleteModal,
    showRenameModal,
    showShareModal,
    workspaceName
  }
}

export default useCanvasProjectUiState
