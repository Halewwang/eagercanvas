import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const source = readFileSync(new URL('./admin-usage.service.js', import.meta.url), 'utf8')

test('admin usage service delegates pure user usage view aggregation to admin-usage-view', () => {
  assert.match(source, /from '\.\/admin-usage-view\.js'/)
  assert.doesNotMatch(source, /export const buildAdminUserUsageView =/)
  assert.doesNotMatch(source, /const readKeyCost =/)
  assert.doesNotMatch(source, /formatServiceCredentialForAdmin/)
})

test('admin usage service delegates admin operation log IO to admin-operation-logs', () => {
  assert.match(source, /from '\.\/admin-operation-logs\.js'/)
  assert.doesNotMatch(source, /const createAdminLog =/)
  assert.doesNotMatch(source, /export const listAdminOperationLogs =/)
  assert.doesNotMatch(source, /admin_operation_logs/)
  assert.doesNotMatch(source, /ADMIN_AUDIT_QUERY_FAILED/)
})

test('admin usage service delegates usage metric queries to admin-usage-metrics', () => {
  assert.match(source, /from '\.\/admin-usage-metrics\.js'/)
  assert.doesNotMatch(source, /export const getAdminUsageSummary =/)
  assert.doesNotMatch(source, /export const getAdminUsageTimeseries =/)
  assert.doesNotMatch(source, /select\('user_id,input_tokens,output_tokens,image_count,video_seconds,cost_amount,official_created_at'\)/)
  assert.doesNotMatch(source, /usage_daily_agg/)
  assert.doesNotMatch(source, /const toIsoDateStart =/)
  assert.doesNotMatch(source, /ADMIN_USAGE_SUMMARY_FAILED/)
  assert.doesNotMatch(source, /ADMIN_USAGE_SERIES_FAILED/)
})

test('admin usage service delegates api key assignment workflows to admin-api-key-assignments', () => {
  assert.match(source, /from '\.\/admin-api-key-assignments\.js'/)
  assert.doesNotMatch(source, /export const getUserAssignedApiKeys =/)
  assert.doesNotMatch(source, /export const resolveUserProviderAccess =/)
  assert.doesNotMatch(source, /export const assignApiKeyToUser =/)
  assert.doesNotMatch(source, /export const unassignApiKeyFromUser =/)
  assert.doesNotMatch(source, /export const removeApiKeyAssignments =/)
  assert.doesNotMatch(source, /const ASSIGNMENT_TABLE =/)
  assert.doesNotMatch(source, /API_KEY_INVENTORY_UNAVAILABLE/)
  assert.doesNotMatch(source, /ASSIGNMENT_TABLE_MISSING/)
})

test('admin usage service delegates user management workflows to admin-user-management', () => {
  assert.match(source, /from '\.\/admin-user-management\.js'/)
  assert.doesNotMatch(source, /export const updateUserRoles =/)
  assert.doesNotMatch(source, /export const updateUserStatus =/)
  assert.doesNotMatch(source, /export const deleteUserAccount =/)
  assert.doesNotMatch(source, /const getRoleCodeMap =/)
  assert.doesNotMatch(source, /const getUserRoleCodes =/)
  assert.doesNotMatch(source, /FORBIDDEN_SUPER_ADMIN_EDIT/)
  assert.doesNotMatch(source, /USER_STATUS_UPDATE_FAILED/)
  assert.doesNotMatch(source, /USER_DELETE_FAILED/)
})

test('admin usage service delegates admin users list assembly to admin-users-list', () => {
  assert.match(source, /from '\.\/admin-users-list\.js'/)
  assert.doesNotMatch(source, /export const listUsersForAdmin =/)
  assert.doesNotMatch(source, /const loadRolesMap =/)
  assert.doesNotMatch(source, /provider_billing_records/)
  assert.doesNotMatch(source, /user_service_credentials/)
  assert.doesNotMatch(source, /BILLING_RECORDS_QUERY_FAILED/)
  assert.doesNotMatch(source, /SERVICE_CREDENTIALS_QUERY_FAILED/)
})
