import { computed } from 'vue'
import {
  ADMIN_ROLE_OPTIONS,
  formatAdminDateTime,
  formatAdminJson,
  formatAdminRoleList,
  formatAdminUsd,
  getAdminOverviewCards,
  getAdminRoleLabel,
  getAdminServiceStatusClass,
  getAdminServiceStatusLabel,
  getAdminTopModelLabel,
  getAdminUserStatusClass,
  getAdminUserStatusLabel
} from '@/utils/adminDisplay'

export const useAdminDisplayState = ({
  activeServiceUsers,
  canReadAudit,
  canReadUsage,
  canReadUsers,
  officialUsageSummary,
  pagination,
  usageSummary,
  userStats
}) => {
  const nowLabel = computed(() => new Date().toLocaleDateString())
  const cards = computed(() => getAdminOverviewCards({
    canReadUsers: canReadUsers.value,
    canReadUsage: canReadUsage.value,
    canReadAudit: canReadAudit.value,
    officialUsageSummary: officialUsageSummary?.value,
    userStats: userStats.value,
    usageSummary: usageSummary.value,
    auditTotal: pagination.value.total,
    activeServiceUsers: activeServiceUsers.value
  }))

  return {
    cards,
    formatDateTime: formatAdminDateTime,
    formatRoleList: formatAdminRoleList,
    formatUsd: formatAdminUsd,
    nowLabel,
    roleLabel: getAdminRoleLabel,
    roleOptions: ADMIN_ROLE_OPTIONS,
    serviceStatusClass: getAdminServiceStatusClass,
    serviceStatusLabel: getAdminServiceStatusLabel,
    statusClass: getAdminUserStatusClass,
    statusLabel: getAdminUserStatusLabel,
    toPrettyJson: formatAdminJson,
    topModelLabel: getAdminTopModelLabel
  }
}

export default useAdminDisplayState
