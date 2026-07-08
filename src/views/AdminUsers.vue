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
      @go-home="goHome"
    />

    <AdminDashboardSections
      ref="dashboardSectionsRef"
      :active-route-section="activeRouteSection"
      :overview-section="overviewSectionProps"
      :user-service-section="userServiceSectionProps"
      :service-reconciliation-section="serviceReconciliationSectionProps"
      :audit-log-section="auditLogSectionProps"
      :issue-inbox-section="issueInboxSectionProps"
      @activate-service="activateService"
      @activate-user="activateUser"
      @bind-manual-service="openManualServiceDialog"
      @delete-user="deleteUser"
      @disable-service="disableService"
      @load-api-logs="loadApiLogs"
      @load-issues="loadIssues"
      @load-logs="loadLogs"
      @export-issues="exportIssues"
      @notify-issue="notifyIssue"
      @open-issue="openIssue"
      @query-record="queryRecord"
      @reconcile-billing="reconcileBilling"
      @refresh-overview="refreshDashboardOverview"
      @refresh-service-data="refreshServiceData"
      @refresh-users="loadUsers"
      @reset-service="resetService"
      @save-roles="saveRoles"
      @send-issue-digest-email="sendIssueDigestEmail"
      @set-user-page="setUserPage"
      @suspend-user="suspendUser"
      @update-audit-log-query="updateAuditLogQuery"
      @toggle-all-issue-selection="toggleAllVisibleIssueSelection"
      @toggle-issue-selection="toggleIssueSelection"
      @update-issue-query="updateIssueQuery"
      @update-issue-status="setIssueStatus"
      @update-log-query="updateLog302Query"
      @update:record-request-id="recordRequestId = $event"
      @update-role-selection="updateRoleSelection"
      @update-service-limits="updateServiceLimits"
      @update:search-query="userSearchQuery = $event"
      @update:status-filter="userStatusFilter = $event"
    />
    <AdminManualServiceKeyModal
      v-model:show="manualServiceDialogVisible"
      :user="manualServiceUser"
      :loading="manualServiceUser?.id ? !!serviceLoading[manualServiceUser.id] : false"
      @close="closeManualServiceDialog"
      @submit="submitManualServiceBinding"
    />
  </AdminShell>
</template>

<script setup>
import { computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { AdminMobileNav, AdminPageHeader, AdminShell, AdminSidebar } from '@/components/admin'
import { useAdminSectionNavigation } from '@/hooks/useAdminSectionNavigation'
import { AdminDashboardSections, AdminManualServiceKeyModal } from '@/components/admin/features'
import { useAdminAccessState } from '@/hooks/useAdminAccessState'
import { useAdminDashboardData } from '@/hooks/useAdminDashboardData'
import { useAdminDashboardRefresh } from '@/hooks/useAdminDashboardRefresh'
import { useAdminDisplayState } from '@/hooks/useAdminDisplayState'
import { useAdminIssueInbox } from '@/hooks/useAdminIssueInbox'
import { useAdminUsersDashboardSections } from '@/hooks/useAdminUsersDashboardSections'
import { useAdminUserActions } from '@/hooks/useAdminUserActions'
import { useAdminServiceOps } from '@/hooks/useAdminServiceOps'
import { useAdminUsersState } from '@/hooks/useAdminUsersState'
import { useAuthStore } from '@/stores/auth'
import { ADMIN_SECTION_BY_ROUTE_NAME } from '@/utils/adminDisplay'

const router = useRouter()
const route = useRoute()
const auth = useAuthStore()
const dashboardSectionsRef = ref(null)
const activeRouteSection = computed(() => ADMIN_SECTION_BY_ROUTE_NAME[route.name] || 'overview')
const accessState = useAdminAccessState({ auth })
const {
  accessScope, adminAccountLabel, canActivateService, canDisableService, canManageRoles, canManageUserStatus,
  canReadAudit, canReadIssues, canReadUsage, canReadUsers, canReconcileBilling, canResetService,
  canUpdateIssues, canUpdateServiceLimits, displayName, isSelf, showServiceSection, showUserActions
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
  officialUsageSummary,
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
  officialUsageSummary,
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
const refreshDashboardOverview = () => Promise.all([refreshOverview(), loadUsers()])
const refreshServiceData = () => Promise.all([load302All(), loadUsers()])
const issueInbox = useAdminIssueInbox({ canReadIssues, canUpdateIssues })
const {
  exportIssues,
  loadIssues,
  loadingIssues,
  notifyIssue,
  openIssue,
  sendIssueDigestEmail,
  setIssueStatus,
  toggleAllVisibleIssueSelection, toggleIssueSelection,
  updateIssueQuery
} = issueInbox
const { loadAll } = useAdminDashboardRefresh({
  auth,
  canReadAudit,
  canReadIssues,
  canReadUsage,
  canReadUsers,
  load302All,
  loadIssues,
  loadLogs,
  loadUsage,
  loadUsers,
  loading302,
  loadingIssues,
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
  canReadIssues,
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
  activateService, activateUser, closeManualServiceDialog, deleteUser, deleting, disableService, manualServiceDialogVisible,
  manualServiceUser, openManualServiceDialog, reconcileBilling, reconcilingBilling, resetService, saveRoles, saving,
  serviceLoading, statusLoading, submitManualServiceBinding, suspendUser, updateServiceLimits
} = userActions
const {
  auditLogSectionProps,
  issueInboxSectionProps,
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
  issueInbox,
  auth
})
const goHome = () => router.push('/')
</script>
