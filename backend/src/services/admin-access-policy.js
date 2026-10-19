import { HttpError } from '../utils/http.js'

export const assertAdminTargetMutationAllowed = ({ operatorUserId, targetUserId, action }) => {
  if (String(operatorUserId || '') === String(targetUserId || '')) {
    throw new HttpError(400, `Cannot ${action} your own admin account`, 'SELF_ADMIN_MUTATION_NOT_ALLOWED')
  }
}

export const assertRoleGrantAllowed = ({ operatorRoles = [], targetRoles = [], nextRoles = [] }) => {
  const isSuperAdmin = operatorRoles.includes('super_admin')
  if (!isSuperAdmin && targetRoles.includes('super_admin')) {
    throw new HttpError(403, 'Only super_admin can modify a super_admin account', 'FORBIDDEN_SUPER_ADMIN_EDIT')
  }
  if (!isSuperAdmin && nextRoles.includes('super_admin')) {
    throw new HttpError(403, 'Only super_admin can grant super_admin role', 'FORBIDDEN_SUPER_ADMIN_GRANT')
  }
}

export const assertActiveSuperAdminPreserved = ({
  targetRoles = [], nextRoles = targetRoles, targetStatus = 'active', nextStatus = targetStatus,
  activeSuperAdminCount = 0
}) => {
  const removesActiveSuperAdmin = targetRoles.includes('super_admin') &&
    targetStatus === 'active' &&
    (!nextRoles.includes('super_admin') || nextStatus !== 'active')
  if (removesActiveSuperAdmin && Number(activeSuperAdminCount) <= 1) {
    throw new HttpError(409, 'At least one active super_admin is required', 'LAST_SUPER_ADMIN_REQUIRED')
  }
}

export const assertAccountMayReceiveServiceMutation = ({ status, deletedAt }) => {
  if (status === 'suspending') {
    throw new HttpError(409, 'Another account mutation is in progress', 'ACCOUNT_MUTATION_IN_PROGRESS')
  }
  if (status === 'deleted' || status === 'archiving' || deletedAt) {
    throw new HttpError(409, 'Restore the archived account before changing service access', 'ARCHIVED_ACCOUNT_IMMUTABLE')
  }
}
