import { computed, ref } from 'vue'
import {
  getAdminAuditLogs,
  getAdminUsageSummary,
  getAdminUsageTimeseries
} from '@/api/admin'
import { getErrorMessage } from '@/utils'
import { getAdminUsageBarWidth } from '@/utils/adminDisplay'
import { getAdminAuditPagination } from './useAdminDashboardDataCore.js'

const createUsageSummary = () => ({
  totalCalls: 0,
  totalInputTokens: 0,
  totalOutputTokens: 0,
  totalImages: 0,
  totalVideoSeconds: 0,
  totalCostUsd: 0,
  totalUsers: 0
})

const DEFAULT_AUDIT_LOG_PAGE_SIZE = 10

const getWindowMessageApi = () => (typeof window === 'undefined' ? null : window.$message)

export const useAdminDashboardData = ({
  canReadAudit,
  canReadUsage,
  fetchAuditLogs = getAdminAuditLogs,
  fetchUsageSummary = getAdminUsageSummary,
  fetchUsageTimeseries = getAdminUsageTimeseries,
  getMessageApi = getWindowMessageApi
}) => {
  const usageSummary = ref(createUsageSummary())
  const usageSeries = ref([])
  const loadingUsage = ref(false)
  const auditLogs = ref([])
  const loadingLogs = ref(false)
  const pagination = ref({ page: 1, limit: DEFAULT_AUDIT_LOG_PAGE_SIZE, total: 0 })
  const logQuery = ref({ page: 1, limit: DEFAULT_AUDIT_LOG_PAGE_SIZE })

  const loadingOverview = computed(() => loadingUsage.value)

  const barWidth = (value) => getAdminUsageBarWidth({ value, series: usageSeries.value })

  const updateAuditLogQuery = (key, value) => {
    if (!['page', 'limit'].includes(key)) return
    logQuery.value = { ...logQuery.value, [key]: value }
  }

  const loadUsage = async () => {
    if (!canReadUsage.value) return
    loadingUsage.value = true
    try {
      const [summaryRsp, seriesRsp] = await Promise.all([fetchUsageSummary(), fetchUsageTimeseries()])
      usageSummary.value = summaryRsp?.data || usageSummary.value
      usageSeries.value = Array.isArray(seriesRsp?.data) ? seriesRsp.data : []
    } catch (error) {
      if (!error?.__handled) getMessageApi()?.error(getErrorMessage(error, '加载用量概览失败'))
    } finally {
      loadingUsage.value = false
    }
  }

  const loadLogs = async () => {
    if (!canReadAudit.value) return
    loadingLogs.value = true
    try {
      const rsp = await fetchAuditLogs({ page: logQuery.value.page, limit: logQuery.value.limit })
      auditLogs.value = Array.isArray(rsp?.data) ? rsp.data : []
      pagination.value = getAdminAuditPagination(rsp, logQuery.value)
    } catch (error) {
      if (!error?.__handled) getMessageApi()?.error(getErrorMessage(error, '加载审计日志失败'))
    } finally {
      loadingLogs.value = false
    }
  }

  const refreshOverview = async () => {
    await loadUsage()
  }

  return {
    auditLogs,
    barWidth,
    loadLogs,
    loadUsage,
    loadingLogs,
    loadingOverview,
    loadingUsage,
    logQuery,
    pagination,
    refreshOverview,
    updateAuditLogQuery,
    usageSeries,
    usageSummary
  }
}

export default useAdminDashboardData
