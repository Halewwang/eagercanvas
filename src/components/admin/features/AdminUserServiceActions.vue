<template>
  <AdminEditorCard class="admin-user-action-card admin-user-action-card-service">
    <AdminEditorBlock v-if="canActivateService || canDisableService || canResetService || canUpdateServiceLimits">
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
    </AdminEditorBlock>
  </AdminEditorCard>
</template>

<script setup>
import AdminEditorBlock from '@/components/admin/AdminEditorBlock.vue'
import AdminEditorCard from '@/components/admin/AdminEditorCard.vue'
import AdminUserServiceActivationAction from './AdminUserServiceActivationAction.vue'
import AdminUserServiceActiveActions from './AdminUserServiceActiveActions.vue'

const emit = defineEmits([
  'activate-service',
  'disable-service',
  'reset-service',
  'update-service-limits'
])

const {
  canActivateService,
  canDisableService,
  canResetService,
  canUpdateServiceLimits,
  serviceLoading,
  user
} = defineProps({
  canActivateService: {
    type: Boolean,
    default: false
  },
  canDisableService: {
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
  serviceLoading: {
    type: Object,
    default: () => ({})
  },
  user: {
    type: Object,
    default: () => ({})
  }
})
</script>

<style scoped>
.admin-user-action-card {
  min-width: 184px;
  gap: 10px;
}

.admin-user-action-card-service {
  background: rgba(255, 255, 255, 0.025);
}
</style>
