import { request } from '@/utils'

export const getAdminSession = () =>
  request({
    url: '/admin/session',
    method: 'get',
    silentErrorToast: true
  })

export const getAdminUsers = () =>
  request({
    url: '/admin/users',
    method: 'get'
  })

export const updateAdminUserRoles = (userId, roleCodes) =>
  request({
    url: `/admin/users/${encodeURIComponent(userId)}/roles`,
    method: 'patch',
    data: { roleCodes }
  })

export const updateAdminUserStatus = (userId, status, reason = '') =>
  request({
    url: `/admin/users/${encodeURIComponent(userId)}/status`,
    method: 'patch',
    data: { status, reason }
  })

export const deleteAdminUser = (userId) =>
  request({
    url: `/admin/users/${encodeURIComponent(userId)}`,
    method: 'delete'
  })

export const assignAdminApiKeyToUser = (userId, apiName) =>
  request({
    url: '/admin/api-keys/assign',
    method: 'post',
    data: { userId, apiName }
  })

export const unassignAdminApiKeyFromUser = (userId, apiName) =>
  request({
    url: '/admin/api-keys/assign',
    method: 'delete',
    data: { userId, apiName }
  })

export const getAdminAuditLogs = (params) =>
  request({
    url: '/admin/audit-logs',
    method: 'get',
    params
  })

export const getAdminUsageSummary = (params) =>
  request({
    url: '/admin/usage/summary',
    method: 'get',
    params
  })

export const getAdminUsageTimeseries = (params) =>
  request({
    url: '/admin/usage/timeseries',
    method: 'get',
    params
  })

export const getAdmin302Balance = () =>
  request({
    url: '/admin/302/balance',
    method: 'get'
  })

export const getAdmin302Record = (requestId) =>
  request({
    url: `/admin/302/record/${encodeURIComponent(requestId)}`,
    method: 'get'
  })

export const getAdmin302ApiRecord = (params) =>
  request({
    url: '/admin/302/api-record',
    method: 'get',
    params
  })

export const getAdmin302ApiKeys = () =>
  request({
    url: '/admin/302/api-keys',
    method: 'get'
  })

export const createAdmin302ApiKey = (payload) =>
  request({
    url: '/admin/302/api-keys',
    method: 'post',
    data: payload
  })

export const updateAdmin302ApiKey = (apiName, payload) =>
  request({
    url: `/admin/302/api-keys/${encodeURIComponent(apiName)}`,
    method: 'put',
    data: payload
  })

export const deleteAdmin302ApiKey = (apiName) =>
  request({
    url: `/admin/302/api-keys/${encodeURIComponent(apiName)}`,
    method: 'delete'
  })
