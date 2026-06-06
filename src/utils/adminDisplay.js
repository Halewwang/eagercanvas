export const formatAdminDateTime = (value) => {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '-'
  return date.toLocaleString()
}

export const formatAdminExpire = (value) => {
  const seconds = Number(value)
  if (!seconds || seconds <= 0) return '-'
  return new Date(seconds * 1000).toLocaleString()
}

export const maskAdminApiKey = (value) => {
  const key = String(value || '')
  if (key.length <= 10) return key || '-'
  return `${key.slice(0, 6)}...${key.slice(-4)}`
}

export const formatAdminUsd = (value, digits = 2) => Number(value || 0).toFixed(digits)

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

export const ADMIN_ROUTE_NAME_BY_SECTION = {
  overview: 'AdminDashboard',
  users: 'AdminUsers',
  service: 'AdminService',
  audit: 'AdminAudit',
  issues: 'AdminIssues'
}

export const ADMIN_SECTION_BY_ROUTE_NAME = {
  AdminDashboard: 'overview',
  AdminUsers: 'users',
  AdminService: 'service',
  AdminAudit: 'audit',
  AdminIssues: 'issues'
}

export const getAdminNavItems = ({ canReadUsers = false, showServiceSection = false, canReadAudit = false, canReadIssues = false } = {}) => {
  const items = [
    { key: 'overview', label: '概览', note: '总览' }
  ]
  if (canReadUsers) items.push({ key: 'users', label: '用户服务', note: '开通' })
  if (showServiceSection) items.push({ key: 'service', label: '消耗对账', note: '同步' })
  if (canReadAudit) items.push({ key: 'audit', label: '审计日志', note: '追踪' })
  if (canReadIssues) items.push({ key: 'issues', label: '问题收件箱', note: '修复' })
  return items
}

export const getAdminAccessScope = ({
  canReadUsers = false,
  canReadUsage = false,
  canActivateService = false,
  canDisableService = false,
  canResetService = false,
  canReconcileBilling = false,
  canReadAudit = false,
  canReadIssues = false
} = {}) => {
  const items = ['概览']
  if (canReadUsers) items.push('用户')
  if (canReadUsage) items.push('用量')
  if (canActivateService || canDisableService || canResetService) items.push('服务访问')
  if (canReconcileBilling) items.push('对账')
  if (canReadAudit) items.push('审计')
  if (canReadIssues) items.push('问题')
  return items
}

export const getAdminOverviewCards = ({
  canReadUsers = false,
  canReadUsage = false,
  canReadAudit = false,
  userStats = {},
  usageSummary = {},
  auditTotal = 0,
  activeServiceUsers = 0
} = {}) => [
  { label: '管理用户数', value: canReadUsers ? userStats.total : '--', note: canReadUsers ? '当前后台可见用户总数' : '缺少权限' },
  { label: '已暂停', value: canReadUsers ? userStats.suspended : '--', note: canReadUsers ? '当前被暂停的账号数' : '缺少权限' },
  { label: '总调用量', value: canReadUsage ? usageSummary.totalCalls || 0 : '--', note: canReadUsage ? '全局请求总次数' : '无用量权限' },
  { label: '官方消耗 (USD)', value: canReadUsage ? formatAdminUsd(usageSummary.totalCostUsd) : '--', note: canReadUsage ? '累计官方消耗' : '无用量权限' },
  { label: '审计条目', value: canReadAudit ? auditTotal : '--', note: canReadAudit ? '当前审计日志总条数' : '无审计权限' },
  { label: '已开通服务', value: canReadUsers ? activeServiceUsers : '--', note: canReadUsers ? '当前可调用服务的用户数' : '缺少权限' }
]

export const getUsageAdminOverviewMetrics = ({
  balance = '',
  users = [],
  apiKeys = []
} = {}) => {
  const userList = Array.isArray(users) ? users : []
  const apiKeyList = Array.isArray(apiKeys) ? apiKeys : []
  const hasBalance = balance || balance === 0

  return [
    { label: 'Eager Service Balance', value: hasBalance ? `$${balance}` : '--' },
    { label: 'Registered Users', value: userList.length },
    { label: '服务凭证', value: apiKeyList.length },
    {
      label: 'Users With Credentials',
      value: userList.filter((item) => (item.assignedApiKeys || []).length > 0).length
    }
  ]
}

export const getUsageAdminSidebarItems = ({
  users = [],
  apiKeys = []
} = {}) => {
  const userList = Array.isArray(users) ? users : []
  const apiKeyList = Array.isArray(apiKeys) ? apiKeys : []

  return [
    { label: 'Overview', value: 'Live', href: '#overview', active: true },
    { label: '服务凭证', value: apiKeyList.length, href: '#keys', active: false },
    { label: 'Users', value: userList.length, href: '#users', active: false }
  ]
}

export const getUsageAdminSessionSummary = ({
  adminSession = null,
  isAuthenticated = false
} = {}) => ({
  username: adminSession?.admin?.username || 'Not signed in',
  status: isAuthenticated ? 'Usage admin access' : 'Login required'
})

export const getAdminTopModelLabel = (user) => {
  const model = user?.officialUsage?.byModel?.[0]
  if (!model) return '暂无模型明细'
  return `${model.model || '未命名模型'} · ${model.calls || 0} 次`
}

export const getAdminUsageBarWidth = ({ value = 0, series = [] } = {}) => {
  const max = Math.max(...series.map((item) => Number(item.total_calls || 0)), 1)
  return Math.round((Number(value || 0) / max) * 100)
}

export const formatAdminJson = (value) => {
  try {
    return JSON.stringify(value || {}, null, 2)
  } catch {
    return '{}'
  }
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

export const getAdminServiceStatusClass = (status) => {
  const value = String(status || 'not_enabled')
  if (value === 'active') return 'ui-status-pill-active'
  if (value === 'disabled' || value === 'deleted') return 'ui-status-pill-suspended'
  if (value === 'create_failed') return 'ui-status-pill-deleted'
  return ''
}

export const getAdminServiceStatusLabel = (status) => {
  const value = String(status || 'not_enabled')
  if (value === 'active') return '已开通'
  if (value === 'disabled') return '已停用'
  if (value === 'create_failed') return '创建失败'
  if (value === 'deleted') return '已删除'
  return '未开通'
}
