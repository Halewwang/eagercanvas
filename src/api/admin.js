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

export const getAdminAuditLogs = (params) =>
  request({
    url: '/admin/audit-logs',
    method: 'get',
    params
  })
