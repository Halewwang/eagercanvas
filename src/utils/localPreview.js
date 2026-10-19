export const getLocalPreviewAccessToken = (env = import.meta.env || {}) =>
  String(env?.VITE_LOCAL_PREVIEW_ACCESS_TOKEN || '').trim()

export const isLocalPreviewEnabled = (env = import.meta.env || {}) => {
  return Boolean(
    env?.DEV &&
    String(env?.VITE_BYPASS_AUTH || '').trim().toLowerCase() === 'true' &&
    getLocalPreviewAccessToken(env)
  )
}

export const resolveLocalPreviewAccessToken = (storedToken = '', env = import.meta.env || {}) => {
  const token = String(storedToken || '').trim()
  if (token) return token
  return isLocalPreviewEnabled(env) ? getLocalPreviewAccessToken(env) : ''
}

export const LOCAL_PREVIEW_ADMIN_PERMISSIONS = [
  'admin.user.read',
  'admin.user.role.update',
  'admin.user.status.update',
  'admin.user.delete',
  'admin.user.restore',
  'admin.audit.read',
  'admin.service_access.activate',
  'admin.service_access.disable'
]

export const getLocalPreviewAdminSession = () => ({
  user: {
    id: 'dev-bypass-admin',
    email: 'preview-admin@local.dev',
    displayName: 'Local Admin Preview'
  },
  roles: ['super_admin', 'ops'],
  permissions: [...LOCAL_PREVIEW_ADMIN_PERMISSIONS]
})
