import { computed, ref } from 'vue'
import {
  exportAdminIssues,
  getAdminIssue,
  getAdminIssues,
  notifyAdminIssue,
  sendAdminIssueDigest,
  updateAdminIssueStatus
} from '@/api/admin'
import { getErrorMessage } from '@/utils'

const getWindowMessageApi = () => (typeof window === 'undefined' ? null : window.$message)
const getWindowEmailRecipient = () => {
  if (typeof window === 'undefined' || typeof window.prompt !== 'function') return ''
  return window.prompt('请输入接收问题列表的邮箱') || ''
}
const uniq = (values = []) => [...new Set(values.filter(Boolean))]
const asArray = (value) => Array.isArray(value) ? value.filter(Boolean) : []
const DEFAULT_ISSUE_PAGE_SIZE = 10
const MAX_ISSUE_PAGE_SIZE = 20
const MAX_EXPORT_ISSUE_LIMIT = 100

const downloadTextFile = ({ fileName, content, type = 'text/plain;charset=utf-8' } = {}) => {
  if (!fileName || !content || typeof window === 'undefined' || typeof document === 'undefined') return false
  const blob = new Blob([content], { type })
  const url = window.URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = fileName
  document.body.appendChild(link)
  link.click()
  link.remove()
  window.URL.revokeObjectURL(url)
  return true
}

export const useAdminIssueInbox = ({
  canReadIssues,
  fetchIssues = getAdminIssues,
  fetchIssue = getAdminIssue,
  patchIssueStatus = updateAdminIssueStatus,
  exportIssuesRequest = exportAdminIssues,
  notifyIssueRequest = notifyAdminIssue,
  sendIssueDigestRequest = sendAdminIssueDigest,
  getMessageApi = getWindowMessageApi,
  getEmailRecipient = getWindowEmailRecipient,
  downloadFile = downloadTextFile
}) => {
  const issues = ref([])
  const selectedIssue = ref(null)
  const issuePagination = ref({ page: 1, limit: DEFAULT_ISSUE_PAGE_SIZE, total: 0 })
  const issueQuery = ref({ status: 'open', severity: '', source_layer: '', page: 1, limit: DEFAULT_ISSUE_PAGE_SIZE })
  const loadingIssues = ref(false)
  const loadingIssueDetail = ref(false)
  const issueActionLoading = ref('')
  const lastExport = ref(null)
  const selectedIssueIds = ref([])
  const allFilteredIssuesSelected = ref(false)
  const downloadNameCounts = new Map()

  const getIssueId = (issueOrId) => (typeof issueOrId === 'object' ? issueOrId?.id : issueOrId)
  const getVisibleIssueIds = () => issues.value.map((issue) => issue.id).filter(Boolean)
  const getFilteredIssueTotal = () => Math.max(0, Number(issuePagination.value?.total || issues.value.length || 0))
  const getIssueExportGroupIds = (issue) => {
    if (!issue?.id) return []
    return asArray(issue.merged_group_ids).length ? asArray(issue.merged_group_ids) : [issue.id]
  }
  const selectedIssueRows = computed(() => {
    const selected = new Set(selectedIssueIds.value)
    return issues.value.filter((issue) => selected.has(issue.id))
  })
  const selectedIssueCount = computed(() => (
    allFilteredIssuesSelected.value ? getFilteredIssueTotal() : selectedIssueIds.value.length
  ))
  const selectedExportGroupIds = computed(() => uniq(selectedIssueRows.value.flatMap(getIssueExportGroupIds)))
  const selectedExportGroupCount = computed(() => (
    allFilteredIssuesSelected.value ? getFilteredIssueTotal() : selectedExportGroupIds.value.length
  ))
  const allVisibleIssuesSelected = computed(() => {
    if (allFilteredIssuesSelected.value) return getVisibleIssueIds().length > 0
    const visibleIssueIds = getVisibleIssueIds()
    return visibleIssueIds.length > 0 && visibleIssueIds.every((id) => selectedIssueIds.value.includes(id))
  })

  const pruneSelectedIssues = () => {
    if (allFilteredIssuesSelected.value) {
      selectedIssueIds.value = getVisibleIssueIds()
      return
    }
    const visible = new Set(getVisibleIssueIds())
    selectedIssueIds.value = selectedIssueIds.value.filter((id) => visible.has(id))
  }

  const updateIssueQuery = (key, value) => {
    if (!['status', 'severity', 'source_layer', 'page', 'limit'].includes(key)) return
    if (key !== 'page') clearIssueSelection()
    const nextValue = key === 'limit'
      ? Math.max(1, Math.min(MAX_ISSUE_PAGE_SIZE, Number(value) || DEFAULT_ISSUE_PAGE_SIZE))
      : value
    issueQuery.value = {
      ...issueQuery.value,
      [key]: nextValue,
      ...(key !== 'page' ? { page: 1 } : {})
    }
  }

  const loadIssues = async () => {
    if (!canReadIssues.value) return
    loadingIssues.value = true
    try {
      const rsp = await fetchIssues(issueQuery.value)
      issues.value = Array.isArray(rsp?.data) ? rsp.data : []
      pruneSelectedIssues()
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

  const toggleIssueSelection = (issueOrId, selected) => {
    const issueId = getIssueId(issueOrId)
    if (!issueId) return
    if (allFilteredIssuesSelected.value) {
      allFilteredIssuesSelected.value = false
      const visible = new Set(getVisibleIssueIds())
      if (selected) visible.add(issueId)
      else visible.delete(issueId)
      selectedIssueIds.value = getVisibleIssueIds().filter((id) => visible.has(id))
      return
    }
    const current = new Set(selectedIssueIds.value)
    if (selected) current.add(issueId)
    else current.delete(issueId)
    selectedIssueIds.value = getVisibleIssueIds().filter((id) => current.has(id))
  }

  const toggleAllVisibleIssueSelection = (selected) => {
    allFilteredIssuesSelected.value = Boolean(selected)
    selectedIssueIds.value = selected ? getVisibleIssueIds() : []
  }

  const clearIssueSelection = () => {
    allFilteredIssuesSelected.value = false
    selectedIssueIds.value = []
  }

  const openIssue = async (issueOrId) => {
    const issueGroupId = typeof issueOrId === 'object' ? issueOrId?.id : issueOrId
    const mergedGroupIds = Array.isArray(issueOrId?.merged_group_ids) ? issueOrId.merged_group_ids : []
    if (!issueGroupId || !canReadIssues.value) return
    loadingIssueDetail.value = true
    try {
      const rsp = await fetchIssue(issueGroupId, mergedGroupIds.length > 1 ? { group_ids: mergedGroupIds.join(',') } : undefined)
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

  const getCurrentFilterExportLimit = () => {
    const total = Number(issuePagination.value?.total || 0)
    const fallback = Number(issueQuery.value.limit || DEFAULT_ISSUE_PAGE_SIZE)
    return Math.max(1, Math.min(MAX_EXPORT_ISSUE_LIMIT, total || fallback || DEFAULT_ISSUE_PAGE_SIZE))
  }

  const buildIssueExportRequestPayload = ({ selectedOnly = false } = {}) => {
    const exportCurrentFilter = selectedOnly && allFilteredIssuesSelected.value
    const exportGroupIds = selectedOnly && !exportCurrentFilter ? selectedExportGroupIds.value : []
    if (selectedOnly && !exportCurrentFilter && !exportGroupIds.length) {
      getMessageApi()?.error?.('请先选择需要导出的线上问题')
      return null
    }
    return {
      status: issueQuery.value.status,
      severity: issueQuery.value.severity,
      source_layer: issueQuery.value.source_layer,
      limit: selectedOnly && !exportCurrentFilter ? undefined : getCurrentFilterExportLimit(),
      ...(exportGroupIds.length ? { issueGroupIds: exportGroupIds } : {})
    }
  }

  const getUniqueDownloadFileName = (fileName = '') => {
    if (!fileName) return fileName
    const count = Number(downloadNameCounts.get(fileName) || 0) + 1
    downloadNameCounts.set(fileName, count)
    if (count === 1) return fileName
    const dotIndex = fileName.lastIndexOf('.')
    if (dotIndex <= 0) return `${fileName}-${count}`
    return `${fileName.slice(0, dotIndex)}-${count}${fileName.slice(dotIndex)}`
  }

  const exportIssues = async ({ selectedOnly = false } = {}) => {
    const payload = buildIssueExportRequestPayload({ selectedOnly })
    if (!payload) return null
    const exportGroupIds = asArray(payload.issueGroupIds)
    issueActionLoading.value = 'export'
    try {
      const rsp = await exportIssuesRequest(payload)
      lastExport.value = rsp?.data || null
      if (lastExport.value?.jsonContent) {
        downloadFile({
          fileName: getUniqueDownloadFileName(lastExport.value.jsonFileName || 'codex-issue-inbox.json'),
          content: lastExport.value.jsonContent,
          type: 'application/json;charset=utf-8'
        })
      }
      if (lastExport.value?.markdownContent) {
        downloadFile({
          fileName: getUniqueDownloadFileName(lastExport.value.markdownFileName || 'codex-issue-inbox.md'),
          content: lastExport.value.markdownContent,
          type: 'text/markdown;charset=utf-8'
        })
      }
      getMessageApi()?.success?.(exportGroupIds.length ? 'Codex 问题已导出' : 'Codex 问题收件箱已生成并下载')
      return lastExport.value
    } catch (error) {
      if (!error?.__handled) getMessageApi()?.error(getErrorMessage(error, '导出问题收件箱失败'))
      return null
    } finally {
      issueActionLoading.value = ''
    }
  }

  const sendIssueDigestEmail = async ({ selectedOnly = false, email = '' } = {}) => {
    const payload = buildIssueExportRequestPayload({ selectedOnly })
    if (!payload) return null
    const recipient = String(email || getEmailRecipient() || '').trim()
    if (!recipient) return null
    issueActionLoading.value = 'send-email'
    try {
      const rsp = await sendIssueDigestRequest({
        to: recipient,
        ...payload
      })
      getMessageApi()?.success?.(`问题列表已发送到 ${recipient}`)
      return rsp?.data || null
    } catch (error) {
      if (!error?.__handled) getMessageApi()?.error(getErrorMessage(error, '发送问题列表邮件失败'))
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
    allVisibleIssuesSelected,
    clearIssueSelection,
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
    sendIssueDigestEmail,
    selectedExportGroupIds,
    selectedExportGroupCount,
    selectedIssueCount,
    selectedIssueIds,
    selectedIssue,
    setIssueStatus,
    toggleAllVisibleIssueSelection,
    toggleIssueSelection,
    updateIssueQuery
  }
}

export { downloadTextFile }
export default useAdminIssueInbox
