export const formatAdminDateTime = (value) => {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '-'
  return date.toLocaleString()
}

export const ADMIN_ROLE_OPTIONS = [
  { value: 'super_admin', label: '超级管理员' },
  { value: 'admin', label: '管理员' },
  { value: 'ops', label: '运维' },
  { value: 'support', label: '客服' },
  { value: 'user', label: '普通用户' }
]

const adminRoleLabelMap = Object.fromEntries(ADMIN_ROLE_OPTIONS.map((item) => [item.value, item.label]))

export const getAdminRoleLabel = (role) => {
  const value = String(role || '').trim()
  return adminRoleLabelMap[value] || value || '-'
}

export const formatAdminRoleList = (roles = []) => {
  return (Array.isArray(roles) ? roles : []).map((item) => getAdminRoleLabel(item)).join('、')
}

export const getAdminUserStatusClass = (status) => {
  const value = String(status || 'active')
  if (value === 'suspended') return 'ui-status-pill-suspended'
  if (value === 'deleted') return 'ui-status-pill-deleted'
  return 'ui-status-pill-active'
}

export const getAdminUserStatusLabel = (status) => {
  const value = String(status || 'active')
  if (value === 'suspended') return '已暂停'
  if (value === 'deleted') return '已删除'
  return '正常'
}

export const getAdminServiceStatusLabel = (status) => {
  const value = String(status || 'not_enabled')
  if (value === 'active') return '已开通'
  if (value === 'disabled') return '已暂停'
  if (value === 'create_failed') return '创建失败'
  if (value === 'deleted') return '已删除'
  return '未开通'
}
