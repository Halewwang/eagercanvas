<template>
  <AdminFilterToolbar class="admin-service-log-filters" compact grid>
    <AdminFilterField label="开始时间">
      <AdminControlField
        :value="log302Query.start"
        type="datetime-local"
        @input="updateLogQuery('start', $event)"
      />
    </AdminFilterField>
    <AdminFilterField label="结束时间">
      <AdminControlField
        :value="log302Query.end"
        type="datetime-local"
        @input="updateLogQuery('end', $event)"
      />
    </AdminFilterField>
    <AdminFilterField label="页码">
      <AdminControlField
        :value="log302Query.page"
        type="number"
        min="1"
        variant="number"
        @input="updateNumericLogQuery('page', $event)"
      />
    </AdminFilterField>
    <AdminFilterField label="每页">
      <AdminControlField
        :value="log302Query.limit"
        type="number"
        min="1"
        max="20"
        variant="number"
        @input="updateNumericLogQuery('limit', $event)"
      />
    </AdminFilterField>
    <AdminMicroButton size="md" :disabled="loadingApiLogs" @click="emit('load-api-logs')">查询</AdminMicroButton>
  </AdminFilterToolbar>
</template>

<script setup>
import AdminControlField from '@/components/admin/AdminControlField.vue'
import AdminFilterField from '@/components/admin/AdminFilterField.vue'
import AdminFilterToolbar from '@/components/admin/AdminFilterToolbar.vue'
import AdminMicroButton from '@/components/admin/AdminMicroButton.vue'

const emit = defineEmits(['load-api-logs', 'update-log-query'])

defineProps({
  loadingApiLogs: {
    type: Boolean,
    default: false
  },
  log302Query: {
    type: Object,
    default: () => ({ page: 1, limit: 20, start: '', end: '' })
  }
})

const updateLogQuery = (key, event) => {
  emit('update-log-query', key, event.target.value)
}

const clampPaginationValue = (key, value) => {
  const parsed = Number.parseFloat(value)
  if (Number.isNaN(parsed)) return value
  if (key === 'limit') return Math.max(1, Math.min(20, parsed))
  return Math.max(1, parsed)
}

const updateNumericLogQuery = (key, event) => {
  const value = event.target.value === '' ? '' : clampPaginationValue(key, event.target.value)
  emit('update-log-query', key, value)
}
</script>

<style scoped>
.admin-service-log-filters {
  --admin-filter-toolbar-columns: minmax(180px, 1fr) minmax(180px, 1fr) 76px 76px auto;
  width: 100%;
}

.admin-service-log-filters :deep(.admin-filter-field) {
  min-width: 0;
}

.admin-service-log-filters :deep(.ui-number-input) {
  width: 76px;
  max-width: 76px;
}

.admin-service-log-filters :deep(.ui-micro-btn) {
  min-width: 56px;
}

@media (max-width: 1180px) {
  .admin-service-log-filters {
    --admin-filter-toolbar-columns: minmax(0, 1fr) minmax(0, 1fr);
  }

  .admin-service-log-filters :deep(.ui-number-input) {
    width: 100%;
    max-width: 100%;
  }

  .admin-service-log-filters :deep(.ui-micro-btn) {
    width: 100%;
  }
}
</style>
