<template>
  <div class="usage-admin-assigned-credentials-cell">
    <AdminRemovableTag
      v-for="assigned in assignedApiKeys"
      :key="assigned.apiName"
      @remove="$emit('unassign', { userId, apiName: assigned.apiName })"
    >
      {{ assigned.apiName }}
    </AdminRemovableTag>
    <span v-if="!assignedApiKeys.length" class="text-xs text-white/40">No credential assigned</span>
  </div>
</template>

<script setup>
import AdminRemovableTag from '@/components/admin/AdminRemovableTag.vue'

defineEmits(['unassign'])

defineProps({
  assignedApiKeys: {
    type: Array,
    default: () => []
  },
  userId: {
    type: [String, Number],
    required: true
  }
})
</script>

<style scoped>
.usage-admin-assigned-credentials-cell {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}
</style>
