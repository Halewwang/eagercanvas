import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { ref } from 'vue'

const hookUrl = new URL('./useUsageAdminDisplayState.js', import.meta.url)
const adminDisplayUrl = new URL('../utils/adminDisplay.js', import.meta.url)
const vueUrl = import.meta.resolve('vue')
const hookSource = readFileSync(hookUrl, 'utf8')
  .replace("from 'vue'", `from '${vueUrl}'`)
  .replace("from '@/utils/adminDisplay'", `from '${adminDisplayUrl.href}'`)
const usageAdminDisplayState = await import(`data:text/javascript;base64,${Buffer.from(hookSource).toString('base64')}`)

test('usage admin display state derives sidebar, session, and overview display data', () => {
  assert.equal(typeof usageAdminDisplayState.useUsageAdminDisplayState, 'function')

  const state = usageAdminDisplayState.useUsageAdminDisplayState({
    adminSession: ref({ admin: { username: 'ops-admin' } }),
    apiKeys: ref([{ api_name: 'svc-a' }, { api_name: 'svc-b' }]),
    balance: ref('12.50'),
    isAdminAuthenticated: ref(true),
    users: ref([
      { id: 'user-a', assignedApiKeys: [{ apiName: 'svc-a' }] },
      { id: 'user-b', assignedApiKeys: [] }
    ])
  })

  assert.deepEqual(state.sidebarNavItems.value, [
    { label: 'Overview', value: 'Live', href: '#overview', active: true },
    { label: '服务凭证', value: 2, href: '#keys', active: false },
    { label: 'Users', value: 2, href: '#users', active: false }
  ])
  assert.deepEqual(state.sidebarSessionSummary.value, {
    username: 'ops-admin',
    status: 'Usage admin access'
  })
  assert.deepEqual(state.overviewMetrics.value, [
    { label: 'Eager Service Balance', value: '$12.50' },
    { label: 'Registered Users', value: 2 },
    { label: '服务凭证', value: 2 },
    { label: 'Users With Credentials', value: 1 }
  ])
})

test('usage admin display state exposes existing formatting helpers', () => {
  assert.equal(typeof usageAdminDisplayState.useUsageAdminDisplayState, 'function')

  const state = usageAdminDisplayState.useUsageAdminDisplayState({
    adminSession: ref(null),
    apiKeys: ref([]),
    balance: ref(''),
    isAdminAuthenticated: ref(false),
    users: ref([])
  })

  assert.equal(state.formatDateTime('not-a-date'), '-')
  assert.equal(state.formatExpire(0), '-')
  assert.equal(state.maskApiKey('sk-abcdefghijklmnopqrstuvwxyz'), 'sk-abc...wxyz')
})
