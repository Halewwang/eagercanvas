import assert from 'node:assert/strict'
import test from 'node:test'
import { ADMIN_NAV_ITEMS, getAllowedAdminNavItems, getFirstAllowedAdminRoute, hasAdminAccessPermission, resolveAdminRouteAccess } from './adminNavigation.js'

test('dashboard navigation contains only user management and enforces its permission', () => {
  assert.deepEqual(ADMIN_NAV_ITEMS.map((item) => item.routeName), ['AdminUsers'])
  assert.deepEqual(getAllowedAdminNavItems([]), [])
  assert.equal(getFirstAllowedAdminRoute(['admin.user.read']), 'AdminUsers')
  assert.equal(hasAdminAccessPermission(['admin.audit.read']), false)
  assert.equal(hasAdminAccessPermission(['admin.user.read']), true)
  assert.deepEqual(resolveAdminRouteAccess({ permission: 'admin.user.read', permissions: [] }), { allowed: false, routeName: 'Home' })
  assert.deepEqual(resolveAdminRouteAccess({ permission: 'admin.user.read', permissions: ['admin.user.read'] }), { allowed: true, routeName: null })
})
