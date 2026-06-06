<template>
  <AdminEditorMainButton
    v-if="canActivateService && ['not_enabled', 'create_failed', 'deleted'].includes(user.service?.serviceStatus || 'not_enabled')"
    icon="play"
    :disabled="serviceLoading[user.id] || user.status === 'deleted'"
    @click="emit('activate-service', user)"
  >
    {{ serviceLoading[user.id] ? '开通中...' : '开通服务' }}
  </AdminEditorMainButton>
</template>

<script setup>
import AdminEditorMainButton from '@/components/admin/AdminEditorMainButton.vue'

const emit = defineEmits(['activate-service'])

const {
  canActivateService,
  serviceLoading,
  user
} = defineProps({
  canActivateService: {
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
