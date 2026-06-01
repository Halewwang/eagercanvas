<template>
  <AdminShell>
    <template #sidebar>
      <AdminSidebar
        :nav-items="navItems"
        :active-section="activeSection"
        :access-scope="accessScope"
        :account-label="adminAccountLabel"
        :roles="auth.roles.value"
        @select-section="scrollToSection"
      />
    </template>

    <AdminMobileNav
      :nav-items="navItems"
      :active-section="activeSection"
      @select-section="scrollToSection"
    />

    <AdminPageHeader
      :display-name="displayName"
      :access-scope="accessScope"
      :is-refreshing="isRefreshing"
      :can-read-users="canReadUsers"
      :show-service-section="showServiceSection"
      @refresh="loadAll"
      @open-users="scrollToSection('users')"
      @open-service="scrollToSection('service')"
      @go-home="goHome"
    />

    <AdminDashboardSections
      ref="dashboardSectionsRef"
      :overview-section="overviewSectionProps"
      :user-service-section="userServiceSectionProps"
      :service-reconciliation-section="serviceReconciliationSectionProps"
      :audit-log-section="auditLogSectionProps"
      @activate-service="activateService"
      @activate-user="activateUser"
      @delete-user="deleteUser"
      @disable-service="disableService"
      @load-api-logs="loadApiLogs"
      @load-logs="loadLogs"
      @query-record="queryRecord"
      @reconcile-billing="reconcileBilling"
      @refresh-overview="refreshOverview"
      @refresh-service-data="load302All"
      @refresh-users="loadUsers"
      @reset-service="resetService"
      @save-roles="saveRoles"
      @set-user-page="setUserPage"
      @suspend-user="suspendUser"
      @update-audit-log-query="updateAuditLogQuery"
      @update-log-query="updateLog302Query"
      @update:record-request-id="recordRequestId = $event"
      @update-role-selection="updateRoleSelection"
      @update-service-limits="updateServiceLimits"
      @update:search-query="userSearchQuery = $event"
      @update:status-filter="userStatusFilter = $event"
    />

  </AdminShell>
</template>

<script setup>
import { computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { AdminMobileNav, AdminPageHeader, AdminShell, AdminSidebar } from '@/components/admin'
import { useAdminSectionNavigation } from '@/hooks/useAdminSectionNavigation'
import { AdminDashboardSections } from '@/components/admin/features'
import { useAdminAccessState } from '@/hooks/useAdminAccessState'
import { useAdminDashboardData } from '@/hooks/useAdminDashboardData'
import { useAdminDashboardRefresh } from '@/hooks/useAdminDashboardRefresh'
import { useAdminDisplayState } from '@/hooks/useAdminDisplayState'
import { useAdminUsersDashboardSections } from '@/hooks/useAdminUsersDashboardSections'
import { useAdminUserActions } from '@/hooks/useAdminUserActions'
import { useAdminServiceOps } from '@/hooks/useAdminServiceOps'
import { useAdminUsersState } from '@/hooks/useAdminUsersState'
import { useAuthStore } from '@/stores/auth'

const router = useRouter()
const route = useRoute()
const auth = useAuthStore()

const dashboardSectionsRef = ref(null)

const accessState = useAdminAccessState({ auth })
const {
  accessScope,
  adminAccountLabel,
  canActivateService,
  canDisableService,
  canManageRoles,
  canManageUserStatus,
  canReadAudit,
  canReadUsage,
  canReadUsers,
  canReconcileBilling,
  canResetService,
  canUpdateServiceLimits,
  displayName,
  isSelf,
  showServiceSection,
  showUserActions
} = accessState

const usersState = useAdminUsersState({
  canReadUsers
})
const {
  activeServiceUsers,
  filteredUsers,
  loadUsers,
  loadingUsers,
  notEnabledActiveUsers,
  pagedUsers,
  pendingBillingUsers,
  selectedRoles,
  serviceActivationRate,
  setUserPage,
  topSpenders,
  totalUserPages,
  updateRoleSelection,
  userPage,
  userPageEnd,
  userPageStart,
  userSearchQuery,
  userStats,
  userStatusFilter,
  users,
  visibleUserPages
} = usersState

const dashboardData = useAdminDashboardData({
  canReadAudit,
  canReadUsage
})
const {
  auditLogs,
  barWidth,
  loadLogs,
  loadUsage,
  loadingLogs,
  loadingOverview,
  loadingUsage,
  logQuery,
  pagination,
  refreshOverview,
  updateAuditLogQuery,
  usageSeries,
  usageSummary
} = dashboardData

const displayState = useAdminDisplayState({
  activeServiceUsers,
  canReadAudit,
  canReadUsage,
  canReadUsers,
  pagination,
  usageSummary,
  userStats
})
const {
  cards,
  formatDateTime,
  formatRoleList,
  formatUsd,
  nowLabel,
  roleLabel,
  roleOptions,
  serviceStatusClass,
  serviceStatusLabel,
  statusClass,
  statusLabel,
  toPrettyJson,
  topModelLabel
} = displayState

const serviceOps = useAdminServiceOps({
  canReadUsage,
  canManageApiKeys: computed(() => false),
  canAssignApiKeys: computed(() => false),
  loadUsers: () => loadUsers(),
  loadLogs: () => loadLogs()
})
const {
  apiLogs,
  balanceDisplay,
  load302All,
  loadApiLogs,
  loading302,
  loadingApiLogs,
  loadingRecord,
  log302Query,
  queryRecord,
  recordData,
  recordRequestId,
  serviceLoadNotice,
  updateLog302Query
} = serviceOps

const {
  isRefreshing,
  loadAll
} = useAdminDashboardRefresh({
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
})

const {
  activeSection,
  navItems,
  scrollToSection
} = useAdminSectionNavigation({
  canReadAudit,
  canReadUsers,
  dashboardSectionsRef,
  loadAll: () => loadAll(),
  route,
  router,
  showServiceSection
})

const userActions = useAdminUserActions({
  canActivateService,
  canDisableService,
  canManageRoles,
  canManageUserStatus,
  canReconcileBilling,
  canResetService,
  canUpdateServiceLimits,
  isSelf: (user) => isSelf(user),
  loadLogs: () => loadLogs(),
  loadUsage: () => loadUsage(),
  loadUsers: () => loadUsers(),
  selectedRoles
})
const {
  activateService,
  activateUser,
  deleteUser,
  deleting,
  disableService,
  reconcileBilling,
  reconcilingBilling,
  resetService,
  saveRoles,
  saving,
  serviceLoading,
  statusLoading,
  suspendUser,
  updateServiceLimits
} = userActions

const {
  auditLogSectionProps,
  overviewSectionProps,
  serviceReconciliationSectionProps,
  userServiceSectionProps
} = useAdminUsersDashboardSections({
  accessState,
  usersState,
  dashboardData,
  displayState,
  serviceOps,
  userActions,
  auth
})

const goHome = () => router.push('/')

</script>
