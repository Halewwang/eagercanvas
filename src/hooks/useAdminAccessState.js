import { computed } from 'vue'
import { getAdminAccountLabel, getAdminDisplayName, getAdminSelfCheck } from './useAdminAccessStateCore.js'

export const useAdminAccessState = ({ auth }) => {
  const canReadUsers = computed(() => auth.hasPermission('admin.user.read'))
  const canManageRoles = computed(() => auth.hasPermission('admin.user.role.update'))
  const canManageUserStatus = computed(() => auth.hasPermission('admin.user.status.update'))
  const canArchiveUser = computed(() => auth.hasPermission('admin.user.delete'))
  const canRestoreUser = computed(() => auth.hasPermission('admin.user.restore'))
  const canActivateService = computed(() => auth.hasPermission('admin.service_access.activate'))
  const canDisableService = computed(() => auth.hasPermission('admin.service_access.disable'))
  const displayName = computed(() => getAdminDisplayName({ adminUser: auth.adminUser.value, user: auth.user.value }))
  const adminAccountLabel = computed(() => getAdminAccountLabel({ adminUser: auth.adminUser.value, user: auth.user.value }))
  const accessScope = computed(() => [
    ...(canReadUsers.value ? ['用户管理'] : []),
    ...(canActivateService.value || canDisableService.value ? ['服务开通'] : []),
    ...(canManageRoles.value ? ['角色调整'] : [])
  ])
  const isSelf = (user) => getAdminSelfCheck(user, { adminUser: auth.adminUser.value, user: auth.user.value })
  return {
    accessScope, adminAccountLabel, canActivateService, canArchiveUser, canDisableService,
    canManageRoles, canManageUserStatus, canReadUsers, canRestoreUser, displayName, isSelf
  }
}

export default useAdminAccessState
