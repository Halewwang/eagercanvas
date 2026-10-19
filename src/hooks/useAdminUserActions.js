import { ref } from 'vue'
import {
  activateAdminUserService, deleteAdminUser, disableAdminUserService,
  restoreAdminUser, updateAdminUserStatus
} from '@/api/admin'
import { getErrorMessage } from '@/utils'
import {
  buildAdminUserMutationPayload, canRunAdminUserMutation, canUseAdminDesktopMutation, setAdminActionLoading
} from './useAdminUserActionsCore.js'

export const useAdminUserActions = ({
  canActivateService, canArchiveUser, canDisableService, canManageUserStatus, canRestoreUser,
  canUseDesktopActions = { value: false }, isSelf = () => false, loadUsers = async () => {},
  windowTarget = typeof window === 'undefined' ? null : window
}) => {
  const statusLoading = ref({})
  const deleting = ref({})
  const serviceLoading = ref({})
  const mutationDialogVisible = ref(false)
  const mutationDialogAction = ref('')
  const mutationDialogUser = ref(null)
  const mutationSubmitting = ref(false)
  const getMessageApi = () => windowTarget?.$message

  const closeMutationDialog = () => {
    if (mutationSubmitting.value) return
    mutationDialogVisible.value = false
    mutationDialogAction.value = ''
    mutationDialogUser.value = null
  }
  const canRunMutation = (action, user) => canRunAdminUserMutation({
    action, user, canUseDesktopActions, isSelf,
    permissions: { canArchiveUser, canRestoreUser, canManageUserStatus, canDisableService }
  })
  const openMutationDialog = (action, user) => {
    if (!canRunMutation(action, user)) return
    mutationDialogAction.value = action
    mutationDialogUser.value = user
    mutationDialogVisible.value = true
  }
  const suspendUser = (user) => openMutationDialog('suspend', user)
  const activateUser = (user) => openMutationDialog('resume', user)
  const restoreUser = (user) => openMutationDialog('restore', user)
  const deleteUser = (user) => openMutationDialog('archive', user)
  const disableService = (user) => openMutationDialog('disable-service', user)

  const submitMutation = async (form = {}) => {
    const user = mutationDialogUser.value
    const action = mutationDialogAction.value
    if (!action || !canRunMutation(action, user)) return
    const result = buildAdminUserMutationPayload({ action, user, ...form })
    if (!result.ok) return getMessageApi()?.warning(result.message)
    const reason = result.payload.reason
    mutationSubmitting.value = true
    const loadingRef = action === 'archive' ? deleting : (action === 'disable-service' ? serviceLoading : statusLoading)
    setAdminActionLoading(loadingRef, user.id, true)
    try {
      if (action === 'suspend') await updateAdminUserStatus(user.id, 'suspended', reason)
      if (action === 'resume') await updateAdminUserStatus(user.id, 'active', reason)
      if (action === 'archive') await deleteAdminUser(user.id, reason)
      if (action === 'restore') await restoreAdminUser(user.id, reason)
      if (action === 'disable-service') await disableAdminUserService(user.id, reason)
      getMessageApi()?.success('用户变更已完成')
      await loadUsers()
      mutationSubmitting.value = false
      closeMutationDialog()
    } catch (error) {
      if (!error?.__handled) getMessageApi()?.error(getErrorMessage(error, '用户变更失败'))
    } finally {
      mutationSubmitting.value = false
      setAdminActionLoading(loadingRef, user.id, false)
    }
  }

  const activateService = async (user) => {
    if (!canUseAdminDesktopMutation(canUseDesktopActions, canActivateService) || !user?.id || user.status === 'deleted') return
    setAdminActionLoading(serviceLoading, user.id, true)
    try {
      await activateAdminUserService(user.id)
      getMessageApi()?.success('服务已开通，全部文字、图片和视频模型均可使用')
      await loadUsers()
    } catch (error) {
      if (!error?.__handled) getMessageApi()?.error(getErrorMessage(error, '开通服务失败'))
    } finally {
      setAdminActionLoading(serviceLoading, user.id, false)
    }
  }

  return {
    activateService, activateUser, closeMutationDialog, deleteUser, deleting, disableService,
    mutationDialogAction, mutationDialogUser, mutationDialogVisible, mutationSubmitting,
    restoreUser, serviceLoading, statusLoading, submitMutation, suspendUser
  }
}

export default useAdminUserActions
