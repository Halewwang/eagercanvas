<template>
  <AdminTableShell min-width-class="min-w-[960px]">
    <template #header>
      <AdminUserServiceTableHeader
        :can-manage-roles="canManageRoles"
        :can-manage-user-status="canManageUserStatus"
        :show-user-actions="showUserActions"
      />
    </template>
    <template #default="{ rowClass }">
      <AdminUserServiceRow
        v-for="item in pagedUsers"
        :key="item.id"
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
        :role-label="roleLabel"
        :role-options="roleOptions"
        :row-class="rowClass"
        :saving="saving"
        :selected-roles="selectedRoles"
        :service-loading="serviceLoading"
        :service-status-label="serviceStatusLabel"
        :show-user-actions="showUserActions"
        :status-class="statusClass"
        :status-label="statusLabel"
        :status-loading="statusLoading"
        :top-model-label="topModelLabel"
        :user="item"
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
    </template>
  </AdminTableShell>
</template>

<script setup>
import AdminTableShell from '@/components/admin/AdminTableShell.vue'
import AdminUserServiceRow from './AdminUserServiceRow.vue'
import AdminUserServiceTableHeader from './AdminUserServiceTableHeader.vue'

const emit = defineEmits([
  'activate-service',
  'activate-user',
  'bind-manual-service',
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
  }
})

const forwardRoleSelection = (userId, role) => {
  emit('update-role-selection', userId, role)
}
</script>
