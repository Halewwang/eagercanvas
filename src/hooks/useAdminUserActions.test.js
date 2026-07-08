import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import test from 'node:test'

const actionsCore = await import('./useAdminUserActionsCore.js').catch(() => ({}))
const actionsHookUrl = new URL('./useAdminUserActions.js', import.meta.url)
const actionsHookSource = existsSync(actionsHookUrl) ? readFileSync(actionsHookUrl, 'utf8') : ''
const adminApiUrl = new URL('../api/admin.js', import.meta.url)
const adminApiSource = existsSync(adminApiUrl) ? readFileSync(adminApiUrl, 'utf8') : ''

test('admin service limit payload preserves nonnegative numeric limits and expiry', () => {
  assert.equal(typeof actionsCore.getAdminServiceLimitPayload, 'function')

  assert.deepEqual(
    actionsCore.getAdminServiceLimitPayload({
      service: { expiredOn: 123456 }
    }, '10.5', '0'),
    {
      ok: true,
      payload: {
        limitCost: 10.5,
        limitDailyCost: 0,
        expiredOn: 123456
      }
    }
  )
})

test('admin service limit payload rejects invalid and negative values', () => {
  assert.equal(typeof actionsCore.getAdminServiceLimitPayload, 'function')

  assert.deepEqual(actionsCore.getAdminServiceLimitPayload({}, 'abc', '1'), {
    ok: false,
    message: '额度必须是非负数字'
  })
  assert.deepEqual(actionsCore.getAdminServiceLimitPayload({}, '1', '-1'), {
    ok: false,
    message: '额度必须是非负数字'
  })
})

test('admin user action core owns loading map updates and selected role lookup', () => {
  assert.equal(typeof actionsCore.setAdminActionLoading, 'function')
  assert.equal(typeof actionsCore.getAdminSelectedRole, 'function')

  const loading = { value: { existing: true } }

  assert.equal(actionsCore.setAdminActionLoading(loading, 'user-a', true), true)
  assert.deepEqual(loading.value, { existing: true, 'user-a': true })

  assert.equal(actionsCore.setAdminActionLoading(loading, '', false), false)
  assert.deepEqual(loading.value, { existing: true, 'user-a': true })

  assert.equal(actionsCore.getAdminSelectedRole({ value: { 'user-a': ' admin ' } }, { id: 'user-a' }), 'admin')
  assert.equal(actionsCore.getAdminSelectedRole({ value: {} }, { id: 'user-a' }), '')
})

test('admin user action core owns confirmation and success copy', () => {
  assert.equal(typeof actionsCore.getAdminDeleteUserConfirmMessage, 'function')
  assert.equal(typeof actionsCore.getAdminResetServiceConfirmMessage, 'function')
  assert.equal(typeof actionsCore.getAdminReconcileBillingSuccessMessage, 'function')

  assert.equal(
    actionsCore.getAdminDeleteUserConfirmMessage({ email: 'member@example.test' }),
    '确认删除用户 member@example.test 吗？删除后将禁用该账号访问。'
  )
  assert.equal(
    actionsCore.getAdminResetServiceConfirmMessage({ email: 'member@example.test' }),
    '确认重置 member@example.test 的服务凭证吗？历史消耗记录会保留。'
  )
  assert.equal(
    actionsCore.getAdminReconcileBillingSuccessMessage({ matched: 2, unmatched: 1 }),
    '同步完成：2 条已匹配，1 条未匹配'
  )
  assert.equal(
    actionsCore.getAdminReconcileBillingSuccessMessage(null),
    '同步完成：0 条已匹配，0 条未匹配'
  )
})

test('admin user action core owns prompt copy for user and service actions', () => {
  assert.equal(typeof actionsCore.getAdminSuspendUserPromptMessage, 'function')
  assert.equal(typeof actionsCore.getAdminDisableServicePromptMessage, 'function')
  assert.equal(typeof actionsCore.getAdminLimitCostPromptMessage, 'function')
  assert.equal(typeof actionsCore.getAdminLimitDailyCostPromptMessage, 'function')
  assert.equal(typeof actionsCore.getAdminManualServiceApiNamePromptMessage, 'function')
  assert.equal(typeof actionsCore.getAdminManualServiceApiKeyPromptMessage, 'function')

  assert.equal(actionsCore.getAdminSuspendUserPromptMessage(), '请输入暂停原因（可选）：')
  assert.equal(actionsCore.getAdminDisableServicePromptMessage(), '请输入停用原因（可选）：')
  assert.equal(actionsCore.getAdminLimitCostPromptMessage(), '请输入总额度（USD，0 表示不限制）：')
  assert.equal(actionsCore.getAdminLimitDailyCostPromptMessage(), '请输入日额度（USD，0 表示不限制）：')
  assert.equal(actionsCore.getAdminManualServiceApiNamePromptMessage(), '请输入服务商 API Key 名称（api_name）：')
  assert.equal(actionsCore.getAdminManualServiceApiKeyPromptMessage(), '请输入完整服务商 API Key：')
})

test('admin manual service payload requires key identity and secret', () => {
  assert.equal(typeof actionsCore.getAdminManualServiceCredentialPayload, 'function')

  assert.deepEqual(
    actionsCore.getAdminManualServiceCredentialPayload(
      { service: { limitCost: 12, limitDailyCost: 2, expiredOn: 345 } },
      ' manual-api ',
      ' sk-test '
    ),
    {
      ok: true,
      payload: {
        apiName: 'manual-api',
        apiKey: 'sk-test',
        limitCost: 12,
        limitDailyCost: 2,
        expiredOn: 345,
        replaceExisting: true
      }
    }
  )

  assert.deepEqual(actionsCore.getAdminManualServiceCredentialPayload({}, '', 'sk-test'), {
    ok: false,
    message: '请输入服务商 API Key 名称'
  })
  assert.deepEqual(actionsCore.getAdminManualServiceCredentialPayload({}, 'manual-api', ''), {
    ok: false,
    message: '请输入完整服务商 API Key'
  })
})

test('admin user action core owns refresh orchestration helpers', async () => {
  assert.equal(typeof actionsCore.runAdminUsersAndLogsRefresh, 'function')
  assert.equal(typeof actionsCore.runAdminBillingRefresh, 'function')

  const calls = []
  const deps = {
    loadLogs: async () => { calls.push('logs') },
    loadUsage: async () => { calls.push('usage') },
    loadUsers: async () => { calls.push('users') }
  }

  await actionsCore.runAdminUsersAndLogsRefresh(deps)
  await actionsCore.runAdminBillingRefresh(deps)

  assert.deepEqual(calls, ['users', 'logs', 'users', 'usage', 'logs'])
})

test('admin user actions composable owns mutation api calls and loading state', () => {
  assert.match(actionsHookSource, /export const useAdminUserActions/)
  assert.match(actionsHookSource, /updateAdminUserRoles/)
  assert.match(actionsHookSource, /updateAdminUserStatus/)
  assert.match(actionsHookSource, /deleteAdminUser/)
  assert.match(actionsHookSource, /activateAdminUserService/)
  assert.match(actionsHookSource, /bindManualAdminUserService/)
  assert.match(actionsHookSource, /reconcileAdminBilling/)
  assert.match(actionsHookSource, /const saving = ref\(\{\}\)/)
  assert.match(actionsHookSource, /const serviceLoading = ref\(\{\}\)/)
  assert.match(actionsHookSource, /const manualServiceDialogVisible = ref\(false\)/)
  assert.match(actionsHookSource, /const manualServiceUser = ref\(null\)/)
  assert.match(actionsHookSource, /const openManualServiceDialog = \(user\) =>/)
  assert.match(actionsHookSource, /const submitManualServiceBinding = async/)
  assert.match(actionsHookSource, /const reconcileBilling = async/)
  assert.match(actionsHookSource, /setAdminActionLoading/)
  assert.match(actionsHookSource, /getAdminManualServiceCredentialPayload/)
  assert.match(actionsHookSource, /getAdminReconcileBillingSuccessMessage/)
  assert.match(actionsHookSource, /runAdminUsersAndLogsRefresh/)
  assert.match(actionsHookSource, /getAdminSuspendUserPromptMessage/)
  assert.doesNotMatch(actionsHookSource, /getAdminManualServiceApiNamePromptMessage/)
  assert.doesNotMatch(actionsHookSource, /getAdminManualServiceApiKeyPromptMessage/)
  assert.doesNotMatch(actionsHookSource, /windowTarget\?\.prompt\?\.\(getAdminManualService/)
})

test('admin api exposes administrator-only manual service key binding endpoint', () => {
  assert.match(adminApiSource, /export const bindManualAdminUserService/)
  assert.match(adminApiSource, /service-access\/manual/)
  assert.match(adminApiSource, /method: 'post'/)
})
