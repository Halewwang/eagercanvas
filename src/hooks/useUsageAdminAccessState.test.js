import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { test } from 'node:test'

const hookUrl = new URL('./useUsageAdminAccessState.js', import.meta.url)
const vueUrl = import.meta.resolve('vue')
const apiStubSource = [
  'export const clearUsageAdminToken = () => { throw new Error("clearToken must be injected") }',
  'export const setUsageAdminToken = () => { throw new Error("setToken must be injected") }',
  'export const usageAdminLogin = () => { throw new Error("loginRequest must be injected") }',
  'export const usageAdminSession = () => { throw new Error("sessionRequest must be injected") }'
].join('\n')
const constantsStubSource = 'export const STORAGE_KEYS = { USAGE_ADMIN_TOKEN: "usageAdminToken" }'
const utilsStubSource = [
  'export const getErrorMessage = (error, fallback) => error && error.message ? `${fallback}: ${error.message}` : fallback',
  'export const getStoredValue = () => { throw new Error("hasToken must be injected") }'
].join('\n')
const apiStubUrl = `data:text/javascript;base64,${Buffer.from(apiStubSource).toString('base64')}`
const constantsStubUrl = `data:text/javascript;base64,${Buffer.from(constantsStubSource).toString('base64')}`
const utilsStubUrl = `data:text/javascript;base64,${Buffer.from(utilsStubSource).toString('base64')}`

const loadHookModule = async () => {
  if (!existsSync(hookUrl)) return {}
  const hookSource = readFileSync(hookUrl, 'utf8')
    .replace("from 'vue'", `from '${vueUrl}'`)
    .replace("from '@/api/usageAdmin'", `from '${apiStubUrl}'`)
    .replace("from '@/utils/constants'", `from '${constantsStubUrl}'`)
    .replace("from '@/utils'", `from '${utilsStubUrl}'`)
  return import(`data:text/javascript;base64,${Buffer.from(hookSource).toString('base64')}`)
}

const accessState = await loadHookModule()

const createMessageApi = () => {
  const calls = []
  return {
    calls,
    error: (message) => calls.push(['error', message]),
    success: (message) => calls.push(['success', message]),
    warning: (message) => calls.push(['warning', message])
  }
}

test('usage admin access state logs in, stores token, loads session, and refreshes data', async () => {
  assert.equal(typeof accessState.useUsageAdminAccessState, 'function')

  const messageApi = createMessageApi()
  const events = []
  let resolveLogin
  const state = accessState.useUsageAdminAccessState({
    getMessageApi: () => messageApi,
    loadAll: async () => { events.push(['loadAll']) },
    loginRequest: async (payload) => {
      events.push(['login', payload])
      return new Promise((resolve) => { resolveLogin = resolve })
    },
    sessionRequest: async () => {
      events.push(['session'])
      return { admin: { username: 'usage-admin' } }
    },
    setToken: (token) => { events.push(['setToken', token]) }
  })

  state.updateLoginFormField('username', 'ops')
  state.updateLoginFormField('password', 'secret')
  const loginPromise = state.handleLogin()

  assert.equal(state.loggingIn.value, true)
  resolveLogin({ token: 'token-a' })
  await loginPromise

  assert.equal(state.loggingIn.value, false)
  assert.deepEqual(state.adminSession.value, { admin: { username: 'usage-admin' } })
  assert.equal(state.isAdminAuthenticated.value, true)
  assert.deepEqual(events, [
    ['login', { username: 'ops', password: 'secret' }],
    ['setToken', 'token-a'],
    ['session'],
    ['loadAll']
  ])
  assert.deepEqual(messageApi.calls, [['success', 'Admin login success']])
})

test('usage admin access state restores token sessions and clears invalid sessions', async () => {
  assert.equal(typeof accessState.useUsageAdminAccessState, 'function')

  const restoredEvents = []
  const restored = accessState.useUsageAdminAccessState({
    hasToken: () => true,
    loadAll: async () => { restoredEvents.push(['loadAll']) },
    sessionRequest: async () => {
      restoredEvents.push(['session'])
      return { admin: { username: 'restored-admin' } }
    }
  })
  await restored.restoreSession()

  assert.deepEqual(restored.adminSession.value, { admin: { username: 'restored-admin' } })
  assert.equal(restored.isAdminAuthenticated.value, true)
  assert.deepEqual(restoredEvents, [['session'], ['loadAll']])

  const failedEvents = []
  const failed = accessState.useUsageAdminAccessState({
    clearToken: () => { failedEvents.push(['clearToken']) },
    hasToken: () => true,
    loadAll: async () => { failedEvents.push(['loadAll']) },
    sessionRequest: async () => { throw new Error('expired') }
  })
  await failed.restoreSession()

  assert.equal(failed.adminSession.value, null)
  assert.equal(failed.isAdminAuthenticated.value, false)
  assert.deepEqual(failedEvents, [['clearToken']])
})
