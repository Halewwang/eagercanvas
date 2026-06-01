import { computed } from 'vue'

export const useAdminDashboardRefresh = ({
  auth,
  canReadAudit,
  canReadUsage,
  canReadUsers,
  load302All,
  loadLogs,
  loadUsage,
  loadUsers,
  loading302,
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
    loading302.value
  ))

  const loadAll = async () => {
    const allowed = await auth.loadAdminSession({ force: true })
    if (!allowed) {
      if (import.meta.env.DEV && import.meta.env.VITE_BYPASS_AUTH === 'true') return
      router.replace('/')
      return
    }

    await Promise.all([
      canReadUsage.value && loadUsage(),
      canReadUsers.value && loadUsers(),
      showServiceSection.value && load302All(),
      canReadAudit.value && loadLogs()
    ].filter(Boolean))
  }

  return {
    isRefreshing,
    loadAll
  }
}

export default useAdminDashboardRefresh
