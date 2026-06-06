<template>
  <AdminFilterToolbar class="admin-audit-log-filters" compact fit grid>
    <AdminFilterField label="页码">
      <AdminControlField
        :value="logQuery.page"
        type="number"
        min="1"
        variant="number"
        @input="updateLogQuery('page', $event)"
      />
    </AdminFilterField>
    <AdminFilterField label="每页">
      <AdminControlField
        :value="logQuery.limit"
        type="number"
        min="1"
        max="20"
        variant="number"
        @input="updateLogQuery('limit', $event)"
      />
    </AdminFilterField>
    <AdminMicroButton size="md" :disabled="loadingLogs" @click="emit('load-logs')">查询</AdminMicroButton>
  </AdminFilterToolbar>
</template>

<script setup>
import AdminControlField from '@/components/admin/AdminControlField.vue'
import AdminFilterField from '@/components/admin/AdminFilterField.vue'
import AdminFilterToolbar from '@/components/admin/AdminFilterToolbar.vue'
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

const clampPaginationValue = (key, value) => {
  const parsed = Number.parseFloat(value)
  if (Number.isNaN(parsed)) return value
  if (key === 'limit') return Math.max(1, Math.min(20, parsed))
  return Math.max(1, parsed)
}

const updateLogQuery = (key, event) => {
  emit('update-log-query', key, clampPaginationValue(key, event.target.value))
}
</script>

<style scoped>
.admin-audit-log-filters {
  --admin-filter-toolbar-columns: 96px 96px auto;
}

.admin-audit-log-filters :deep(.ui-number-input) {
  width: 96px;
  max-width: 96px;
}

@media (max-width: 640px) {
  .admin-audit-log-filters {
    --admin-filter-toolbar-columns: minmax(0, 1fr);
    width: 100%;
  }

  .admin-audit-log-filters :deep(.ui-number-input) {
    width: 100%;
    max-width: 100%;
  }
}
</style>
