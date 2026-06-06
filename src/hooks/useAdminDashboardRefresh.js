import { computed } from 'vue'

export const useAdminDashboardRefresh = ({
  auth,
  canReadAudit,
  canReadIssues = { value: false },
  canReadUsage,
  canReadUsers,
  load302All,
  loadIssues = async () => {},
  loadLogs,
  loadUsage,
  loadUsers,
  loading302,
  loadingIssues = { value: false },
  loadingLogs,
  loadingOverview,
  loadingUsers,
  router,
  showServiceSection
}) => {
  const isRefreshing = computed(() => (
    loadingOverview.value ||
    loadingUsers.value ||
    loadingLogs.value ||
    loading302.value ||
    loadingIssues.value
  ))

  const loadAll = async () => {
    const isLocalPreview = import.meta.env.DEV && import.meta.env.VITE_BYPASS_AUTH === 'true'
    const allowed = await auth.loadAdminSession({ force: true })
    if (!allowed) {
      if (isLocalPreview) return
      router.replace('/')
      return
    }
    if (isLocalPreview) return

    await Promise.all([
      canReadUsage.value && loadUsage(),
      canReadUsers.value && loadUsers(),
      showServiceSection.value && load302All(),
      canReadAudit.value && loadLogs(),
      canReadIssues.value && loadIssues()
    ].filter(Boolean))
  }

  return {
    isRefreshing,
    loadAll
  }
}

export default useAdminDashboardRefresh
