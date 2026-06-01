<template>
  <td v-if="canManageRoles || canManageUserStatus" class="px-3 py-4">
    <AdminUserAccountActions
      :can-manage-roles="canManageRoles"
      :can-manage-user-status="canManageUserStatus"
      :deleting="deleting"
      :is-self="isSelf"
      :role-options="roleOptions"
      :saving="saving"
      :selected-roles="selectedRoles"
      :status-loading="statusLoading"
      :user="user"
      @activate-user="emit('activate-user', $event)"
      @delete-user="emit('delete-user', $event)"
      @save-roles="emit('save-roles', $event)"
      @suspend-user="emit('suspend-user', $event)"
      @update-role-selection="forwardRoleSelection"
    />
  </td>
</template>

<script setup>
import AdminUserAccountActions from './AdminUserAccountActions.vue'

const emit = defineEmits([
  'activate-user',
  'delete-user',
  'save-roles',
  'suspend-user',
  'update-role-selection'
])

defineProps({
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
