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
