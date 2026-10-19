import { apiRequest } from './_httpClient.js'
import { LOCAL_PREVIEW_ADMIN_READ_KEYS, resolveLocalPreviewAdminRead } from '@/utils/adminLocalPreview'

export const getAdminUsers = (params) => {
  const preview = resolveLocalPreviewAdminRead(LOCAL_PREVIEW_ADMIN_READ_KEYS.USERS, params)
  return preview.matched ? Promise.resolve(preview.response) : apiRequest({ url: '/admin/users', method: 'get', params })
}

export const getAdminSession = () =>
  apiRequest({
    url: '/admin/session',
    method: 'get',
    silentErrorToast: true
  })

export const getAdminUser = (userId) => {
  const preview = resolveLocalPreviewAdminRead(LOCAL_PREVIEW_ADMIN_READ_KEYS.USER, { userId })
  return preview.matched ? Promise.resolve(preview.response) : apiRequest({
    url: `/admin/users/${encodeURIComponent(userId)}`,
    method: 'get'
  })
}

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

export const deleteAdminUser = (userId, reason) =>
  apiRequest({
    url: `/admin/users/${encodeURIComponent(userId)}`,
    method: 'delete',
    data: { reason }
  })

export const restoreAdminUser = (userId, reason) =>
  apiRequest({
    url: `/admin/users/${encodeURIComponent(userId)}/restore`,
    method: 'post',
    data: { reason }
  })

export const activateAdminUserService = (userId) =>
  apiRequest({
    url: `/admin/users/${encodeURIComponent(userId)}/service-access/activate`,
    method: 'post'
  })

export const disableAdminUserService = (userId, reason = '') =>
  apiRequest({
    url: `/admin/users/${encodeURIComponent(userId)}/service-access/disable`,
    method: 'post',
    data: { reason }
  })
