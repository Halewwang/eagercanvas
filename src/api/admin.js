import { apiRequest } from './_httpClient.js'

export const getAdminSession = () =>
  apiRequest({
    url: '/admin/session',
    method: 'get',
    silentErrorToast: true
  })

export const getAdminUsers = () =>
  apiRequest({
    url: '/admin/users',
    method: 'get'
  })

export const updateAdminUserRoles = (userId, roleCodes) =>
  apiRequest({
    url: `/admin/users/${encodeURIComponent(userId)}/roles`,
    method: 'patch',
    data: { roleCodes }
  })

export const updateAdminUserStatus = (userId, status, reason = '') =>
  apiRequest({
    url: `/admin/users/${encodeURIComponent(userId)}/status`,
    method: 'patch',
    data: { status, reason }
  })

export const deleteAdminUser = (userId) =>
  apiRequest({
    url: `/admin/users/${encodeURIComponent(userId)}`,
    method: 'delete'
  })

export const activateAdminUserService = (userId, payload = {}) =>
  apiRequest({
    url: `/admin/users/${encodeURIComponent(userId)}/service-access/activate`,
    method: 'post',
    data: payload
  })

export const disableAdminUserService = (userId, reason = '') =>
  apiRequest({
    url: `/admin/users/${encodeURIComponent(userId)}/service-access/disable`,
    method: 'post',
    data: { reason }
  })

export const resetAdminUserService = (userId) =>
  apiRequest({
    url: `/admin/users/${encodeURIComponent(userId)}/service-access/reset`,
    method: 'post'
  })

export const updateAdminUserServiceLimits = (userId, payload = {}) =>
  apiRequest({
    url: `/admin/users/${encodeURIComponent(userId)}/service-access/limits`,
    method: 'patch',
    data: payload
  })

export const reconcileAdminBilling = (payload = {}) =>
  apiRequest({
    url: '/admin/billing/reconcile',
    method: 'post',
    data: payload
  })

export const assignAdminApiKeyToUser = (userId, apiName) =>
  apiRequest({
    url: '/admin/api-keys/assign',
    method: 'post',
    data: { userId, apiName }
  })

export const unassignAdminApiKeyFromUser = (userId, apiName) =>
  apiRequest({
    url: '/admin/api-keys/assign',
    method: 'delete',
    data: { userId, apiName }
  })

export const getAdminAuditLogs = (params) =>
  apiRequest({
    url: '/admin/audit-logs',
    method: 'get',
    params
  })

export const getAdminIssues = (params) =>
  apiRequest({
    url: '/admin/issues',
    method: 'get',
    params
  })

export const getAdminIssue = (issueGroupId, params) =>
  apiRequest({
    url: `/admin/issues/${encodeURIComponent(issueGroupId)}`,
    method: 'get',
    params
  })

export const updateAdminIssueStatus = (issueGroupId, status) =>
  apiRequest({
    url: `/admin/issues/${encodeURIComponent(issueGroupId)}`,
    method: 'patch',
    data: { status }
  })

export const exportAdminIssues = (payload = {}) =>
  apiRequest({
    url: '/admin/issues/export',
    method: 'post',
    data: payload
  })

export const sendAdminIssueDigest = (payload = {}) =>
  apiRequest({
    url: '/admin/issues/send-email',
    method: 'post',
    data: payload
  })

export const notifyAdminIssue = (issueGroupId) =>
  apiRequest({
    url: `/admin/issues/${encodeURIComponent(issueGroupId)}/notify`,
    method: 'post'
  })

export const getAdminUsageSummary = (params) =>
  apiRequest({
    url: '/admin/usage/summary',
    method: 'get',
    params
  })

export const getAdminUsageTimeseries = (params) =>
  apiRequest({
    url: '/admin/usage/timeseries',
    method: 'get',
    params
  })

export const getAdmin302Balance = () =>
  apiRequest({
    url: '/admin/302/balance',
    method: 'get'
  })

export const getAdmin302Record = (requestId) =>
  apiRequest({
    url: `/admin/302/record/${encodeURIComponent(requestId)}`,
    method: 'get'
  })

export const getAdmin302ApiRecord = (params) =>
  apiRequest({
    url: '/admin/302/api-record',
    method: 'get',
    params
  })

export const getAdmin302ApiKeys = () =>
  apiRequest({
    url: '/admin/302/api-keys',
    method: 'get'
  })

export const createAdmin302ApiKey = (payload) =>
  apiRequest({
    url: '/admin/302/api-keys',
    method: 'post',
    data: payload
  })

export const updateAdmin302ApiKey = (apiName, payload) =>
  apiRequest({
    url: `/admin/302/api-keys/${encodeURIComponent(apiName)}`,
    method: 'put',
    data: payload
  })

export const deleteAdmin302ApiKey = (apiName) =>
  apiRequest({
    url: `/admin/302/api-keys/${encodeURIComponent(apiName)}`,
    method: 'delete'
  })
