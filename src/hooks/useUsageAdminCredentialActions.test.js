import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { test } from 'node:test'

const hookUrl = new URL('./useUsageAdminCredentialActions.js', import.meta.url)
const credentialCoreUrl = new URL('./adminServiceCredentialCore.js', import.meta.url)
const vueUrl = import.meta.resolve('vue')
const apiStubSource = [
  'export const assignUsageAdminUserKey = () => { throw new Error("assignKeyRequest must be injected") }',
  'export const createUsageAdminApiKey = () => { throw new Error("createKeyRequest must be injected") }',
  'export const deleteUsageAdminApiKey = () => { throw new Error("deleteKeyRequest must be injected") }',
  'export const unassignUsageAdminUserKey = () => { throw new Error("unassignKeyRequest must be injected") }'
].join('\n')
const utilsStubSource = [
  'export const getErrorMessage = (error, fallback) => error && error.message ? `${fallback}: ${error.message}` : fallback'
].join('\n')
const apiStubUrl = `data:text/javascript;base64,${Buffer.from(apiStubSource).toString('base64')}`
const utilsStubUrl = `data:text/javascript;base64,${Buffer.from(utilsStubSource).toString('base64')}`

const loadHookModule = async () => {
  if (!existsSync(hookUrl)) return {}
  const hookSource = readFileSync(hookUrl, 'utf8')
    .replace("from 'vue'", `from '${vueUrl}'`)
    .replace("from './adminServiceCredentialCore.js'", `from '${credentialCoreUrl.href}'`)
    .replace("from '@/api/usageAdmin'", `from '${apiStubUrl}'`)
    .replace("from '@/utils'", `from '${utilsStubUrl}'`)
  return import(`data:text/javascript;base64,${Buffer.from(hookSource).toString('base64')}`)
}

const actionsHookSource = existsSync(hookUrl) ? readFileSync(hookUrl, 'utf8') : ''
const credentialActions = await loadHookModule()

const createMessageApi = () => {
  const calls = []
  return {
    calls,
    error: (message) => calls.push(['error', message]),
    success: (message) => calls.push(['success', message]),
    warning: (message) => calls.push(['warning', message])
  }
}

test('usage admin credential actions create a trimmed service credential and refresh data', async () => {
  assert.equal(typeof credentialActions.useUsageAdminCredentialActions, 'function')

  const messageApi = createMessageApi()
  const createdPayloads = []
  const loadCalls = []
  let resolveCreate
  const state = credentialActions.useUsageAdminCredentialActions({
    createKeyRequest: async (payload) => {
      createdPayloads.push(payload)
      return new Promise((resolve) => { resolveCreate = resolve })
    },
    getMessageApi: () => messageApi,
    loadAll: async () => { loadCalls.push('loadAll') }
  })

  state.updateCreateFormField('api_name', ' svc-a ')
  state.updateCreateFormField('limit_cost', 25)
  const createPromise = state.createApiKey()

  assert.equal(state.creatingKey.value, true)
  assert.deepEqual(createdPayloads, [{
    api_name: 'svc-a',
    allow_save_logs: false,
    allow_custom_model: false,
    allow_manage_key: false,
    limit_cost: 25,
    limit_daily_cost: 0,
    expired_on: 0
  }])

  resolveCreate({})
  await createPromise

  assert.equal(state.creatingKey.value, false)
  assert.equal(state.createForm.value.api_name, '')
  assert.equal(state.createForm.value.limit_cost, 25)
  assert.deepEqual(loadCalls, ['loadAll'])
  assert.deepEqual(messageApi.calls, [['success', 'Service credential created']])
})

test('usage admin credential actions delegates service credential defaults to shared core', () => {
  assert.match(actionsHookSource, /adminServiceCredentialCore/)
  assert.doesNotMatch(actionsHookSource, /const createDefaultForm/)
})

test('usage admin credential actions preserve assignment, delete, and unassign flows', async () => {
  assert.equal(typeof credentialActions.useUsageAdminCredentialActions, 'function')

  const messageApi = createMessageApi()
  const assignCalls = []
  const deleteCalls = []
  const unassignCalls = []
  const loadCalls = []
  const state = credentialActions.useUsageAdminCredentialActions({
    assignKeyRequest: async (userId, apiName) => { assignCalls.push([userId, apiName]) },
    deleteKeyRequest: async (apiName) => { deleteCalls.push(apiName) },
    getMessageApi: () => messageApi,
    loadAll: async () => { loadCalls.push('loadAll') },
    unassignKeyRequest: async (userId, apiName) => { unassignCalls.push([userId, apiName]) }
  })

  await state.assignKeyFromRow('svc-a')
  state.updateAssignmentSelection('svc-a', 'user-a')
  await state.assignKeyFromRow('svc-a')
  await state.deleteApiKey('')
  await state.deleteApiKey('svc-a')
  await state.unassignKey('user-a', 'svc-a')

  assert.deepEqual(assignCalls, [['user-a', 'svc-a']])
  assert.deepEqual(deleteCalls, ['svc-a'])
  assert.deepEqual(unassignCalls, [['user-a', 'svc-a']])
  assert.deepEqual(loadCalls, ['loadAll', 'loadAll', 'loadAll'])
  assert.deepEqual(messageApi.calls, [
    ['warning', 'Select user first'],
    ['success', 'Assigned'],
    ['success', 'Service credential deleted'],
    ['success', 'Unassigned']
  ])
})
