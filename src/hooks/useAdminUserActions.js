import { ref } from 'vue'
import {
  activateAdminUserService,
  deleteAdminUser,
  disableAdminUserService,
  reconcileAdminBilling,
  resetAdminUserService,
  updateAdminUserServiceLimits,
  updateAdminUserRoles,
  updateAdminUserStatus
} from '@/api/admin'
import { getErrorMessage } from '@/utils'
import {
  getAdminDeleteUserConfirmMessage,
  getAdminDisableServicePromptMessage,
  getAdminLimitCostPromptMessage,
  getAdminLimitDailyCostPromptMessage,
  getAdminReconcileBillingSuccessMessage,
  getAdminResetServiceConfirmMessage,
  getAdminSelectedRole,
  getAdminServiceLimitPayload,
  getAdminSuspendUserPromptMessage,
  runAdminBillingRefresh,
  runAdminUsersAndLogsRefresh,
  setAdminActionLoading
} from './useAdminUserActionsCore.js'

const noopAsync = async () => {}

const getWindowTarget = () => (typeof window === 'undefined' ? null : window)

export const useAdminUserActions = ({
  canActivateService,
  canDisableService,
  canManageRoles,
  canManageUserStatus,
  canReconcileBilling,
  canResetService,
  canUpdateServiceLimits,
  isSelf = () => false,
  loadLogs = noopAsync,
  loadUsage = noopAsync,
  loadUsers = noopAsync,
  selectedRoles,
  windowTarget = getWindowTarget()
}) => {
  const saving = ref({})
  const statusLoading = ref({})
  const deleting = ref({})
  const serviceLoading = ref({})
  const reconcilingBilling = ref(false)

  const getMessageApi = () => windowTarget?.$message
  const refreshUsersAndLogs = () => runAdminUsersAndLogsRefresh({ loadUsers, loadLogs })

  const saveRoles = async (user) => {
    if (!canManageRoles.value || isSelf(user)) return
    const role = getAdminSelectedRole(selectedRoles, user)
    if (!role) return getMessageApi()?.warning('请选择角色')
    setAdminActionLoading(saving, user.id, true)
    try {
      await updateAdminUserRoles(user.id, [role])
      getMessageApi()?.success('角色更新成功')
      await refreshUsersAndLogs()
    } catch (error) {
      if (!error?.__handled) getMessageApi()?.error(getErrorMessage(error, '更新角色失败'))
    } finally {
      setAdminActionLoading(saving, user.id, false)
    }
  }

  const suspendUser = async (user) => {
    if (!canManageUserStatus.value || isSelf(user)) return
    const reason = windowTarget?.prompt?.(getAdminSuspendUserPromptMessage(), '') || ''
    setAdminActionLoading(statusLoading, user.id, true)
    try {
      await updateAdminUserStatus(user.id, 'suspended', reason)
      getMessageApi()?.success('用户已暂停')
      await refreshUsersAndLogs()
    } catch (error) {
      if (!error?.__handled) getMessageApi()?.error(getErrorMessage(error, '暂停用户失败'))
    } finally {
      setAdminActionLoading(statusLoading, user.id, false)
    }
  }

  const activateUser = async (user) => {
    if (!canManageUserStatus.value || isSelf(user)) return
    setAdminActionLoading(statusLoading, user.id, true)
    try {
      await updateAdminUserStatus(user.id, 'active')
      getMessageApi()?.success('用户已恢复')
      await refreshUsersAndLogs()
    } catch (error) {
      if (!error?.__handled) getMessageApi()?.error(getErrorMessage(error, '恢复用户失败'))
    } finally {
      setAdminActionLoading(statusLoading, user.id, false)
    }
  }

  const deleteUser = async (user) => {
    if (!canManageUserStatus.value || isSelf(user)) return
    const ok = windowTarget?.confirm?.(getAdminDeleteUserConfirmMessage(user))
    if (!ok) return
    setAdminActionLoading(deleting, user.id, true)
    try {
      await deleteAdminUser(user.id)
      getMessageApi()?.success('用户已删除')
      await refreshUsersAndLogs()
    } catch (error) {
      if (!error?.__handled) getMessageApi()?.error(getErrorMessage(error, '删除用户失败'))
    } finally {
      setAdminActionLoading(deleting, user.id, false)
    }
  }

  const activateService = async (user) => {
    if (!canActivateService.value) return
    setAdminActionLoading(serviceLoading, user.id, true)
    try {
      await activateAdminUserService(user.id, { limitCost: 0, limitDailyCost: 0, expiredOn: 0 })
      getMessageApi()?.success('服务已开通')
      await refreshUsersAndLogs()
    } catch (error) {
      if (!error?.__handled) getMessageApi()?.error(getErrorMessage(error, '开通服务失败'))
    } finally {
      setAdminActionLoading(serviceLoading, user.id, false)
    }
  }

  const disableService = async (user) => {
    if (!canDisableService.value) return
    const reason = windowTarget?.prompt?.(getAdminDisableServicePromptMessage(), '') || ''
    setAdminActionLoading(serviceLoading, user.id, true)
    try {
      await disableAdminUserService(user.id, reason)
      getMessageApi()?.success('服务已停用')
      await refreshUsersAndLogs()
    } catch (error) {
      if (!error?.__handled) getMessageApi()?.error(getErrorMessage(error, '停用服务失败'))
    } finally {
      setAdminActionLoading(serviceLoading, user.id, false)
    }
  }

  const resetService = async (user) => {
    if (!canResetService.value) return
    const ok = windowTarget?.confirm?.(getAdminResetServiceConfirmMessage(user))
    if (!ok) return
    setAdminActionLoading(serviceLoading, user.id, true)
    try {
      await resetAdminUserService(user.id)
      getMessageApi()?.success('服务凭证已重置')
      await refreshUsersAndLogs()
    } catch (error) {
      if (!error?.__handled) getMessageApi()?.error(getErrorMessage(error, '重置服务凭证失败'))
    } finally {
      setAdminActionLoading(serviceLoading, user.id, false)
    }
  }

  const updateServiceLimits = async (user) => {
    if (!canUpdateServiceLimits.value) return
    const limitCostValue = windowTarget?.prompt?.(getAdminLimitCostPromptMessage(), user.service?.limitCost ?? 0) || 0
    const limitDailyCostValue = windowTarget?.prompt?.(getAdminLimitDailyCostPromptMessage(), user.service?.limitDailyCost ?? 0) || 0
    const result = getAdminServiceLimitPayload(user, limitCostValue, limitDailyCostValue)
    if (!result.ok) {
      getMessageApi()?.warning(result.message)
      return
    }
    setAdminActionLoading(serviceLoading, user.id, true)
    try {
      await updateAdminUserServiceLimits(user.id, result.payload)
      getMessageApi()?.success('服务额度已更新')
      await refreshUsersAndLogs()
    } catch (error) {
      if (!error?.__handled) getMessageApi()?.error(getErrorMessage(error, '调整服务额度失败'))
    } finally {
      setAdminActionLoading(serviceLoading, user.id, false)
    }
  }

  const reconcileBilling = async () => {
    if (!canReconcileBilling.value) return
    reconcilingBilling.value = true
    try {
      const rsp = await reconcileAdminBilling()
      getMessageApi()?.success(getAdminReconcileBillingSuccessMessage(rsp?.data))
      await runAdminBillingRefresh({ loadUsers, loadUsage, loadLogs })
    } catch (error) {
      if (!error?.__handled) getMessageApi()?.error(getErrorMessage(error, '同步官方消耗失败'))
    } finally {
      reconcilingBilling.value = false
    }
  }

  return {
    activateService,
    activateUser,
    deleteUser,
    deleting,
    disableService,
    reconcileBilling,
    reconcilingBilling,
    resetService,
    saveRoles,
    saving,
    serviceLoading,
    statusLoading,
    suspendUser,
    updateServiceLimits
  }
}

export default useAdminUserActions
