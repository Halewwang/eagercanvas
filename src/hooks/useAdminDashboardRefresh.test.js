import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { ref } from 'vue'

const hookUrl = new URL('./useAdminDashboardRefresh.js', import.meta.url)
const vueUrl = import.meta.resolve('vue')

const loadHook = async (localPreviewExpression = 'false') => {
  const hookSource = readFileSync(hookUrl, 'utf8')
    .replace("from 'vue'", `from '${vueUrl}'`)
    .replace("import.meta.env.DEV && import.meta.env.VITE_BYPASS_AUTH === 'true'", localPreviewExpression)
  return import(`data:text/javascript;base64,${Buffer.from(hookSource).toString('base64')}`)
}

const { useAdminDashboardRefresh } = await loadHook()

const createDeps = (overrides = {}) => ({
  auth: { loadAdminSession: async () => true },
  canReadAudit: ref(true),
  canReadIssues: ref(true),
  canReadUsage: ref(true),
  canReadUsers: ref(true),
  loading302: ref(false),
  loadingIssues: ref(false),
  loadingLogs: ref(false),
  loadingOverview: ref(false),
  loadingUsers: ref(false),
  load302All: async () => {},
  loadIssues: async () => {},
  loadLogs: async () => {},
  loadUsage: async () => {},
  loadUsers: async () => {},
  router: { replace: () => {} },
  showServiceSection: ref(true),
  ...overrides
})

test('admin dashboard refresh runs the existing visible data loaders after session validation', async () => {
  const calls = []
  const deps = createDeps({
    auth: {
      loadAdminSession: async (options) => {
        calls.push(['auth', options])
        return true
      }
    },
    loading302: ref(true),
    load302All: async () => calls.push('service'),
    loadIssues: async () => calls.push('issues'),
    loadLogs: async () => calls.push('audit'),
    loadUsage: async () => calls.push('usage'),
    loadUsers: async () => calls.push('users')
  })

  const { isRefreshing, loadAll } = useAdminDashboardRefresh(deps)

  assert.equal(isRefreshing.value, true)
  await loadAll()

  assert.deepEqual(calls, [
    ['auth', { force: true }],
    'usage',
    'users',
    'service',
    'audit',
    'issues'
  ])
})

test('admin dashboard refresh redirects and skips data loaders when the admin session is denied', async () => {
  const calls = []
  const deps = createDeps({
    auth: { loadAdminSession: async () => false },
    load302All: async () => calls.push('service'),
    loadIssues: async () => calls.push('issues'),
    loadLogs: async () => calls.push('audit'),
    loadUsage: async () => calls.push('usage'),
    loadUsers: async () => calls.push('users'),
    router: { replace: (path) => calls.push(['redirect', path]) }
  })

  const { isRefreshing, loadAll } = useAdminDashboardRefresh(deps)

  assert.equal(isRefreshing.value, false)
  await loadAll()

  assert.deepEqual(calls, [['redirect', '/']])
})

test('admin dashboard refresh keeps the shell in local preview when admin session is unavailable', async () => {
  const { useAdminDashboardRefresh: useLocalPreviewRefresh } = await loadHook('true')
  const calls = []
  const deps = createDeps({
    auth: { loadAdminSession: async () => false },
    load302All: async () => calls.push('service'),
    loadIssues: async () => calls.push('issues'),
    loadLogs: async () => calls.push('audit'),
    loadUsage: async () => calls.push('usage'),
    loadUsers: async () => calls.push('users'),
    router: { replace: (path) => calls.push(['redirect', path]) }
  })

  const { loadAll } = useLocalPreviewRefresh(deps)

  await loadAll()

  assert.deepEqual(calls, [])
})
