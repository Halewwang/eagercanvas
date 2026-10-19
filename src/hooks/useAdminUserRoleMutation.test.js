import assert from 'node:assert/strict'
import test from 'node:test'
import { ref } from 'vue'

const mutationModule = await import('./adminUserRoleMutationCore.js').catch(() => ({}))

const deferred = () => {
  let resolve
  const promise = new Promise((resolvePromise) => { resolve = resolvePromise })
  return { promise, resolve }
}

const createState = (dependencies) => {
  assert.equal(typeof mutationModule.createAdminUserRoleMutationState, 'function')
  if (typeof mutationModule.createAdminUserRoleMutationState !== 'function') return null
  return mutationModule.createAdminUserRoleMutationState(dependencies)
}

test('role mutation rejects permission and mobile calls before invoking the API, then allows desktop once', async () => {
  const canMutateRoles = ref(false)
  const canUseDesktopActions = ref(false)
  const calls = []
  const state = createState({
    canMutateRoles,
    canUseDesktopActions,
    selectedRoles: ref(['admin', 'invalid']),
    targetUserId: ref('user-42'),
    updateRoles: async (...args) => { calls.push(args) }
  })
  if (!state) return

  assert.equal(await state.saveRoles(), false)
  canMutateRoles.value = true
  assert.equal(await state.saveRoles(), false)
  assert.equal(calls.length, 0)

  canUseDesktopActions.value = true
  assert.equal(await state.saveRoles(), true)
  assert.deepEqual(calls, [['user-42', ['admin']]])
})

test('role mutation rejects the signed-in user before invoking the API', async () => {
  const currentUserId = ref(' user-42 ')
  const calls = []
  const state = createState({
    canMutateRoles: ref(true),
    canUseDesktopActions: ref(true),
    currentUserId,
    selectedRoles: ref(['admin']),
    targetUserId: ref('user-42'),
    updateRoles: async (...args) => { calls.push(args) }
  })
  if (!state) return

  assert.equal(await state.saveRoles(), false)
  assert.deepEqual(calls, [])

  currentUserId.value = 'operator-7'
  assert.equal(await state.saveRoles(), true)
  assert.deepEqual(calls, [['user-42', ['admin']]])
})

test('role mutation rejects concurrent saves while busy and refreshes once after success', async () => {
  const request = deferred()
  let calls = 0
  let refreshes = 0
  const state = createState({
    canMutateRoles: ref(true),
    canUseDesktopActions: ref(true),
    selectedRoles: ref(['ops']),
    targetUserId: ref('user-42'),
    updateRoles: async () => { calls += 1; await request.promise },
    refreshDetail: async () => { refreshes += 1 }
  })
  if (!state) return

  const firstSave = state.saveRoles()
  assert.equal(state.savingRoles.value, true)
  assert.equal(await state.saveRoles(), false)
  assert.equal(calls, 1)
  request.resolve()
  assert.equal(await firstSave, true)
  assert.equal(refreshes, 1)
  assert.equal(state.savingRoles.value, false)
})

test('role mutation exposes failure state without leaving the action busy', async () => {
  const error = ref('')
  const state = createState({
    canMutateRoles: ref(true),
    canUseDesktopActions: ref(true),
    error,
    formatError: (cause) => cause.message,
    selectedRoles: ref(['support']),
    targetUserId: ref('user-42'),
    updateRoles: async () => { throw new Error('role update failed') }
  })
  if (!state) return

  assert.equal(await state.saveRoles(), false)
  assert.equal(error.value, 'role update failed')
  assert.equal(state.savingRoles.value, false)
})
