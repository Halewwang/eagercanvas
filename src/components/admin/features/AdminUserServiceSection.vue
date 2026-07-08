<template>
  <AdminUserServiceHeader :loading-users="loadingUsers" @refresh-users="emit('refresh-users')" />

  <AdminUserServiceSummaryMetrics
    :filtered-user-count="filteredUsers.length"
    :not-enabled-active-count="notEnabledActiveUsers.length"
    :pending-billing-users="pendingBillingUsers"
    :service-activation-rate="serviceActivationRate"
  />

  <AdminUserServiceFilters
    :search-query="searchQuery"
    :status-filter="statusFilter"
    :filtered-user-count="filteredUsers.length"
    :user-page-start="userPageStart"
    :user-page-end="userPageEnd"
    @update:search-query="emit('update:searchQuery', $event)"
    @update:status-filter="emit('update:statusFilter', $event)"
  />

  <AdminUserServiceResultsPanel
    :can-activate-service="canActivateService"
    :can-disable-service="canDisableService"
    :can-manage-roles="canManageRoles"
    :can-manage-user-status="canManageUserStatus"
    :can-reset-service="canResetService"
    :can-update-service-limits="canUpdateServiceLimits"
    :deleting="deleting"
    :format-date-time="formatDateTime"
    :format-usd="formatUsd"
    :filtered-users="filteredUsers"
    :is-self="isSelf"
    :paged-users="pagedUsers"
    :role-label="roleLabel"
    :role-options="roleOptions"
    :saving="saving"
    :selected-roles="selectedRoles"
    :service-loading="serviceLoading"
    :service-status-class="serviceStatusClass"
    :service-status-label="serviceStatusLabel"
    :show-user-actions="showUserActions"
    :status-class="statusClass"
    :status-label="statusLabel"
    :status-loading="statusLoading"
    :top-model-label="topModelLabel"
    :total-user-pages="totalUserPages"
    :user-page="userPage"
    :users="users"
    :visible-user-pages="visibleUserPages"
    @activate-service="emit('activate-service', $event)"
    @activate-user="emit('activate-user', $event)"
    @bind-manual-service="emit('bind-manual-service', $event)"
    @delete-user="emit('delete-user', $event)"
    @disable-service="emit('disable-service', $event)"
    @reset-service="emit('reset-service', $event)"
    @save-roles="emit('save-roles', $event)"
    @suspend-user="emit('suspend-user', $event)"
    @update-role-selection="forwardRoleSelection"
    @update-service-limits="emit('update-service-limits', $event)"
    @set-user-page="emit('set-user-page', $event)"
  />
</template>

<script setup>
import AdminUserServiceFilters from './AdminUserServiceFilters.vue'
import AdminUserServiceHeader from './AdminUserServiceHeader.vue'
import AdminUserServiceResultsPanel from './AdminUserServiceResultsPanel.vue'
import AdminUserServiceSummaryMetrics from './AdminUserServiceSummaryMetrics.vue'

const emit = defineEmits([
  'activate-service',
  'activate-user',
  'bind-manual-service',
  'delete-user',
  'disable-service',
  'refresh-users',
  'reset-service',
  'save-roles',
  'set-user-page',
  'suspend-user',
  'update-role-selection',
  'update-service-limits',
  'update:searchQuery',
  'update:statusFilter'
])

defineProps({
  canActivateService: {
    type: Boolean,
    default: false
  },
  canDisableService: {
    type: Boolean,
    default: false
  },
  canManageRoles: {
    type: Boolean,
    default: false
  },
  canManageUserStatus: {
    type: Boolean,
    default: false
  },
  canResetService: {
    type: Boolean,
    default: false
  },
  canUpdateServiceLimits: {
    type: Boolean,
    default: false
  },
  deleting: {
    type: Object,
    default: () => ({})
  },
  filteredUsers: {
    type: Array,
    default: () => []
  },
  formatDateTime: {
    type: Function,
    required: true
  },
  formatUsd: {
    type: Function,
    required: true
  },
  isSelf: {
    type: Function,
    required: true
  },
  loadingUsers: {
    type: Boolean,
    default: false
  },
  notEnabledActiveUsers: {
    type: Array,
    default: () => []
  },
  pagedUsers: {
    type: Array,
    default: () => []
  },
  pendingBillingUsers: {
    type: Number,
    default: 0
  },
  roleLabel: {
    type: Function,
    required: true
  },
  roleOptions: {
    type: Array,
    default: () => []
  },
  saving: {
    type: Object,
    default: () => ({})
  },
  searchQuery: {
    type: String,
    default: ''
  },
  selectedRoles: {
    type: Object,
    default: () => ({})
  },
  serviceActivationRate: {
    type: Number,
    default: 0
  },
  serviceLoading: {
    type: Object,
    default: () => ({})
  },
  serviceStatusClass: {
    type: Function,
    required: true
  },
  serviceStatusLabel: {
    type: Function,
    required: true
  },
  showUserActions: {
    type: Boolean,
    default: false
  },
  statusClass: {
    type: Function,
    required: true
  },
  statusFilter: {
    type: String,
    default: 'all'
  },
  statusLabel: {
    type: Function,
    required: true
  },
  statusLoading: {
    type: Object,
    default: () => ({})
  },
  topModelLabel: {
    type: Function,
    required: true
  },
  totalUserPages: {
    type: Number,
    default: 1
  },
  userPage: {
    type: Number,
    default: 1
  },
  userPageEnd: {
    type: Number,
    default: 0
  },
  userPageStart: {
    type: Number,
    default: 0
  },
  users: {
    type: Array,
    default: () => []
  },
  visibleUserPages: {
    type: Array,
    default: () => []
  }
})

const forwardRoleSelection = (userId, role) => {
  emit('update-role-selection', userId, role)
}
</script>
