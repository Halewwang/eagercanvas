import assert from 'node:assert/strict'
import test from 'node:test'
import { createMemoryHistory, createRouter } from 'vue-router'
import { createAdminRouteRecords, createNavigationGuard } from './adminRouter.js'
const { resolveAdminRouteAccess } = await import(new URL('../utils/adminNavigation.js', import.meta.url))

const createHarness = ({ authenticated = true, permissions = ['admin.user.read'] } = {}) => {
  let loaded = 0
  const component = { render: () => null }
  const router = createRouter({ history: createMemoryHistory(), routes: [
    { path: '/', name: 'Home', component },
    ...createAdminRouteRecords({
      loadAdminLayout: async () => component,
      loadAdminUsers: async () => { loaded += 1; return component },
      loadAdminUserDetail: async () => component
    })
  ] })
  router.beforeEach(createNavigationGuard({
    getAuthStore: () => ({
      isAuthenticated: { value: authenticated }, permissions: { value: permissions },
      bootstrapAuth: async () => {}, loadAdminSession: async () => true
    }),
    resolveAdminAccess: resolveAdminRouteAccess
  }))
  return { router, loaded: () => loaded }
}

test('anonymous admin requests redirect before loading protected user pages', async () => {
  const { router, loaded } = createHarness({ authenticated: false })
  await router.push('/admin/users')
  assert.equal(router.currentRoute.value.name, 'Home')
  assert.equal(router.currentRoute.value.query.redirect, '/admin/users')
  assert.equal(loaded(), 0)
})

test('admin users and detail routes enforce user-read permission', async () => {
  const { router, loaded } = createHarness({ permissions: [] })
  await router.push('/admin/users/member-id')
  assert.equal(router.currentRoute.value.name, 'Home')
  assert.equal(loaded(), 0)
})

test('dashboard and old admin entry points converge on user management', async () => {
  for (const path of ['/admin', '/admin/dashboard', '/usage-admin', '/admin/credentials', '/admin/usage', '/admin/issues']) {
    const { router } = createHarness()
    await router.push(path)
    assert.equal(router.currentRoute.value.name, 'AdminUsers')
  }
  const { router } = createHarness()
  await router.push('/admin/users/member-id')
  assert.equal(router.currentRoute.value.name, 'AdminUserDetail')
})
