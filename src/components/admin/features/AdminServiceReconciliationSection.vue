<template>
  <AdminServiceReconciliationHeader
    :can-reconcile-billing="canReconcileBilling"
    :loading302="loading302"
    :reconciling-billing="reconcilingBilling"
    @reconcile-billing="emit('reconcile-billing')"
    @refresh-service-data="emit('refresh-service-data')"
  />

  <AdminNotice v-if="serviceLoadNotice" variant="warning">
    {{ serviceLoadNotice }}
  </AdminNotice>

  <AdminServiceReconciliationSummaryMetrics
    :active-service-users="activeServiceUsers"
    :api-log-count="apiLogs.length"
    :balance-display="balanceDisplay"
    :can-read-usage="canReadUsage"
    :can-read-users="canReadUsers"
  />

  <div v-if="canReadUsage" class="grid grid-cols-1 gap-5 xl:grid-cols-[1.2fr_1.8fr]">
    <AdminServiceRecordQueryPanel
      :loading-record="loadingRecord"
      :record-data="recordData"
      :record-request-id="recordRequestId"
      @query-record="emit('query-record')"
      @update:record-request-id="emit('update:recordRequestId', $event)"
    />

    <AdminServiceApiLogsPanel
      :api-log-pagination="apiLogPagination"
      :api-logs="apiLogs"
      :loading-api-logs="loadingApiLogs"
      :log302-query="log302Query"
      @load-api-logs="emit('load-api-logs')"
      @update-log-query="forwardLogQueryUpdate"
    />
  </div>

  <AdminEmptyState v-if="!canReadUsage && !canReconcileBilling">
    当前角色没有可用的服务管理权限。
  </AdminEmptyState>
</template>

<script setup>
import AdminEmptyState from '@/components/admin/AdminEmptyState.vue'
import AdminNotice from '@/components/admin/AdminNotice.vue'
import AdminServiceReconciliationHeader from './AdminServiceReconciliationHeader.vue'
import AdminServiceReconciliationSummaryMetrics from './AdminServiceReconciliationSummaryMetrics.vue'
import AdminServiceRecordQueryPanel from './AdminServiceRecordQueryPanel.vue'
import AdminServiceApiLogsPanel from './AdminServiceApiLogsPanel.vue'

const emit = defineEmits([
  'load-api-logs',
  'query-record',
  'reconcile-billing',
  'refresh-service-data',
  'update-log-query',
  'update:recordRequestId'
])

defineProps({
  activeServiceUsers: {
    type: Number,
    default: 0
  },
  apiLogPagination: {
    type: Object,
    default: () => ({ page: 1, limit: 10, total: 0 })
  },
  apiLogs: {
    type: Array,
    default: () => []
  },
  balanceDisplay: {
    type: String,
    default: ''
  },
  canReadUsage: {
    type: Boolean,
    default: false
  },
  canReadUsers: {
    type: Boolean,
    default: false
  },
  canReconcileBilling: {
    type: Boolean,
    default: false
  },
  loading302: {
    type: Boolean,
    default: false
  },
  loadingApiLogs: {
    type: Boolean,
    default: false
  },
  loadingRecord: {
    type: Boolean,
    default: false
  },
  log302Query: {
    type: Object,
    default: () => ({ apiName: '', page: 1, limit: 10, start: '', end: '' })
  },
  recordData: {
    type: Object,
    default: null
  },
  recordRequestId: {
    type: String,
    default: ''
  },
  reconcilingBilling: {
    type: Boolean,
    default: false
  },
  serviceLoadNotice: {
    type: String,
    default: ''
  }
})

const forwardLogQueryUpdate = (key, value) => {
  emit('update-log-query', key, value)
}
</script>
