import assert from 'node:assert/strict'
import test from 'node:test'
import { effectScope, nextTick, ref } from 'vue'

const focusModule = await import('./useAdminUsersAccessFocus.js').catch(() => ({}))

const createController = (dependencies) => {
  assert.equal(typeof focusModule.createAdminUsersAccessFocusController, 'function')
  if (typeof focusModule.createAdminUsersAccessFocusController !== 'function') return null
  let controller
  const scope = effectScope()
  scope.run(() => { controller = focusModule.createAdminUsersAccessFocusController(dependencies) })
  return { controller, scope }
}

test('focus controller resolves valid roles queries, skips list loading, and closes through the router', async () => {
  const routeQuery = ref({ userId: 'user-42', tab: 'roles' })
  const replacements = []
  let loads = 0
  const created = createController({
    routeQuery,
    routerReplace: (target) => replacements.push(target),
    loadUsers: async () => { loads += 1 }
  })
  if (!created) return
  const { controller, scope } = created

  assert.deepEqual(controller.accessFocus.value, {
    embedded: true,
    initialTab: 'roles',
    targetUserId: 'user-42'
  })
  await controller.loadUsersForCurrentView()
  assert.equal(loads, 0)
  await controller.closeAccessFocus()
  assert.deepEqual(replacements, [{ name: 'AdminUsers' }])
  scope.stop()
})

test('focus controller falls back for array queries and loads exactly once when focus returns to list', async () => {
  const routeQuery = ref({ userId: ['user-a', 'user-b'], tab: 'roles' })
  let loads = 0
  const created = createController({
    routeQuery,
    routerReplace: () => {},
    loadUsers: async () => { loads += 1 }
  })
  if (!created) return
  const { controller, scope } = created

  assert.equal(controller.accessFocus.value, null)
  await controller.loadUsersForCurrentView()
  assert.equal(loads, 1)

  routeQuery.value = { userId: 'user-42', tab: 'roles' }
  await nextTick()
  await controller.loadUsersForCurrentView()
  assert.equal(loads, 1)

  routeQuery.value = { userId: 'user-42', tab: 'summary' }
  await nextTick()
  assert.equal(controller.accessFocus.value, null)
  assert.equal(loads, 2)
  scope.stop()
})
