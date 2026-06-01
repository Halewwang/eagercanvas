<template>
  <div class="flex items-center gap-2 text-xs">
    <AdminControlField
      :value="logQuery.page"
      type="number"
      min="1"
      variant="number"
      @input="updateLogQuery('page', $event)"
    />
    <AdminControlField
      :value="logQuery.limit"
      type="number"
      min="1"
      max="100"
      variant="number"
      @input="updateLogQuery('limit', $event)"
    />
    <AdminMicroButton :disabled="loadingLogs" @click="emit('load-logs')">查询</AdminMicroButton>
  </div>
</template>

<script setup>
import AdminControlField from '@/components/admin/AdminControlField.vue'
import AdminMicroButton from '@/components/admin/AdminMicroButton.vue'

const emit = defineEmits(['load-logs', 'update-log-query'])

defineProps({
  loadingLogs: {
    type: Boolean,
    default: false
  },
  logQuery: {
    type: Object,
    default: () => ({ page: 1, limit: 20 })
  }
})

const toNumberInput = (value) => {
  const parsed = Number.parseFloat(value)
  return Number.isNaN(parsed) ? value : parsed
}

const updateLogQuery = (key, event) => {
  emit('update-log-query', key, toNumberInput(event.target.value))
}
</script>
