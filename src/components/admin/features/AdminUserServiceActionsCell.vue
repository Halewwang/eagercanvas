<template>
  <td v-if="showUserActions" class="px-3 py-4">
    <AdminUserServiceActions
      :can-activate-service="canActivateService"
      :can-disable-service="canDisableService"
      :can-reset-service="canResetService"
      :can-update-service-limits="canUpdateServiceLimits"
      :service-loading="serviceLoading"
      :user="user"
      @activate-service="emit('activate-service', $event)"
      @disable-service="emit('disable-service', $event)"
      @reset-service="emit('reset-service', $event)"
      @update-service-limits="emit('update-service-limits', $event)"
    />
  </td>
</template>

<script setup>
import AdminUserServiceActions from './AdminUserServiceActions.vue'

const emit = defineEmits([
  'activate-service',
  'disable-service',
  'reset-service',
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
  showUserActions: {
    type: Boolean,
    default: false
  },
  user: {
    type: Object,
    default: () => ({})
  }
})
</script>
