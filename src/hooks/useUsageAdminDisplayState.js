import { computed } from 'vue'
import {
  formatAdminDateTime,
  formatAdminExpire,
  getUsageAdminOverviewMetrics,
  getUsageAdminSessionSummary,
  getUsageAdminSidebarItems,
  maskAdminApiKey
} from '@/utils/adminDisplay'

export const useUsageAdminDisplayState = ({
  adminSession,
  apiKeys,
  balance,
  isAdminAuthenticated,
  users
}) => {
  const sidebarNavItems = computed(() => getUsageAdminSidebarItems({
    users: users.value,
    apiKeys: apiKeys.value
  }))
  const sidebarSessionSummary = computed(() => getUsageAdminSessionSummary({
    adminSession: adminSession.value,
    isAuthenticated: isAdminAuthenticated.value
  }))
  const overviewMetrics = computed(() => getUsageAdminOverviewMetrics({
    balance: balance.value,
    users: users.value,
    apiKeys: apiKeys.value
  }))

  return {
    formatDateTime: formatAdminDateTime,
    formatExpire: formatAdminExpire,
    maskApiKey: maskAdminApiKey,
    overviewMetrics,
    sidebarNavItems,
    sidebarSessionSummary
  }
}

export default useUsageAdminDisplayState
