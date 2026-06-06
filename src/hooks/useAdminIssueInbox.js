import { ref } from 'vue'
import {
  exportAdminIssues,
  getAdminIssue,
  getAdminIssues,
  notifyAdminIssue,
  updateAdminIssueStatus
} from '@/api/admin'
import { getErrorMessage } from '@/utils'

const getWindowMessageApi = () => (typeof window === 'undefined' ? null : window.$message)

export const useAdminIssueInbox = ({
  canReadIssues,
  fetchIssues = getAdminIssues,
  fetchIssue = getAdminIssue,
  patchIssueStatus = updateAdminIssueStatus,
  exportIssuesRequest = exportAdminIssues,
  notifyIssueRequest = notifyAdminIssue,
  getMessageApi = getWindowMessageApi
}) => {
  const issues = ref([])
  const selectedIssue = ref(null)
  const issuePagination = ref({ page: 1, limit: 20, total: 0 })
  const issueQuery = ref({ status: 'open', severity: '', source_layer: '', page: 1, limit: 20 })
  const loadingIssues = ref(false)
  const loadingIssueDetail = ref(false)
  const issueActionLoading = ref('')
  const lastExport = ref(null)

  const updateIssueQuery = (key, value) => {
    if (!['status', 'severity', 'source_layer', 'page', 'limit'].includes(key)) return
    issueQuery.value = {
      ...issueQuery.value,
      [key]: value,
      ...(key !== 'page' ? { page: 1 } : {})
    }
  }

  const loadIssues = async () => {
    if (!canReadIssues.value) return
    loadingIssues.value = true
    try {
      const rsp = await fetchIssues(issueQuery.value)
      issues.value = Array.isArray(rsp?.data) ? rsp.data : []
      issuePagination.value = rsp?.pagination || {
        page: issueQuery.value.page,
        limit: issueQuery.value.limit,
        total: issues.value.length
      }
    } catch (error) {
      if (!error?.__handled) getMessageApi()?.error(getErrorMessage(error, '加载问题收件箱失败'))
    } finally {
      loadingIssues.value = false
    }
  }

  const openIssue = async (issueGroupId) => {
    if (!issueGroupId || !canReadIssues.value) return
    loadingIssueDetail.value = true
    try {
      const rsp = await fetchIssue(issueGroupId)
      selectedIssue.value = rsp?.data || null
    } catch (error) {
      if (!error?.__handled) getMessageApi()?.error(getErrorMessage(error, '加载问题详情失败'))
    } finally {
      loadingIssueDetail.value = false
    }
  }

  const setIssueStatus = async ({ issueGroupId, status }) => {
    if (!issueGroupId || !status) return
    issueActionLoading.value = `status:${issueGroupId}`
    try {
      await patchIssueStatus(issueGroupId, status)
      await loadIssues()
      if (selectedIssue.value?.group?.id === issueGroupId) await openIssue(issueGroupId)
    } catch (error) {
      if (!error?.__handled) getMessageApi()?.error(getErrorMessage(error, '更新 Issue 状态失败'))
    } finally {
      issueActionLoading.value = ''
    }
  }

  const exportIssues = async () => {
    issueActionLoading.value = 'export'
    try {
      const rsp = await exportIssuesRequest({
        status: issueQuery.value.status,
        severity: issueQuery.value.severity,
        source_layer: issueQuery.value.source_layer,
        limit: issueQuery.value.limit
      })
      lastExport.value = rsp?.data || null
      getMessageApi()?.success?.('Codex 问题收件箱已导出')
      return lastExport.value
    } catch (error) {
      if (!error?.__handled) getMessageApi()?.error(getErrorMessage(error, '导出问题收件箱失败'))
      return null
    } finally {
      issueActionLoading.value = ''
    }
  }

  const notifyIssue = async (issueGroupId) => {
    if (!issueGroupId) return
    issueActionLoading.value = `notify:${issueGroupId}`
    try {
      const rsp = await notifyIssueRequest(issueGroupId)
      getMessageApi()?.success?.('Issue 通知已进入发送流程')
      return rsp?.data || null
    } catch (error) {
      if (!error?.__handled) getMessageApi()?.error(getErrorMessage(error, '发送 Issue 通知失败'))
      return null
    } finally {
      issueActionLoading.value = ''
    }
  }

  return {
    exportIssues,
    issueActionLoading,
    issuePagination,
    issueQuery,
    issues,
    lastExport,
    loadIssues,
    loadingIssueDetail,
    loadingIssues,
    notifyIssue,
    openIssue,
    selectedIssue,
    setIssueStatus,
    updateIssueQuery
  }
}

export default useAdminIssueInbox
