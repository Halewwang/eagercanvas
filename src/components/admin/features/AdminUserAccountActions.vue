<template>
  <AdminEditorCard>
    <AdminUserRoleActions
      :can-manage-roles="canManageRoles"
      :is-self="isSelf"
      :role-options="roleOptions"
      :saving="saving"
      :selected-roles="selectedRoles"
      :user="user"
      @save-roles="emit('save-roles', $event)"
      @update-role-selection="forwardRoleSelection"
    />
    <AdminUserStatusActions
      :can-manage-user-status="canManageUserStatus"
      :deleting="deleting"
      :is-self="isSelf"
      :status-loading="statusLoading"
      :user="user"
      @activate-user="emit('activate-user', $event)"
      @delete-user="emit('delete-user', $event)"
      @suspend-user="emit('suspend-user', $event)"
    />
  </AdminEditorCard>
</template>

<script setup>
import AdminEditorCard from '@/components/admin/AdminEditorCard.vue'
import AdminUserRoleActions from './AdminUserRoleActions.vue'
import AdminUserStatusActions from './AdminUserStatusActions.vue'

const emit = defineEmits([
  'activate-user',
  'delete-user',
  'save-roles',
  'suspend-user',
  'update-role-selection'
])

const {
  canManageRoles,
  canManageUserStatus,
  deleting,
  isSelf,
  roleOptions,
  saving,
  selectedRoles,
  statusLoading,
  user
} = defineProps({
  canManageRoles: {
    type: Boolean,
    default: false
  },
  canManageUserStatus: {
    type: Boolean,
    default: false
  },
  deleting: {
    type: Object,
    default: () => ({})
  },
  isSelf: {
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
  statusLoading: {
    type: Object,
    default: () => ({})
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
