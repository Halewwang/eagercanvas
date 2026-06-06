<template>
  <tr :class="rowClass">
    <AdminUserIdentityCell
      :role-label="roleLabel"
      :status-class="statusClass"
      :status-label="statusLabel"
      :user="user"
    />
    <AdminUserUsageCell
      :format-usd="formatUsd"
      :top-model-label="topModelLabel"
      :user="user"
    />
    <AdminUserReconciliationCell
      :format-date-time="formatDateTime"
      :user="user"
    />
    <AdminUserOperationsCell
      :can-activate-service="canActivateService"
      :can-disable-service="canDisableService"
      :can-manage-roles="canManageRoles"
      :can-manage-user-status="canManageUserStatus"
      :can-reset-service="canResetService"
      :can-update-service-limits="canUpdateServiceLimits"
      :deleting="deleting"
      :is-self="isSelf"
      :role-options="roleOptions"
      :saving="saving"
      :selected-roles="selectedRoles"
      :service-loading="serviceLoading"
      :show-user-actions="showUserActions"
      :status-loading="statusLoading"
      :user="user"
      @activate-service="emit('activate-service', $event)"
      @activate-user="emit('activate-user', $event)"
      @delete-user="emit('delete-user', $event)"
      @disable-service="emit('disable-service', $event)"
      @reset-service="emit('reset-service', $event)"
      @save-roles="emit('save-roles', $event)"
      @suspend-user="emit('suspend-user', $event)"
      @update-role-selection="forwardRoleSelection"
      @update-service-limits="emit('update-service-limits', $event)"
    />
  </tr>
</template>

<script setup>
import AdminUserIdentityCell from './AdminUserIdentityCell.vue'
import AdminUserOperationsCell from './AdminUserOperationsCell.vue'
import AdminUserReconciliationCell from './AdminUserReconciliationCell.vue'
import AdminUserUsageCell from './AdminUserUsageCell.vue'

const emit = defineEmits([
  'activate-service',
  'activate-user',
  'delete-user',
  'disable-service',
  'reset-service',
  'save-roles',
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
  roleLabel: {
    type: Function,
    required: true
  },
  roleOptions: {
    type: Array,
    default: () => []
  },
  rowClass: {
    type: String,
    default: ''
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
  user: {
    type: Object,
    default: () => ({})
  }
})

const forwardRoleSelection = (userId, role) => {
  emit('update-role-selection', userId, role)
}
</script>
