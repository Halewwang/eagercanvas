<template>
  <td v-if="showUserActions || canManageRoles || canManageUserStatus" class="admin-user-operations-cell px-3 py-4">
    <AdminEditorCard class="admin-user-operations-card">
      <AdminEditorBlock
        v-if="showUserActions"
        class="admin-user-operations-section admin-user-operations-service"
      >
        <div class="admin-user-operations-labeled-row">
          <p class="text-[11px] text-white/45">服务</p>
          <div class="admin-user-operations-action-slot">
            <AdminUserServiceActivationAction
              :can-activate-service="canActivateService"
              :service-loading="serviceLoading"
              :user="user"
              @activate-service="emit('activate-service', $event)"
            />
            <AdminUserServiceActiveActions
              :can-disable-service="canDisableService"
              :can-reset-service="canResetService"
              :can-update-service-limits="canUpdateServiceLimits"
              :service-loading="serviceLoading"
              :user="user"
              @disable-service="emit('disable-service', $event)"
              @reset-service="emit('reset-service', $event)"
              @update-service-limits="emit('update-service-limits', $event)"
            />
          </div>
        </div>
      </AdminEditorBlock>
      <div
        v-if="canManageRoles || canManageUserStatus"
        class="admin-user-operations-account"
      >
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
      </div>
    </AdminEditorCard>
  </td>
</template>

<script setup>
import AdminEditorBlock from '@/components/admin/AdminEditorBlock.vue'
import AdminEditorCard from '@/components/admin/AdminEditorCard.vue'
import AdminUserRoleActions from './AdminUserRoleActions.vue'
import AdminUserServiceActivationAction from './AdminUserServiceActivationAction.vue'
import AdminUserServiceActiveActions from './AdminUserServiceActiveActions.vue'
import AdminUserStatusActions from './AdminUserStatusActions.vue'

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
  serviceLoading: {
    type: Object,
    default: () => ({})
  },
  showUserActions: {
    type: Boolean,
    default: false
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

<style scoped>
.admin-user-operations-cell {
  min-width: 280px;
  width: 28%;
}

.admin-user-operations-card {
  display: grid;
  min-width: 240px;
  min-height: 138px;
  gap: 8px;
  padding: 9px;
  background: rgba(255, 255, 255, 0.025);
}

.admin-user-operations-account {
  min-width: 0;
}

.admin-user-operations-service {
  gap: 0;
}

.admin-user-operations-account {
  display: grid;
  gap: 8px;
}

.admin-user-operations-card :deep(.admin-user-action-row) {
  gap: 6px;
}

.admin-user-operations-card :deep(.admin-user-action-row .ui-micro-btn) {
  width: 100%;
  justify-content: center;
}

.admin-user-operations-card :deep(.admin-editor-block) {
  gap: 7px;
}

.admin-user-operations-labeled-row {
  display: grid;
  grid-template-columns: 32px minmax(0, 1fr);
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.admin-user-operations-action-slot {
  min-width: 0;
}

.admin-user-operations-action-slot :deep(.admin-editor-main) {
  width: 100%;
  min-width: 92px;
}

.admin-user-operations-action-slot :deep(.admin-user-action-row) {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(0, 1fr));
  align-items: center;
}
</style>
