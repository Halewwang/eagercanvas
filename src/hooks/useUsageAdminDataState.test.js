import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { test } from 'node:test'

const hookUrl = new URL('./useUsageAdminDataState.js', import.meta.url)
const vueUrl = import.meta.resolve('vue')
const apiStubSource = [
  'export const getUsageAdminBalance = () => { throw new Error("fetchBalance must be injected") }',
  'export const getUsageAdminUsers = () => { throw new Error("fetchUsers must be injected") }',
  'export const getUsageAdminApiKeys = () => { throw new Error("fetchApiKeys must be injected") }'
].join('\n')
const apiStubUrl = `data:text/javascript;base64,${Buffer.from(apiStubSource).toString('base64')}`

const loadHookModule = async () => {
  if (!existsSync(hookUrl)) return {}
  const hookSource = readFileSync(hookUrl, 'utf8')
    .replace("from 'vue'", `from '${vueUrl}'`)
    .replace("from '@/api/usageAdmin'", `from '${apiStubUrl}'`)
  return import(`data:text/javascript;base64,${Buffer.from(hookSource).toString('base64')}`)
}

const usageAdminDataState = await loadHookModule()

test('usage admin data state loads balance, users, and api keys together', async () => {
  assert.equal(typeof usageAdminDataState.useUsageAdminDataState, 'function')

  let resolveBalance
  let resolveUsers
  let resolveApiKeys
  const calls = []
  const state = usageAdminDataState.useUsageAdminDataState({
    fetchBalance: async () => {
      calls.push('balance')
      return new Promise((resolve) => { resolveBalance = resolve })
    },
    fetchUsers: async () => {
      calls.push('users')
      return new Promise((resolve) => { resolveUsers = resolve })
    },
    fetchApiKeys: async () => {
      calls.push('apiKeys')
      return new Promise((resolve) => { resolveApiKeys = resolve })
    }
  })

  const loadPromise = state.loadAll()
  assert.equal(state.loadingAll.value, true)
  assert.deepEqual(calls, ['balance', 'users', 'apiKeys'])

  resolveBalance({ data: { balance: 13.5 } })
  resolveUsers({ data: [{ id: 'user-a' }] })
  resolveApiKeys({ data: [{ api_name: 'svc-a' }] })
  await loadPromise

  assert.equal(state.loadingAll.value, false)
  assert.equal(state.balance.value, '13.5')
  assert.deepEqual(state.users.value, [{ id: 'user-a' }])
  assert.deepEqual(state.apiKeys.value, [{ api_name: 'svc-a' }])
})

test('usage admin data state resets loading when loading fails', async () => {
  assert.equal(typeof usageAdminDataState.useUsageAdminDataState, 'function')

  const failure = new Error('upstream unavailable')
  const state = usageAdminDataState.useUsageAdminDataState({
    fetchBalance: async () => { throw failure },
    fetchUsers: async () => ({ data: [{ id: 'unused' }] }),
    fetchApiKeys: async () => ({ data: [{ api_name: 'unused' }] })
  })

  await assert.rejects(state.loadAll(), failure)
  assert.equal(state.loadingAll.value, false)
  assert.deepEqual(state.users.value, [])
  assert.deepEqual(state.apiKeys.value, [])
})
