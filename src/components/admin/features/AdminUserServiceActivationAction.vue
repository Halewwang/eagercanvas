<template>
  <div v-if="canActivateService" class="admin-user-service-activation-actions">
    <AdminEditorMainButton
      v-if="['not_enabled', 'create_failed', 'deleted'].includes(user.service?.serviceStatus || 'not_enabled')"
      icon="play"
      :disabled="serviceLoading[user.id] || user.status === 'deleted'"
      @click="emit('activate-service', user)"
    >
      {{ serviceLoading[user.id] ? '开通中...' : '开通服务' }}
    </AdminEditorMainButton>
    <AdminEditorMainButton
      icon="settings"
      :disabled="serviceLoading[user.id] || user.status === 'deleted'"
      @click="emit('bind-manual-service', user)"
    >
      {{ serviceLoading[user.id] ? '绑定中...' : manualBindLabel }}
    </AdminEditorMainButton>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import AdminEditorMainButton from '@/components/admin/AdminEditorMainButton.vue'

const emit = defineEmits(['activate-service', 'bind-manual-service'])

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

const manualBindLabel = computed(() => {
  if (user.service?.serviceStatus === 'active' && user.service?.apiKeyLast4) {
    return '切换 Key'
  }
  return '手动绑定 Key'
})
</script>

<style scoped>
.admin-user-service-activation-actions {
  display: grid;
  gap: 6px;
  min-width: 0;
}
</style>
