export const ADMIN_SERVICE_LIMIT_ERROR = '额度必须是非负数字'

export const setAdminActionLoading = (stateRef, userId, value) => {
  const key = String(userId || '').trim()
  if (!key || !stateRef) return false
  stateRef.value = { ...(stateRef.value || {}), [key]: value }
  return true
}

export const getAdminSelectedRole = (selectedRoles, user = {}) => {
  return String(selectedRoles?.value?.[user.id] || '').trim()
}

export const getAdminDeleteUserConfirmMessage = (user = {}) => {
  return `确认删除用户 ${user.email} 吗？删除后将禁用该账号访问。`
}

export const getAdminResetServiceConfirmMessage = (user = {}) => {
  return `确认重置 ${user.email} 的服务凭证吗？历史消耗记录会保留。`
}

export const getAdminReconcileBillingSuccessMessage = (data = {}) => {
  return `同步完成：${data?.matched || 0} 条已匹配，${data?.unmatched || 0} 条未匹配`
}

export const getAdminSuspendUserPromptMessage = () => '请输入暂停原因（可选）：'

export const getAdminDisableServicePromptMessage = () => '请输入停用原因（可选）：'

export const getAdminLimitCostPromptMessage = () => '请输入总额度（USD，0 表示不限制）：'

export const getAdminLimitDailyCostPromptMessage = () => '请输入日额度（USD，0 表示不限制）：'

export const getAdminServiceLimitPayload = (user = {}, limitCostValue = 0, limitDailyCostValue = 0) => {
  const limitCost = Number(limitCostValue || 0)
  const limitDailyCost = Number(limitDailyCostValue || 0)

  if (!Number.isFinite(limitCost) || !Number.isFinite(limitDailyCost) || limitCost < 0 || limitDailyCost < 0) {
    return { ok: false, message: ADMIN_SERVICE_LIMIT_ERROR }
  }

  return {
    ok: true,
    payload: {
      limitCost,
      limitDailyCost,
      expiredOn: Number(user?.service?.expiredOn || 0)
    }
  }
}

const noopAsync = async () => {}

export const runAdminUsersAndLogsRefresh = ({ loadUsers = noopAsync, loadLogs = noopAsync } = {}) => {
  return Promise.all([loadUsers(), loadLogs()])
}

export const runAdminBillingRefresh = ({
  loadUsers = noopAsync,
  loadUsage = noopAsync,
  loadLogs = noopAsync
} = {}) => {
  return Promise.all([loadUsers(), loadUsage(), loadLogs()])
}
