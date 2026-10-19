import { supabase } from '../config/supabase.js'
import { randomUUID } from 'node:crypto'
import { invalidateUserAuthzCache } from './rbac.service.js'
import { HttpError } from '../utils/http.js'
import { disableUserServiceCredential } from './service-access.service.js'
import { sanitizeAdminAuditContext } from './admin-audit-sanitizer.js'
import { transferSuspendedUserTeamProjects } from './workspace-ownership-transfer.service.js'
import {
  assertAdminTargetMutationAllowed,
  assertRoleGrantAllowed
} from './admin-access-policy.js'

const isMissingRelation = (error) => {
  const msg = String(error?.message || '').toLowerCase()
  return msg.includes('relation') && msg.includes('does not exist')
}

const getRoleCodeMap = async () => {
  const { data, error } = await supabase.from('roles').select('id, code')
  if (error) {
    if (isMissingRelation(error)) {
      throw new HttpError(500, 'RBAC tables are missing. Run migration 004_rbac_admin_system.sql first.', 'RBAC_SCHEMA_MISSING')
    }
    throw new HttpError(500, error.message, 'ROLES_QUERY_FAILED')
  }
  return new Map((data || []).map((row) => [row.code, row.id]))
}

const getUserRoleCodes = async (userId) => {
  const [{ data: roles, error: rolesError }, { data: userRoles, error: userRolesError }] = await Promise.all([
    supabase.from('roles').select('id, code'),
    supabase.from('user_roles').select('role_id').eq('user_id', userId)
  ])

  if (rolesError || userRolesError) {
    const first = rolesError || userRolesError
    if (isMissingRelation(first)) {
      throw new HttpError(500, 'RBAC tables are missing. Run migration 004_rbac_admin_system.sql first.', 'RBAC_SCHEMA_MISSING')
    }
    throw new HttpError(500, first.message || 'Role query failed', 'USER_ROLES_QUERY_FAILED')
  }

  const roleCodeMap = new Map((roles || []).map((item) => [item.id, item.code]))
  return [...new Set((userRoles || []).map((row) => roleCodeMap.get(row.role_id)).filter(Boolean))].sort()
}

const throwLifecycleRpcError = (error, fallbackCode) => {
  const message = [error?.message, error?.details, error?.hint].filter(Boolean).join(' ')
  if (message.includes('FORBIDDEN_SUPER_ADMIN_EDIT')) {
    throw new HttpError(403, 'Only super_admin can modify a super_admin account', 'FORBIDDEN_SUPER_ADMIN_EDIT')
  }
  if (message.includes('FORBIDDEN_SUPER_ADMIN_GRANT')) {
    throw new HttpError(403, 'Only super_admin can grant the super_admin role', 'FORBIDDEN_SUPER_ADMIN_GRANT')
  }
  if (message.includes('FORBIDDEN_USER_ARCHIVE')) {
    throw new HttpError(403, 'Only super_admin can archive an account', 'FORBIDDEN_USER_ARCHIVE')
  }
  if (message.includes('FORBIDDEN_USER_RESTORE')) {
    throw new HttpError(403, 'Only super_admin can restore an account', 'FORBIDDEN_USER_RESTORE')
  }
  if (message.includes('LAST_SUPER_ADMIN_REQUIRED')) {
    throw new HttpError(409, 'At least one active super_admin is required', 'LAST_SUPER_ADMIN_REQUIRED')
  }
  if (message.includes('TARGET_USER_NOT_FOUND')) {
    throw new HttpError(404, 'Target user not found', 'TARGET_USER_NOT_FOUND')
  }
  if (message.includes('ACCOUNT_MUTATION_IN_PROGRESS')) {
    throw new HttpError(409, 'Another account mutation is in progress', 'ACCOUNT_MUTATION_IN_PROGRESS')
  }
  if (message.includes('ACCOUNT_ALREADY_DELETED')) {
    throw new HttpError(409, 'Account is already archived', 'ACCOUNT_ALREADY_DELETED')
  }
  if (message.includes('ACCOUNT_NOT_ARCHIVED')) {
    throw new HttpError(409, 'Account is not archived', 'ACCOUNT_NOT_ARCHIVED')
  }
  throw new HttpError(500, error?.message || 'Atomic lifecycle mutation failed', fallbackCode)
}

const buildArchiveAuditMetadata = (context) => sanitizeAdminAuditContext(context)

const finalizeUserArchiveAtomic = async ({
  targetUserId,
  operatorUserId,
  archivedAt,
  archiveToken,
  auditMetadata
}) => {
  try {
    const { error } = await supabase.rpc('admin_archive_user_atomic', {
      p_target_user_id: targetUserId,
      p_operator_user_id: operatorUserId || null,
      p_archived_at: archivedAt,
      p_archive_token: archiveToken,
      p_audit_metadata: auditMetadata
    })
    if (error) throwLifecycleRpcError(error, 'USER_DELETE_FAILED')
  } finally {
    invalidateUserAuthzCache(targetUserId)
  }
}

export const updateUserRoles = async ({
  operatorUserId,
  operatorRoles = [],
  targetUserId,
  roleCodes = [],
  ip,
  userAgent,
  requestId
}) => {
  const safeTargetUserId = String(targetUserId || '').trim()
  if (!safeTargetUserId) throw new HttpError(400, 'targetUserId is required', 'INVALID_TARGET_USER')

  const normalizedRoles = [...new Set((roleCodes || []).map((item) => String(item || '').trim()).filter(Boolean))]
  if (!normalizedRoles.length) {
    throw new HttpError(400, 'roleCodes must not be empty', 'INVALID_ROLE_CODES')
  }

  assertAdminTargetMutationAllowed({ operatorUserId, targetUserId: safeTargetUserId, action: 'modify' })
  const beforeRoles = await getUserRoleCodes(safeTargetUserId)

  const { data: targetUser, error: targetUserError } = await supabase
    .from('users')
    .select('id, email, status, deleted_at')
    .eq('id', safeTargetUserId)
    .maybeSingle()
  if (targetUserError) throw new HttpError(500, targetUserError.message, 'USER_QUERY_FAILED')
  if (!targetUser) throw new HttpError(404, 'Target user not found', 'TARGET_USER_NOT_FOUND')

  assertRoleGrantAllowed({ operatorRoles, targetRoles: beforeRoles, nextRoles: normalizedRoles })

  const roleCodeIdMap = await getRoleCodeMap()
  const roleIds = normalizedRoles.map((code) => roleCodeIdMap.get(code)).filter(Boolean)
  if (roleIds.length !== normalizedRoles.length) {
    const unknown = normalizedRoles.filter((code) => !roleCodeIdMap.get(code))
    throw new HttpError(400, `Unknown role code: ${unknown.join(', ')}`, 'INVALID_ROLE_CODES')
  }

  try {
    const { error: roleUpdateError } = await supabase.rpc('admin_replace_user_roles_atomic', {
      p_target_user_id: safeTargetUserId,
      p_role_codes: normalizedRoles,
      p_operator_user_id: operatorUserId || null,
      p_operation_token: randomUUID(),
      p_audit_metadata: sanitizeAdminAuditContext({ ip, userAgent, requestId })
    })
    if (roleUpdateError) throwLifecycleRpcError(roleUpdateError, 'USER_ROLES_UPDATE_FAILED')
  } finally {
    invalidateUserAuthzCache(safeTargetUserId)
  }

  return {
    ok: true,
    user: {
      id: targetUser.id,
      email: targetUser.email
    },
    beforeRoles,
    roles: normalizedRoles
  }
}

export const updateUserStatus = async ({
  operatorUserId,
  operatorRoles = [],
  targetUserId,
  status,
  reason,
  ip,
  userAgent,
  requestId
}, deps = {}) => {
  const safeTargetUserId = String(targetUserId || '').trim()
  const safeStatus = String(status || '').trim()
  const allowedStatuses = new Set(['active', 'suspended'])

  if (!safeTargetUserId) throw new HttpError(400, 'targetUserId is required', 'INVALID_TARGET_USER')
  if (!allowedStatuses.has(safeStatus)) throw new HttpError(400, 'Invalid status value', 'INVALID_STATUS')

  assertAdminTargetMutationAllowed({ operatorUserId, targetUserId: safeTargetUserId, action: 'modify' })
  const { data: targetUser, error: targetUserError } = await supabase
    .from('users')
    .select('id, email, status, deleted_at')
    .eq('id', safeTargetUserId)
    .maybeSingle()
  if (targetUserError) throw new HttpError(500, targetUserError.message, 'USER_QUERY_FAILED')
  if (!targetUser) throw new HttpError(404, 'Target user not found', 'TARGET_USER_NOT_FOUND')
  if (targetUser.deleted_at || targetUser.status === 'deleted') {
    throw new HttpError(400, 'Deleted account cannot change status', 'ACCOUNT_ALREADY_DELETED')
  }

  const beforeRoles = await getUserRoleCodes(safeTargetUserId)
  assertRoleGrantAllowed({ operatorRoles, targetRoles: beforeRoles, nextRoles: beforeRoles })

  const auditMetadata = sanitizeAdminAuditContext({ reason, ip, userAgent, requestId })
  let updated
  try {
    if (safeStatus === 'active') {
      const { data, error: updateError } = await supabase.rpc('admin_update_user_status_atomic', {
        p_target_user_id: safeTargetUserId,
        p_status: 'active',
        p_suspended_at: null,
        p_suspended_reason: null,
        p_operator_user_id: operatorUserId || null,
        p_operation_token: randomUUID(),
        p_audit_metadata: auditMetadata
      })
      if (updateError) throwLifecycleRpcError(updateError, 'USER_STATUS_UPDATE_FAILED')
      updated = Array.isArray(data) ? data[0] : data
      updated ||= { id: targetUser.id, email: targetUser.email, status: 'active', suspended_at: null, suspended_reason: null }
    } else {
      const suspensionToken = randomUUID()
      const { data: preparedPhase, error: prepareError } = await supabase.rpc('admin_prepare_user_suspension_atomic', {
        p_target_user_id: safeTargetUserId,
        p_operator_user_id: operatorUserId || null,
        p_suspension_token: suspensionToken,
        p_audit_metadata: auditMetadata
      })
      if (prepareError) throwLifecycleRpcError(prepareError, 'USER_SUSPENSION_PREPARE_FAILED')
      let phase = preparedPhase || 'prepared'
      if (phase === 'completed') {
        updated = { id: targetUser.id, email: targetUser.email, status: 'suspended', suspended_at: null, suspended_reason: auditMetadata.reason }
      } else {
        const transferProjects = deps.transferProjects || transferSuspendedUserTeamProjects
        const disableServiceCredential = deps.disableServiceCredential || disableUserServiceCredential
        if (phase === 'prepared') {
          const projectOwnershipTransfer = await transferProjects({
            targetUserId: safeTargetUserId,
            operatorUserId,
            reason: auditMetadata.reason
          })
          const { error } = await supabase.rpc('admin_mark_suspension_projects_transferred', {
            p_target_user_id: safeTargetUserId,
            p_suspension_token: suspensionToken,
            p_project_transfer: projectOwnershipTransfer
          })
          if (error) throwLifecycleRpcError(error, 'USER_SUSPENSION_PROJECTS_MARK_FAILED')
          phase = 'projects_transferred'
        }
        if (phase === 'projects_transferred') {
          const { error } = await supabase.rpc('admin_mark_suspension_provider_revoking', {
            p_target_user_id: safeTargetUserId,
            p_suspension_token: suspensionToken
          })
          if (error) throwLifecycleRpcError(error, 'USER_SUSPENSION_PROVIDER_ATTEMPT_MARK_FAILED')
          phase = 'provider_revoking'
        }
        if (phase === 'provider_revoking') {
          await disableServiceCredential({
            userId: safeTargetUserId,
            operatorUserId,
            reason: auditMetadata.reason,
            ip,
            userAgent,
            requestId,
            lifecycleMutation: true
          })
          const { error } = await supabase.rpc('admin_mark_suspension_provider_revoked', {
            p_target_user_id: safeTargetUserId,
            p_suspension_token: suspensionToken
          })
          if (error) throwLifecycleRpcError(error, 'USER_SUSPENSION_PROVIDER_MARK_FAILED')
          phase = 'provider_revoked'
        }
        if (phase !== 'provider_revoked') throw new HttpError(500, 'Invalid suspension phase', 'INVALID_SUSPENSION_PHASE')
        const { data, error } = await supabase.rpc('admin_suspend_user_atomic', {
          p_target_user_id: safeTargetUserId,
          p_operator_user_id: operatorUserId || null,
          p_suspension_token: suspensionToken
        })
        if (error) throwLifecycleRpcError(error, 'USER_SUSPENSION_FINALIZE_FAILED')
        updated = Array.isArray(data) ? data[0] : data
        updated ||= { id: targetUser.id, email: targetUser.email, status: 'suspended', suspended_at: null, suspended_reason: auditMetadata.reason }
      }
    }
  } finally {
    invalidateUserAuthzCache(safeTargetUserId)
  }

  return {
    ok: true,
    user: {
      id: updated.id,
      email: updated.email,
      status: updated.status,
      suspendedAt: updated.suspended_at || null,
      suspendedReason: updated.suspended_reason || null
    }
  }
}

export const deleteUserAccount = async ({
  operatorUserId,
  operatorRoles = [],
  targetUserId,
  reason,
  ip,
  userAgent,
  requestId
}, deps = {}) => {
  const safeTargetUserId = String(targetUserId || '').trim()
  if (!safeTargetUserId) throw new HttpError(400, 'targetUserId is required', 'INVALID_TARGET_USER')
  assertAdminTargetMutationAllowed({ operatorUserId, targetUserId: safeTargetUserId, action: 'modify' })
  if (!operatorRoles.includes('super_admin')) {
    throw new HttpError(403, 'Only super_admin can archive an account', 'FORBIDDEN_USER_ARCHIVE')
  }

  const now = new Date().toISOString()
  const archiveToken = randomUUID()
  const auditMetadata = buildArchiveAuditMetadata({ reason, ip, userAgent, requestId })

  const beforeRoles = await getUserRoleCodes(safeTargetUserId)

  const { data: targetUser, error: targetUserError } = await supabase
    .from('users')
    .select('id, email, status, deleted_at')
    .eq('id', safeTargetUserId)
    .maybeSingle()
  if (targetUserError) throw new HttpError(500, targetUserError.message, 'USER_QUERY_FAILED')
  if (!targetUser) throw new HttpError(404, 'Target user not found', 'TARGET_USER_NOT_FOUND')
  if (targetUser.deleted_at || targetUser.status === 'deleted') {
    const disableServiceCredential = deps.disableServiceCredential || disableUserServiceCredential
    await disableServiceCredential({
      userId: safeTargetUserId,
      operatorUserId,
      reason: auditMetadata.reason,
      ip,
      userAgent,
      requestId,
      lifecycleMutation: true
    })
    await finalizeUserArchiveAtomic({
      targetUserId: safeTargetUserId,
      operatorUserId,
      archivedAt: targetUser.deleted_at || now,
      archiveToken,
      auditMetadata
    })
    return { ok: true, alreadyDeleted: true }
  }

  assertRoleGrantAllowed({ operatorRoles, targetRoles: beforeRoles, nextRoles: beforeRoles })

  const { data: preparedPhase, error: prepareError } = await supabase.rpc('admin_prepare_user_archive_atomic', {
    p_target_user_id: safeTargetUserId,
    p_operator_user_id: operatorUserId || null,
    p_archive_token: archiveToken,
    p_audit_metadata: auditMetadata
  })
  if (prepareError) throwLifecycleRpcError(prepareError, 'USER_ARCHIVE_PREPARE_FAILED')

  let archivePhase = preparedPhase || 'prepared'
  if (!['prepared', 'provider_revoking', 'provider_revoked', 'projects_transferred'].includes(archivePhase)) {
    throw new HttpError(500, 'Archive preparation returned an invalid phase', 'INVALID_ARCHIVE_PHASE')
  }

  const disableServiceCredential = deps.disableServiceCredential || disableUserServiceCredential
  const transferProjects = deps.transferProjects || transferSuspendedUserTeamProjects
  let projectOwnershipTransfer = null
  let providerAttempted = archivePhase !== 'prepared'
  try {
    if (archivePhase === 'prepared') {
      const { error: markProviderAttemptError } = await supabase.rpc('admin_mark_archive_provider_revoking', {
        p_target_user_id: safeTargetUserId,
        p_operator_user_id: operatorUserId || null,
        p_archive_token: archiveToken
      })
      if (markProviderAttemptError) {
        throwLifecycleRpcError(markProviderAttemptError, 'USER_ARCHIVE_PROVIDER_ATTEMPT_MARK_FAILED')
      }
      archivePhase = 'provider_revoking'
      providerAttempted = true
    }

    if (archivePhase === 'provider_revoking') {
      await disableServiceCredential({
        userId: safeTargetUserId,
        operatorUserId,
        reason: 'account deleted',
        ip,
        userAgent,
        requestId,
        lifecycleMutation: true
      })
      const { error: markProviderError } = await supabase.rpc('admin_mark_archive_provider_revoked', {
        p_target_user_id: safeTargetUserId,
        p_operator_user_id: operatorUserId || null,
        p_archive_token: archiveToken
      })
      if (markProviderError) throwLifecycleRpcError(markProviderError, 'USER_ARCHIVE_PROVIDER_MARK_FAILED')
      archivePhase = 'provider_revoked'
    }

    if (archivePhase === 'provider_revoked') {
      projectOwnershipTransfer = await transferProjects({
        targetUserId: safeTargetUserId,
        operatorUserId,
        reason: 'account deleted'
      })
      const { error: markProjectsError } = await supabase.rpc('admin_mark_archive_projects_transferred', {
        p_target_user_id: safeTargetUserId,
        p_operator_user_id: operatorUserId || null,
        p_archive_token: archiveToken,
        p_project_transfer: projectOwnershipTransfer
      })
      if (markProjectsError) throwLifecycleRpcError(markProjectsError, 'USER_ARCHIVE_PROJECTS_MARK_FAILED')
      archivePhase = 'projects_transferred'
    }

    await finalizeUserArchiveAtomic({
      targetUserId: safeTargetUserId,
      operatorUserId,
      archivedAt: now,
      archiveToken,
      auditMetadata
    })
  } catch (error) {
    if (error?.providerRevoked) providerAttempted = true
    if (!providerAttempted) {
      const { error: abortError } = await supabase.rpc('admin_abort_user_archive_atomic', {
        p_target_user_id: safeTargetUserId,
        p_operator_user_id: operatorUserId || null,
        p_archive_token: archiveToken
      })
      if (abortError) error.archiveAbortError = abortError
    }
    throw error
  }

  return { ok: true }
}

export const restoreUserAccount = async ({ operatorUserId, operatorRoles = [], targetUserId, reason, ip, userAgent, requestId }) => {
  const safeTargetUserId = String(targetUserId || '').trim()
  if (!safeTargetUserId) throw new HttpError(400, 'targetUserId is required', 'INVALID_TARGET_USER')
  assertAdminTargetMutationAllowed({ operatorUserId, targetUserId: safeTargetUserId, action: 'restore' })
  if (!operatorRoles.includes('super_admin')) {
    throw new HttpError(403, 'Only super_admin can restore an account', 'FORBIDDEN_USER_RESTORE')
  }
  const restoreToken = randomUUID()
  const auditMetadata = sanitizeAdminAuditContext({ reason, ip, userAgent, requestId })
  let restored
  try {
    const { data, error } = await supabase.rpc('admin_restore_user_atomic', {
      p_target_user_id: safeTargetUserId,
      p_operator_user_id: operatorUserId || null,
      p_restore_token: restoreToken,
      p_audit_metadata: auditMetadata
    })
    if (error) throwLifecycleRpcError(error, 'USER_RESTORE_FAILED')
    restored = Array.isArray(data) ? data[0] : data
    if (!restored) throw new HttpError(500, 'Restore RPC returned no user', 'USER_RESTORE_FAILED')
  } finally {
    invalidateUserAuthzCache(safeTargetUserId)
  }
  return {
    ok: true,
    alreadyRestored: Boolean(restored.already_restored),
    user: {
      id: restored.id, email: restored.email, status: restored.status,
      suspendedAt: restored.suspended_at, suspendedReason: restored.suspended_reason,
      deletedAt: restored.deleted_at
    }
  }
}
