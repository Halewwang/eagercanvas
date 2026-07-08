<template>
  <AdminUserServiceEmptyState v-if="filteredUsers.length === 0" :users="users" />
  <AdminUserServiceTable
    v-else
    :can-activate-service="canActivateService"
    :can-disable-service="canDisableService"
    :can-manage-roles="canManageRoles"
    :can-manage-user-status="canManageUserStatus"
    :can-reset-service="canResetService"
    :can-update-service-limits="canUpdateServiceLimits"
    :deleting="deleting"
    :format-date-time="formatDateTime"
    :format-usd="formatUsd"
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
  />

  <AdminUserServicePagination
    :total-user-pages="totalUserPages"
    :user-page="userPage"
    :visible-user-pages="visibleUserPages"
    @set-user-page="emit('set-user-page', $event)"
  />
</template>

<script setup>
import AdminUserServiceEmptyState from './AdminUserServiceEmptyState.vue'
import AdminUserServicePagination from './AdminUserServicePagination.vue'
import AdminUserServiceTable from './AdminUserServiceTable.vue'

const emit = defineEmits([
  'activate-service',
  'activate-user',
  'bind-manual-service',
  'delete-user',
  'disable-service',
  'reset-service',
  'save-roles',
  'set-user-page',
  'suspend-user',
  'update-role-selection',
  'update-service-limits'
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
  pagedUsers: {
    type: Array,
    default: () => []
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
  selectedRoles: {
    type: Object,
    default: () => ({})
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
