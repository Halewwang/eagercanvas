<template>
  <AdminPanelCard
    title="服务调用日志查询"
    caption="按时间范围和分页条件查询官方调用日志。"
    title-class="text-sm font-medium text-white"
    header-class="mb-3"
    panel-class="admin-panel-card rounded-2xl p-4"
  >
    <AdminServiceApiLogFilters
      :loading-api-logs="loadingApiLogs"
      :log302-query="log302Query"
      @load-api-logs="emit('load-api-logs')"
      @update-log-query="forwardLogQueryUpdate"
    />
    <div class="admin-service-log-results">
      <AdminEmptyState v-if="apiLogs.length === 0">暂无服务调用日志</AdminEmptyState>
      <AdminTableShell v-else min-width-class="min-w-[860px]" body-row-class="border-b border-white/5">
        <template #header>
          <th class="px-2 py-2">请求 ID</th>
          <th class="px-2 py-2">模型</th>
          <th class="px-2 py-2">成本</th>
          <th class="px-2 py-2">状态</th>
          <th class="px-2 py-2">时间</th>
        </template>
        <template #default="{ rowClass }">
          <AdminServiceApiLogRow
            v-for="(item, idx) in apiLogs"
            :key="item.request_id || item.id || idx"
            :index="idx"
            :item="item"
            :row-class="rowClass"
          />
        </template>
      </AdminTableShell>
      <AdminPaginationBar
        :page="apiLogPage"
        :limit="apiLogLimit"
        :total="apiLogTotal"
        @set-page="setApiLogPage"
      />
    </div>
  </AdminPanelCard>
</template>

<script setup>
import { computed } from 'vue'
import AdminEmptyState from '@/components/admin/AdminEmptyState.vue'
import AdminPaginationBar from '@/components/admin/AdminPaginationBar.vue'
import AdminPanelCard from '@/components/admin/AdminPanelCard.vue'
import AdminTableShell from '@/components/admin/AdminTableShell.vue'
import AdminServiceApiLogFilters from './AdminServiceApiLogFilters.vue'
import AdminServiceApiLogRow from './AdminServiceApiLogRow.vue'

const emit = defineEmits(['load-api-logs', 'update-log-query'])

const props = defineProps({
  apiLogPagination: {
    type: Object,
    default: () => ({ page: 1, limit: 10, total: 0 })
  },
  apiLogs: {
    type: Array,
    default: () => []
  },
  loadingApiLogs: {
    type: Boolean,
    default: false
  },
  log302Query: {
    type: Object,
    default: () => ({ page: 1, limit: 10, start: '', end: '' })
  }
})

const forwardLogQueryUpdate = (key, value) => {
  emit('update-log-query', key, value)
}

const apiLogPage = computed(() => Number(props.apiLogPagination?.page || props.log302Query?.page || 1))
const apiLogLimit = computed(() => Number(props.apiLogPagination?.limit || props.log302Query?.limit || 10))
const apiLogTotal = computed(() => Number(props.apiLogPagination?.total || 0))

const setApiLogPage = (page) => {
  emit('update-log-query', 'page', page)
  emit('load-api-logs')
}
</script>

<style scoped>
.admin-service-log-results {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-top: 16px;
}
</style>
