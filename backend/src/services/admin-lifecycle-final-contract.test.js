import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const migration = readFileSync(new URL('../../../supabase/016_admin_rbac_lifecycle.sql', import.meta.url), 'utf8')
const management = readFileSync(new URL('./admin-user-management.js', import.meta.url), 'utf8')
const auth = readFileSync(new URL('./auth.service.js', import.meta.url), 'utf8')
const authMiddleware = readFileSync(new URL('../middleware/auth.js', import.meta.url), 'utf8')
const recovery = readFileSync(new URL('../../../docs/ADMIN_LIFECYCLE_RECOVERY.md', import.meta.url), 'utf8')

test('migration converges the exact high-risk permission matrix', () => {
  assert.match(migration, /delete from public\.role_permissions[\s\S]+admin\.user\.delete[\s\S]+admin\.user\.restore[\s\S]+admin\.api_key\.read[\s\S]+admin\.access\.read/i)
  for (const pair of [
    "('admin.user.delete', 'super_admin')",
    "('admin.user.restore', 'super_admin')",
    "('admin.api_key.read', 'super_admin')",
    "('admin.api_key.read', 'admin')",
    "('admin.api_key.read', 'ops')",
    "('admin.access.read', 'super_admin')",
    "('admin.access.read', 'admin')"
  ]) assert.ok(migration.includes(pair))
})

test('role and activation RPCs atomically persist sanitized audit and clear lifecycle epochs', () => {
  const roles = migration.slice(migration.indexOf('create or replace function public.admin_replace_user_roles_atomic'), migration.indexOf('create or replace function public.admin_update_user_status_atomic'))
  const status = migration.slice(migration.indexOf('create or replace function public.admin_update_user_status_atomic'), migration.indexOf('create or replace function public.admin_begin_service_mutation'))
  assert.match(roles, /p_operation_token uuid/)
  assert.match(roles, /p_audit_metadata jsonb/)
  assert.match(roles, /insert into public\.admin_operation_logs/)
  assert.match(roles, /on conflict \(action, operation_token\)/)
  assert.match(status, /insert into public\.admin_operation_logs/)
  assert.match(status, /restore_event_id = null/)
  assert.match(status, /suspension_event_id = null/)
  assert.doesNotMatch(management.slice(management.indexOf('export const updateUserRoles'), management.indexOf('export const updateUserStatus')), /createAdminLog/)
})

test('suspension is a fenced resumable saga and transient accounts cannot authenticate', () => {
  for (const column of ['suspension_previous_status', 'suspension_started_at', 'suspension_token', 'suspension_phase', 'suspension_event_id', 'suspension_operator_user_id', 'suspension_audit_metadata', 'suspension_project_transfer']) {
    assert.match(migration, new RegExp(`${column}\\s`))
  }
  for (const fn of ['admin_prepare_user_suspension_atomic', 'admin_mark_suspension_projects_transferred', 'admin_mark_suspension_provider_revoking', 'admin_mark_suspension_provider_revoked', 'admin_suspend_user_atomic']) {
    assert.match(migration, new RegExp(`create or replace function public\\.${fn}`))
  }
  assert.match(management, /lifecycleMutation:\s*true/)
  assert.match(auth, /status === 'suspending'/)
  assert.match(authMiddleware, /status === 'suspending'/)
  assert.match(recovery, /abort_pre_provider_suspension/)
  assert.match(recovery, /resume[\s\S]+suspension/i)
})

test('restore idempotency marker is cleared by the next lifecycle transition', () => {
  assert.match(migration, /restore_event_id = null[\s\S]+restore_operator_user_id = null[\s\S]+restore_audit_metadata = null/)
  assert.match(migration, /v_is_already_restored := v_target_status = 'suspended'[\s\S]+v_existing_restore_event_id is not null/)
})

test('archive reconciliation revokes legacy deleted credentials before finalization and audits resumers', () => {
  const deleteStart = management.indexOf('export const deleteUserAccount')
  const deletedBranch = management.slice(management.indexOf("if (targetUser.deleted_at || targetUser.status === 'deleted')", deleteStart), management.indexOf('assertRoleGrantAllowed', deleteStart))
  assert.match(deletedBranch, /lifecycleMutation:\s*true/)
  assert.ok(deletedBranch.indexOf('lifecycleMutation: true') < deletedBranch.indexOf('finalizeUserArchiveAtomic'))
  assert.match(migration, /admin\.user\.archive\.resume/)
  for (const action of ['admin.user.archive.resume', 'admin.user.suspension.resume']) {
    const start = migration.indexOf(`'${action}'`)
    const context = migration.slice(start, start + 900)
    assert.match(context, /'ip', coalesce\(v_safe_audit_metadata->>'ip', ''\)/)
    assert.match(context, /'userAgent', coalesce\(v_safe_audit_metadata->>'userAgent', ''\)/)
  }
})
