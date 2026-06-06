export const isLocalPreviewEnabled = (env = import.meta.env || {}) => {
  return Boolean(env?.DEV && String(env?.VITE_BYPASS_AUTH || '').trim().toLowerCase() === 'true')
}

const LOCAL_PREVIEW_ADMIN_PERMISSIONS = [
  'admin.dashboard.read',
  'admin.user.read',
  'admin.user.role.update',
  'admin.user.status.update',
  'admin.usage.read_all',
  'admin.audit.read',
  'admin.issue.read',
  'admin.issue.export',
  'admin.issue.update',
  'admin.issue.notify',
  'admin.service_access.activate',
  'admin.service_access.disable',
  'admin.service_access.reset',
  'admin.service_access.update_limits',
  'admin.billing.reconcile'
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
