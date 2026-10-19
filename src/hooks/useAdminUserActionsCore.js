const readBooleanRef = (value) => Boolean(value?.value ?? value)

export const canUseAdminDesktopMutation = (canUseDesktopActions, permission) => (
  readBooleanRef(canUseDesktopActions) && readBooleanRef(permission)
)

export const setAdminActionLoading = (stateRef, userId, value) => {
  const key = String(userId || '').trim()
  if (!key || !stateRef) return false
  stateRef.value = { ...(stateRef.value || {}), [key]: value }
  return true
}

export const buildAdminUserMutationPayload = ({ action = '', reason = '', confirmation = '', user = {} } = {}) => {
  const safeReason = String(reason || '').trim()
  if (!safeReason) return { ok: false, message: '请输入变更原因' }
  if (action === 'archive' && String(confirmation || '').trim() !== String(user?.email || '').trim()) {
    return { ok: false, message: '请输入完整用户邮箱确认删除' }
  }
  return { ok: true, payload: { reason: safeReason } }
}

export const canRunAdminUserMutation = ({ action, user, canUseDesktopActions, permissions = {}, isSelf = () => false } = {}) => {
  if (!readBooleanRef(canUseDesktopActions) || !user?.id) return false
  if (action === 'disable-service') return readBooleanRef(permissions.canDisableService) && user.status !== 'deleted'
  if (isSelf(user)) return false
  if (action === 'archive') return readBooleanRef(permissions.canArchiveUser)
  if (action === 'restore') return readBooleanRef(permissions.canRestoreUser)
  if (action === 'suspend' || action === 'resume') return readBooleanRef(permissions.canManageUserStatus)
  return false
}
