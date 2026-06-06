import { computed } from 'vue'
import { getAdminAccessScope } from '@/utils/adminDisplay'
import {
  getAdminAccountLabel,
  getAdminDisplayName,
  getAdminSelfCheck
} from './useAdminAccessStateCore.js'

export const useAdminAccessState = ({ auth }) => {
  const canReadUsers = computed(() => auth.hasPermission('admin.user.read'))
  const canManageRoles = computed(() => auth.hasPermission('admin.user.role.update'))
  const canManageUserStatus = computed(() => auth.hasPermission('admin.user.status.update'))
  const canReadUsage = computed(() => auth.hasPermission('admin.usage.read_all'))
  const canReadAudit = computed(() => auth.hasPermission('admin.audit.read'))
  const canReadIssues = computed(() => auth.hasPermission('admin.issue.read'))
  const canExportIssues = computed(() => auth.hasPermission('admin.issue.export'))
  const canUpdateIssues = computed(() => auth.hasPermission('admin.issue.update'))
  const canNotifyIssues = computed(() => auth.hasPermission('admin.issue.notify'))
  const canActivateService = computed(() => auth.hasPermission('admin.service_access.activate'))
  const canDisableService = computed(() => auth.hasPermission('admin.service_access.disable'))
  const canResetService = computed(() => auth.hasPermission('admin.service_access.reset'))
  const canUpdateServiceLimits = computed(() => auth.hasPermission('admin.service_access.update_limits'))
  const canReconcileBilling = computed(() => auth.hasPermission('admin.billing.reconcile'))

  const showServiceSection = computed(() => canReadUsage.value || canReconcileBilling.value)
  const showUserActions = computed(() => (
    canActivateService.value ||
    canDisableService.value ||
    canResetService.value ||
    canUpdateServiceLimits.value ||
    canManageUserStatus.value
  ))

  const displayName = computed(() => getAdminDisplayName({
    adminUser: auth.adminUser.value,
    user: auth.user.value
  }))
  const adminAccountLabel = computed(() => getAdminAccountLabel({
    adminUser: auth.adminUser.value,
    user: auth.user.value
  }))
  const accessScope = computed(() => getAdminAccessScope({
    canReadUsers: canReadUsers.value,
    canReadUsage: canReadUsage.value,
    canActivateService: canActivateService.value,
    canDisableService: canDisableService.value,
    canResetService: canResetService.value,
    canReconcileBilling: canReconcileBilling.value,
    canReadAudit: canReadAudit.value,
    canReadIssues: canReadIssues.value
  }))

  const isSelf = (user) => getAdminSelfCheck(user, {
    adminUser: auth.adminUser.value,
    user: auth.user.value
  })

  return {
    accessScope,
    adminAccountLabel,
    canActivateService,
    canDisableService,
    canManageRoles,
    canManageUserStatus,
    canReadAudit,
    canReadIssues,
    canExportIssues,
    canUpdateIssues,
    canNotifyIssues,
    canReadUsage,
    canReadUsers,
    canReconcileBilling,
    canResetService,
    canUpdateServiceLimits,
    displayName,
    isSelf,
    showServiceSection,
    showUserActions
  }
}

export default useAdminAccessState
