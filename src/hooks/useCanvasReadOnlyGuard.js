import { computed } from 'vue'

export const useCanvasReadOnlyGuard = ({
  currentProjectId,
  projects,
  projectOptions,
  handleProjectAction,
  requestProjectEditAccess,
  notify
}) => {
  const currentProject = computed(() => (
    projects.value.find((project) => project.id === currentProjectId.value) || null
  ))

  const isReadOnlyProject = computed(() => currentProject.value?.permission === 'viewer')

  const projectOptionsForPermission = computed(() => (
    isReadOnlyProject.value
      ? [{ label: 'Request edit access', key: 'request-edit' }]
      : projectOptions
  ))

  const warnReadOnly = () => {
    notify?.warning?.('This team project is read-only')
  }

  const requestCanvasEditAccess = async () => {
    if (!currentProjectId.value) return
    try {
      await requestProjectEditAccess(currentProjectId.value)
      notify?.success?.('Edit access requested')
    } catch (error) {
      notify?.error?.(error?.message || 'Failed to request edit access')
    }
  }

  const handleProjectActionWithPermission = async (key) => {
    if (key === 'request-edit') {
      await requestCanvasEditAccess()
      return
    }
    if (isReadOnlyProject.value) {
      warnReadOnly()
      return
    }
    await handleProjectAction(key)
  }

  return {
    currentProject,
    isReadOnlyProject,
    projectOptionsForPermission,
    requestCanvasEditAccess,
    handleProjectActionWithPermission,
    warnReadOnly
  }
}

export default useCanvasReadOnlyGuard
