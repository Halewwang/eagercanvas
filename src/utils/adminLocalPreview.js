import { STORAGE_KEYS } from './constants.js'
import { isLocalPreviewEnabled } from './localPreview.js'
import { getStoredValue } from './storage.js'

export const LOCAL_PREVIEW_ADMIN_READ_KEYS = Object.freeze({ USERS: 'users', USER: 'user' })

const userFixtures = [
  {
    id: 'preview-user-1', email: 'mia.preview@local.dev', displayName: 'Mia Preview', status: 'active', roles: ['user'],
    createdAt: '2026-06-01T09:00:00.000Z', lastLoginAt: '2026-07-12T10:20:00.000Z',
    service: { serviceStatus: 'active' }
  },
  {
    id: 'preview-user-2', email: 'noah.preview@local.dev', displayName: 'Noah Preview', status: 'active', roles: ['support', 'user'],
    createdAt: '2026-06-10T09:00:00.000Z', lastLoginAt: '2026-07-11T18:00:00.000Z',
    service: { serviceStatus: 'not_enabled' }
  },
  {
    id: 'preview-user-3', email: 'suspended.preview@local.dev', displayName: 'Suspended Preview', status: 'suspended', roles: ['user'],
    createdAt: '2026-05-20T09:00:00.000Z', suspendedReason: 'Local preview fixture',
    service: { serviceStatus: 'disabled' }
  }
]

const buildUsersResponse = (params = {}) => {
  const search = String(params.search || '').trim().toLowerCase()
  const page = Math.max(1, Number(params.page) || 1)
  const limit = Math.max(1, Number(params.limit) || 25)
  const filtered = userFixtures.filter((user) => (
    (!search || `${user.email} ${user.displayName}`.toLowerCase().includes(search)) &&
    (!params.status || user.status === params.status) &&
    (!params.serviceStatus || user.service.serviceStatus === params.serviceStatus) &&
    (!params.role || user.roles.includes(params.role))
  ))
  const start = (page - 1) * limit
  return { data: { items: filtered.slice(start, start + limit), pagination: { page, limit, total: filtered.length } } }
}

export const resolveLocalPreviewAdminRead = (
  key,
  params = {},
  { env = import.meta.env || {}, storedToken = getStoredValue(STORAGE_KEYS.ACCESS_TOKEN) } = {}
) => {
  if (!isLocalPreviewEnabled(env) || String(storedToken || '').trim()) return { matched: false, response: null }
  const response = key === LOCAL_PREVIEW_ADMIN_READ_KEYS.USERS ? buildUsersResponse(params)
    : key === LOCAL_PREVIEW_ADMIN_READ_KEYS.USER ? { data: userFixtures.find((user) => user.id === params.userId) || null }
      : null
  return response ? { matched: true, response: JSON.parse(JSON.stringify(response)) } : { matched: false, response: null }
}
