import assert from 'node:assert/strict'
import test from 'node:test'

const detailModule = await import('./useAdminUserDetailCore.js').catch(() => ({}))
const navigationModule = await import('./adminAccessNavigation.js').catch(() => ({}))

const deferred = () => {
  let resolve
  let reject
  const promise = new Promise((resolvePromise, rejectPromise) => {
    resolve = resolvePromise
    reject = rejectPromise
  })
  return { promise, reject, resolve }
}

test('admin user detail prefers an explicit embedded target and validates its initial tab', () => {
  assert.equal(typeof navigationModule.resolveAdminUserDetailTarget, 'function')
  if (typeof navigationModule.resolveAdminUserDetailTarget !== 'function') return

  assert.deepEqual(navigationModule.resolveAdminUserDetailTarget({
    targetUserId: ' focused-user ',
    routeUserId: 'route-user',
    initialTab: 'roles'
  }), { activeTab: 'roles', userId: 'focused-user' })
  assert.deepEqual(navigationModule.resolveAdminUserDetailTarget({
    targetUserId: '',
    routeUserId: ' route-user ',
    initialTab: 'invalid'
  }), { activeTab: 'summary', userId: 'route-user' })
})

test('admin user detail loader ignores stale route responses and stale finally blocks', async () => {
  assert.equal(typeof detailModule.createAdminUserDetailState, 'function')
  if (typeof detailModule.createAdminUserDetailState !== 'function') return

  const requests = new Map()
  const getRequest = (kind, userId) => {
    const key = `${kind}:${userId}`
    if (!requests.has(key)) requests.set(key, deferred())
    return requests.get(key)
  }
  const state = detailModule.createAdminUserDetailState({
    fetchUser: (userId) => getRequest('user', userId).promise,
  })

  const loadA = state.loadDetail('A')
  const loadB = state.loadDetail('B')

  getRequest('user', 'A').resolve({ data: { id: 'A', roles: ['admin'] } })
  await loadA

  assert.equal(state.user.value, null)
  assert.equal(state.loading.value, true)

  getRequest('user', 'B').resolve({ data: { id: 'B', roles: ['ops'] } })
  await loadB

  assert.equal(state.user.value.id, 'B')
  assert.deepEqual(state.selectedRoles.value, ['ops'])
  assert.equal(state.loading.value, false)
})

test('admin user detail invalidation prevents unmounted requests from mutating state', async () => {
  assert.equal(typeof detailModule.createAdminUserDetailState, 'function')
  if (typeof detailModule.createAdminUserDetailState !== 'function') return

  const request = deferred()
  const state = detailModule.createAdminUserDetailState({ fetchUser: () => request.promise })
  const loading = state.loadDetail('A')
  state.invalidate()
  request.resolve({ data: { id: 'A' } })
  await loading

  assert.equal(state.user.value, null)
  assert.equal(state.loading.value, false)
})

test('admin user detail loader clears the previous user before a different route fails', async () => {
  assert.equal(typeof detailModule.createAdminUserDetailState, 'function')
  if (typeof detailModule.createAdminUserDetailState !== 'function') return

  const requestB = deferred()
  const state = detailModule.createAdminUserDetailState({
    fetchUser: (userId) => userId === 'A'
      ? Promise.resolve({ data: { id: 'A', roles: ['admin'] } })
      : requestB.promise,
    formatError: (cause) => cause.message
  })

  await state.loadDetail('A')
  assert.equal(state.user.value.id, 'A')

  const loadB = state.loadDetail('B')
  assert.equal(state.user.value, null)
  assert.deepEqual(state.selectedRoles.value, ['user'])

  requestB.reject(new Error('B failed'))
  await loadB

  assert.equal(state.user.value, null)
  assert.equal(state.error.value, 'B failed')
})

test('admin user detail loader preserves loaded data while refreshing the same user', async () => {
  assert.equal(typeof detailModule.createAdminUserDetailState, 'function')
  if (typeof detailModule.createAdminUserDetailState !== 'function') return

  const refresh = deferred()
  let requestCount = 0
  const state = detailModule.createAdminUserDetailState({
    fetchUser: () => {
      requestCount += 1
      return requestCount === 1
        ? Promise.resolve({ data: { id: 'A', name: 'before', roles: ['admin'] } })
        : refresh.promise
    }
  })

  await state.loadDetail('A')
  const refreshing = state.loadDetail('A')

  assert.equal(state.user.value.name, 'before')
  assert.deepEqual(state.selectedRoles.value, ['admin'])

  refresh.resolve({ data: { id: 'A', name: 'after', roles: ['ops'] } })
  await refreshing

  assert.equal(state.user.value.name, 'after')
  assert.deepEqual(state.selectedRoles.value, ['ops'])
})
