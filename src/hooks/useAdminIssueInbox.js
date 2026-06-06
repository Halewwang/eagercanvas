import { computed, ref } from 'vue'
import {
  exportAdminIssues,
  getAdminIssue,
  getAdminIssues,
  notifyAdminIssue,
  updateAdminIssueStatus
} from '@/api/admin'
import { getErrorMessage } from '@/utils'

const getWindowMessageApi = () => (typeof window === 'undefined' ? null : window.$message)
const uniq = (values = []) => [...new Set(values.filter(Boolean))]
const asArray = (value) => Array.isArray(value) ? value.filter(Boolean) : []
const DEFAULT_ISSUE_PAGE_SIZE = 10
const MAX_ISSUE_PAGE_SIZE = 20

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
  canUpdateIssues = ref(false),
  fetchIssues = getAdminIssues,
  fetchIssue = getAdminIssue,
  patchIssueStatus = updateAdminIssueStatus,
  exportIssuesRequest = exportAdminIssues,
  notifyIssueRequest = notifyAdminIssue,
  getMessageApi = getWindowMessageApi,
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
  const autoResolveExportedIssues = ref(true)

  const getIssueId = (issueOrId) => (typeof issueOrId === 'object' ? issueOrId?.id : issueOrId)
  const getVisibleIssueIds = () => issues.value.map((issue) => issue.id).filter(Boolean)
  const getIssueExportGroupIds = (issue) => {
    if (!issue?.id) return []
    return asArray(issue.merged_group_ids).length ? asArray(issue.merged_group_ids) : [issue.id]
  }
  const selectedIssueRows = computed(() => {
    const selected = new Set(selectedIssueIds.value)
    return issues.value.filter((issue) => selected.has(issue.id))
  })
  const selectedIssueCount = computed(() => selectedIssueIds.value.length)
  const selectedExportGroupIds = computed(() => uniq(selectedIssueRows.value.flatMap(getIssueExportGroupIds)))
  const allVisibleIssuesSelected = computed(() => {
    const visibleIssueIds = getVisibleIssueIds()
    return visibleIssueIds.length > 0 && visibleIssueIds.every((id) => selectedIssueIds.value.includes(id))
  })

  const pruneSelectedIssues = () => {
    const visible = new Set(getVisibleIssueIds())
    selectedIssueIds.value = selectedIssueIds.value.filter((id) => visible.has(id))
  }

  const updateIssueQuery = (key, value) => {
    if (!['status', 'severity', 'source_layer', 'page', 'limit'].includes(key)) return
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
    const current = new Set(selectedIssueIds.value)
    if (selected) current.add(issueId)
    else current.delete(issueId)
    selectedIssueIds.value = getVisibleIssueIds().filter((id) => current.has(id))
  }

  const toggleAllVisibleIssueSelection = (selected) => {
    selectedIssueIds.value = selected ? getVisibleIssueIds() : []
  }

  const clearIssueSelection = () => {
    selectedIssueIds.value = []
  }

  const setAutoResolveExportedIssues = (value) => {
    autoResolveExportedIssues.value = Boolean(value)
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

  const markIssueGroupsResolved = async (issueGroupIds = []) => {
    const ids = uniq(issueGroupIds)
    if (!ids.length) return []
    issueActionLoading.value = 'resolve:selected'
    const results = await Promise.all(ids.map((id) => patchIssueStatus(id, 'resolved')))
    clearIssueSelection()
    await loadIssues()
    if (selectedIssue.value?.group?.id && ids.includes(selectedIssue.value.group.id)) {
      selectedIssue.value = null
    }
    return results
  }

  const exportIssues = async ({ selectedOnly = false } = {}) => {
    const exportGroupIds = selectedOnly ? selectedExportGroupIds.value : []
    if (selectedOnly && !exportGroupIds.length) {
      getMessageApi()?.error?.('请先选择需要导出的线上问题')
      return null
    }
    issueActionLoading.value = 'export'
    try {
      const rsp = await exportIssuesRequest({
        status: issueQuery.value.status,
        severity: issueQuery.value.severity,
        source_layer: issueQuery.value.source_layer,
        limit: issueQuery.value.limit,
        ...(exportGroupIds.length ? { issueGroupIds: exportGroupIds } : {})
      })
      lastExport.value = rsp?.data || null
      if (lastExport.value?.jsonContent) {
        downloadFile({
          fileName: lastExport.value.jsonFileName || 'codex-issue-inbox.json',
          content: lastExport.value.jsonContent,
          type: 'application/json;charset=utf-8'
        })
      }
      if (lastExport.value?.markdownContent) {
        downloadFile({
          fileName: lastExport.value.markdownFileName || 'codex-issue-inbox.md',
          content: lastExport.value.markdownContent,
          type: 'text/markdown;charset=utf-8'
        })
      }
      if (exportGroupIds.length && autoResolveExportedIssues.value && canUpdateIssues.value) {
        await markIssueGroupsResolved(exportGroupIds)
        getMessageApi()?.success?.('Codex 问题已导出，选中问题已标记已解决')
      } else {
        getMessageApi()?.success?.('Codex 问题收件箱已生成并下载')
      }
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
    allVisibleIssuesSelected,
    autoResolveExportedIssues,
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
    selectedExportGroupIds,
    selectedIssueCount,
    selectedIssueIds,
    selectedIssue,
    setIssueStatus,
    setAutoResolveExportedIssues,
    toggleAllVisibleIssueSelection,
    toggleIssueSelection,
    updateIssueQuery
  }
}

export { downloadTextFile }
export default useAdminIssueInbox
