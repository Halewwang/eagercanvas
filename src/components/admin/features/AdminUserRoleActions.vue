<template>
  <AdminEditorBlock v-if="canManageRoles" class="admin-user-role-actions">
    <div class="admin-user-role-labeled-row">
      <p class="text-[11px] text-white/45">角色</p>
      <div class="admin-user-role-row">
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
          icon="save"
          :disabled="saving[user.id] || user.status === 'deleted' || isSelf(user)"
          @click="emit('save-roles', user)"
        >
          {{ saving[user.id] ? '保存中...' : (isSelf(user) ? '禁止操作自己' : '保存角色') }}
        </AdminEditorMainButton>
      </div>
    </div>
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

<style scoped>
.admin-user-role-actions {
  gap: 0;
}

.admin-user-role-labeled-row {
  display: grid;
  grid-template-columns: 32px minmax(0, 1fr);
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.admin-user-role-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.admin-user-role-row :deep(.admin-editor-select) {
  min-width: 0;
}

.admin-user-role-row :deep(.admin-editor-main) {
  width: auto;
  min-width: 92px;
  white-space: nowrap;
}

@media (max-width: 760px) {
  .admin-user-role-labeled-row {
    grid-template-columns: minmax(0, 1fr);
  }

  .admin-user-role-row {
    grid-template-columns: minmax(0, 1fr);
  }

  .admin-user-role-row :deep(.admin-editor-main) {
    width: 100%;
  }
}
</style>
