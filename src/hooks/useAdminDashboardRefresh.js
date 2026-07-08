import { computed } from 'vue'
import {
  getAdminDashboardRefreshLoaderKeys,
  getAdminDashboardSessionOptions
} from './useAdminDashboardRefreshCore.js'

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

  const loadAll = async (options = {}) => {
    const isLocalPreview = import.meta.env.DEV && import.meta.env.VITE_BYPASS_AUTH === 'true'
    const allowed = await auth.loadAdminSession(getAdminDashboardSessionOptions(options))
    if (!allowed) {
      if (isLocalPreview) return
      router.replace('/')
      return
    }
    if (isLocalPreview) return

    const loaders = {
      audit: loadLogs,
      issues: loadIssues,
      service: load302All,
      usage: loadUsage,
      users: loadUsers
    }
    const loaderKeys = getAdminDashboardRefreshLoaderKeys({
      sectionKey: options.sectionKey || 'overview',
      canReadAudit: canReadAudit.value,
      canReadIssues: canReadIssues.value,
      canReadUsage: canReadUsage.value,
      canReadUsers: canReadUsers.value,
      showServiceSection: showServiceSection.value
    })
    await Promise.all(loaderKeys.map((key) => loaders[key]()).filter(Boolean))
  }

  return {
    isRefreshing,
    loadAll
  }
}

export default useAdminDashboardRefresh
