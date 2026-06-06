<template>
  <AdminSectionHeader
    class="mb-5"
    title="后台审计日志"
    caption="后台关键操作审计轨迹。"
  />

  <AdminAuditLogFilters
    class="mb-4"
    :loading-logs="loadingLogs"
    :log-query="logQuery"
    @load-logs="emit('load-logs')"
    @update-log-query="forwardLogQueryUpdate"
  />

  <AdminEmptyState v-if="auditLogs.length === 0">暂无审计日志</AdminEmptyState>
  <AdminTableShell v-else min-width-class="min-w-[980px]">
    <template #header>
      <th class="px-3 py-3">时间</th>
      <th class="px-3 py-3">动作</th>
      <th class="px-3 py-3">操作者</th>
      <th class="px-3 py-3">目标对象</th>
      <th class="px-3 py-3">元数据</th>
    </template>
    <template #default="{ rowClass }">
      <AdminAuditLogRow
        v-for="log in auditLogs"
        :key="log.id"
        :format-date-time="formatDateTime"
        :log="log"
        :row-class="rowClass"
        :to-pretty-json="toPrettyJson"
      />
    </template>
  </AdminTableShell>

  <AdminAuditLogPaginationSummary :loading="loadingLogs" :pagination="pagination" @set-page="setAuditLogPage" />
</template>

<script setup>
import AdminEmptyState from '@/components/admin/AdminEmptyState.vue'
import AdminSectionHeader from '@/components/admin/AdminSectionHeader.vue'
import AdminTableShell from '@/components/admin/AdminTableShell.vue'
import AdminAuditLogFilters from './AdminAuditLogFilters.vue'
import AdminAuditLogPaginationSummary from './AdminAuditLogPaginationSummary.vue'
import AdminAuditLogRow from './AdminAuditLogRow.vue'

const emit = defineEmits(['load-logs', 'update-log-query'])

defineProps({
  auditLogs: {
    type: Array,
    default: () => []
  },
  formatDateTime: {
    type: Function,
    default: (value) => value || '-'
  },
  loadingLogs: {
    type: Boolean,
    default: false
  },
  logQuery: {
    type: Object,
    default: () => ({ page: 1, limit: 20 })
  },
  pagination: {
    type: Object,
    default: () => ({ page: 1, limit: 20, total: 0 })
  },
  toPrettyJson: {
    type: Function,
    default: (value) => JSON.stringify(value, null, 2)
  }
})

const forwardLogQueryUpdate = (key, value) => {
  emit('update-log-query', key, value)
}

const setAuditLogPage = (page) => {
  emit('update-log-query', 'page', page)
  emit('load-logs')
}
</script>
