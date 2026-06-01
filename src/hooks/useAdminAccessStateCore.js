export const getAdminDisplayName = ({ adminUser = null, user = null } = {}) => {
  const name = String(user?.displayName || '').trim()
  return name || adminUser?.email || user?.email || '管理员'
}

export const getAdminAccountLabel = ({ adminUser = null, user = null } = {}) => (
  adminUser?.email || user?.email || '-'
)

export const getAdminSelfCheck = (targetUser = {}, { adminUser = null, user = null } = {}) => (
  String(targetUser?.id || '') === String(adminUser?.id || user?.id || '')
)
