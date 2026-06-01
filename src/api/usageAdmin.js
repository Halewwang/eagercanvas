import { getStoredValue, removeStoredValue, setStoredValue } from '@/utils'
import { STORAGE_KEYS } from '@/utils/constants'
import { apiRequest } from './_httpClient.js'

const getAdminToken = () => getStoredValue(STORAGE_KEYS.USAGE_ADMIN_TOKEN)

const adminRequest = (config = {}) => {
  const token = getAdminToken()
  const headers = {
    ...(config.headers || {}),
    ...(token ? { 'X-Admin-Token': token } : {})
  }

  return apiRequest({
    ...config,
    headers
  })
}

export const setUsageAdminToken = (token) => {
  const val = String(token || '').trim()
  if (!val) {
    removeStoredValue(STORAGE_KEYS.USAGE_ADMIN_TOKEN)
    return
  }
  setStoredValue(STORAGE_KEYS.USAGE_ADMIN_TOKEN, val)
}

export const clearUsageAdminToken = () => {
  removeStoredValue(STORAGE_KEYS.USAGE_ADMIN_TOKEN)
}

export const usageAdminLogin = (payload) =>
  apiRequest({
    url: '/usage-admin/login',
    method: 'post',
    data: payload
  })

export const usageAdminSession = () =>
  adminRequest({
    url: '/usage-admin/session',
    method: 'get',
    silentErrorToast: true
  })

export const getUsageAdminUsers = () =>
  adminRequest({
    url: '/usage-admin/users',
    method: 'get'
  })

export const assignUsageAdminUserKey = (userId, apiName) =>
  adminRequest({
    url: `/usage-admin/users/${encodeURIComponent(userId)}/assignments`,
    method: 'post',
    data: { apiName }
  })

export const unassignUsageAdminUserKey = (userId, apiName) =>
  adminRequest({
    url: `/usage-admin/users/${encodeURIComponent(userId)}/assignments/${encodeURIComponent(apiName)}`,
    method: 'delete'
  })

export const getUsageAdminBalance = () =>
  adminRequest({
    url: '/usage-admin/302/balance',
    method: 'get'
  })

export const getUsageAdminApiKeys = () =>
  adminRequest({
    url: '/usage-admin/302/api-keys',
    method: 'get'
  })

export const createUsageAdminApiKey = (payload) =>
  adminRequest({
    url: '/usage-admin/302/api-keys',
    method: 'post',
    data: payload
  })

export const deleteUsageAdminApiKey = (apiName) =>
  adminRequest({
    url: `/usage-admin/302/api-keys/${encodeURIComponent(apiName)}`,
    method: 'delete'
  })

export const getUsageAdminApiRecord = (params) =>
  adminRequest({
    url: '/usage-admin/302/api-record',
    method: 'get',
    params
  })
