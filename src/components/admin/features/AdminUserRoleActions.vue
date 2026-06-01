<template>
  <AdminEditorBlock v-if="canManageRoles">
    <p class="text-[11px] text-white/45">角色</p>
    <AdminEditorSelect
      :value="selectedRoles[user.id]"
      :disabled="user.status === 'deleted' || isSelf(user)"
      @change="updateRoleSelection"
    >
      <option v-for="role in roleOptions" :key="`${user.id}-${role.value}`" :value="role.value">
        {{ role.label }}
      </option>
    </AdminEditorSelect>
    <AdminEditorMainButton
      :disabled="saving[user.id] || user.status === 'deleted' || isSelf(user)"
      @click="emit('save-roles', user)"
    >
      {{ saving[user.id] ? '保存中...' : (isSelf(user) ? '禁止操作自己' : '保存角色') }}
    </AdminEditorMainButton>
  </AdminEditorBlock>
</template>

<script setup>
import AdminEditorBlock from '@/components/admin/AdminEditorBlock.vue'
import AdminEditorMainButton from '@/components/admin/AdminEditorMainButton.vue'
import AdminEditorSelect from '@/components/admin/AdminEditorSelect.vue'

const emit = defineEmits([
  'save-roles',
  'update-role-selection'
])

const {
  canManageRoles,
  isSelf,
  roleOptions,
  saving,
  selectedRoles,
  user
} = defineProps({
  canManageRoles: {
    type: Boolean,
    default: false
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
  user: {
    type: Object,
    default: () => ({})
  }
})

const updateRoleSelection = (event) => {
  emit('update-role-selection', user.id, event.target.value)
}
</script>
