<template>
  <AdminEditorActions v-if="user.service?.serviceStatus === 'active'" class="admin-user-action-row">
    <AdminMicroButton
      v-if="canDisableService"
      icon="pause"
      :disabled="serviceLoading[user.id]"
      @click="emit('disable-service', user)"
    >
      停用服务
    </AdminMicroButton>
    <AdminMicroButton
      v-if="canResetService"
      icon="refresh"
      :disabled="serviceLoading[user.id]"
      @click="emit('reset-service', user)"
    >
      重置凭证
    </AdminMicroButton>
    <AdminMicroButton
      v-if="canUpdateServiceLimits"
      icon="settings"
      :disabled="serviceLoading[user.id]"
      @click="emit('update-service-limits', user)"
    >
      调整额度
    </AdminMicroButton>
  </AdminEditorActions>
</template>

<script setup>
import AdminEditorActions from '@/components/admin/AdminEditorActions.vue'
import AdminMicroButton from '@/components/admin/AdminMicroButton.vue'

const emit = defineEmits([
  'disable-service',
  'reset-service',
  'update-service-limits'
])

const {
  canDisableService,
  canResetService,
  canUpdateServiceLimits,
  serviceLoading,
  user
} = defineProps({
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
