import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const vueUrl = import.meta.resolve('vue')
const authStoreSource = readFileSync(new URL('./auth.js', import.meta.url), 'utf8')
const previewPermissions = ['admin.user.read', 'admin.user.role.update']
let harnessId = 0

const deferred = () => {
  let resolve
  let reject
  const promise = new Promise((resolvePromise, rejectPromise) => {
    resolve = resolvePromise
    reject = rejectPromise
  })
  return { promise, reject, resolve }
}

const createHarness = async ({
  storedToken = '',
  previewEnabled = true,
  previewToken = 'local-preview-browser-token',
  getMe = async () => ({ user: { id: 'real-user' } }),
  refreshSession = async () => { throw new Error('refresh unavailable') },
  getAdminSession = async () => ({
    user: { id: 'real-admin' },
    roles: ['support'],
    permissions: ['admin.user.read']
  })
} = {}) => {
  const storage = new Map(storedToken ? [['ec_access_token', storedToken]] : [])
  const calls = { adminSession: 0, getMe: 0, refresh: 0 }
  const key = `__authStoreHarness${++harnessId}`
  globalThis[key] = {
    getAdminSession: async () => {
      calls.adminSession += 1
      return getAdminSession()
    },
    getMe: async () => {
      calls.getMe += 1
      return getMe()
    },
    refreshSession: async () => {
      calls.refresh += 1
      return refreshSession()
    },
    getStoredValue: (storageKey, fallback = '') => storage.get(storageKey) || fallback,
    removeStoredValue: (storageKey) => storage.delete(storageKey),
    setStoredValue: (storageKey, value) => storage.set(storageKey, value),
    getLocalPreviewAdminSession: () => ({
      user: { id: 'preview-admin', email: 'preview-admin@local.dev' },
      roles: ['super_admin', 'ops'],
      permissions: [...previewPermissions]
    }),
    isLocalPreviewEnabled: () => previewEnabled,
    resolveLocalPreviewAccessToken: (stored = '') => String(stored || '').trim() || (previewEnabled ? previewToken : ''),
    hasAdminAccessPermission: (permissions = []) => permissions.some((code) => code.startsWith('admin.')),
    logoutSession: async () => {},
    patchProfile: async (payload) => ({ user: payload }),
    sendLoginCode: async () => {},
    sendRegisterCode: async () => {},
    verifyLoginCode: async () => ({}),
    verifyRegisterCode: async () => ({})
  }

  const source = authStoreSource
    .replace("from 'vue'", `from '${vueUrl}'`)
    .replace("import { getAdminSession } from '@/api/admin'", `const { getAdminSession } = globalThis.${key}`)
    .replace("import { STORAGE_KEYS } from '@/utils/constants'", "const STORAGE_KEYS = { ACCESS_TOKEN: 'ec_access_token' }")
    .replace(
      "import { getStoredValue, removeStoredValue, setStoredValue } from '@/utils/storage'",
      `const { getStoredValue, removeStoredValue, setStoredValue } = globalThis.${key}`
    )
    .replace(
      /import \{\n {2}getMe,[\s\S]*?\n\} from '@\/api\/auth'/,
      `const { getMe, logoutSession, patchProfile, refreshSession, sendLoginCode, sendRegisterCode, verifyLoginCode, verifyRegisterCode } = globalThis.${key}`
    )
    .replace(
      "import { getLocalPreviewAdminSession, isLocalPreviewEnabled, resolveLocalPreviewAccessToken } from '@/utils/localPreview'",
      `const { getLocalPreviewAdminSession, isLocalPreviewEnabled, resolveLocalPreviewAccessToken } = globalThis.${key}`
    )
    .replace(
      "import { hasAdminAccessPermission } from '@/utils/adminNavigation'",
      `const { hasAdminAccessPermission } = globalThis.${key}`
    )

  try {
    const module = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}#${harnessId}`)
    return { calls, storage, store: module.useAuthStore() }
  } finally {
    delete globalThis[key]
  }
}

test('stored real token suppresses preview identity and bootstraps real user plus admin session', async () => {
  const { calls, store } = await createHarness({ storedToken: 'real-token' })

  assert.equal(store.accessToken.value, 'real-token')
  assert.equal(store.bootstrapped.value, false)
  assert.equal(store.adminUser.value, null)
  assert.deepEqual(store.roles.value, [])
  assert.deepEqual(store.permissions.value, [])

  await store.bootstrapAuth()
  assert.deepEqual(store.user.value, { id: 'real-user' })
  assert.deepEqual(calls, { adminSession: 0, getMe: 1, refresh: 0 })

  await store.loadAdminSession()
  assert.deepEqual(store.adminUser.value, { id: 'real-admin' })
  assert.deepEqual(store.roles.value, ['support'])
  assert.deepEqual(store.permissions.value, ['admin.user.read'])
  assert.deepEqual(calls, { adminSession: 1, getMe: 1, refresh: 0 })
})

test('auth store never embeds a shared local preview bearer token', () => {
  assert.doesNotMatch(authStoreSource, /dev-bypass-token/)
})

test('explicit preview uses the simulated session only when no real token exists', async () => {
  const { calls, store } = await createHarness()

  assert.equal(store.accessToken.value, 'local-preview-browser-token')
  assert.equal(store.bootstrapped.value, true)
  assert.equal(store.adminUser.value.id, 'preview-admin')
  assert.deepEqual(store.roles.value, ['super_admin', 'ops'])

  await store.bootstrapAuth()
  await store.loadAdminSession()
  assert.deepEqual(calls, { adminSession: 0, getMe: 0, refresh: 0 })
})

test('invalid real token stays unprivileged until validation and refresh both fail', async () => {
  const meGate = deferred()
  const refreshGate = deferred()
  const { calls, storage, store } = await createHarness({
    storedToken: 'invalid-real-token',
    getMe: () => meGate.promise,
    refreshSession: () => refreshGate.promise
  })

  const bootstrap = store.bootstrapAuth()
  assert.deepEqual(store.roles.value, [])
  assert.deepEqual(store.permissions.value, [])

  meGate.reject(new Error('expired'))
  await new Promise(setImmediate)
  assert.equal(calls.refresh, 1)
  assert.deepEqual(store.roles.value, [])
  assert.deepEqual(store.permissions.value, [])

  refreshGate.reject(new Error('refresh expired'))
  await bootstrap
  assert.equal(storage.has('ec_access_token'), false)
  assert.equal(store.accessToken.value, 'local-preview-browser-token')
  assert.deepEqual(store.roles.value, ['super_admin', 'ops'])
  assert.deepEqual(store.permissions.value, previewPermissions)
})
