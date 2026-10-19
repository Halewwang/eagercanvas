import assert from 'node:assert/strict'
import test from 'node:test'

const navigation = await import('./adminAccessNavigation.js').catch(() => ({}))

test('buildAdminUserDetailTarget routes roles to the existing detail surface', () => {
  assert.equal(typeof navigation.buildAdminUserDetailTarget, 'function')
  if (typeof navigation.buildAdminUserDetailTarget !== 'function') return

  assert.deepEqual(navigation.buildAdminUserDetailTarget(' user-42 ', 'roles'), {
    name: 'AdminUsers',
    query: { userId: 'user-42', tab: 'roles' }
  })
})

test('access assignment target resolves through AdminUsers into an embedded roles detail', () => {
  assert.equal(typeof navigation.buildAdminAccessAssignmentTarget, 'function')
  assert.equal(typeof navigation.resolveAdminUsersAccessFocus, 'function')
  if (
    typeof navigation.buildAdminAccessAssignmentTarget !== 'function' ||
    typeof navigation.resolveAdminUsersAccessFocus !== 'function'
  ) return

  const target = navigation.buildAdminAccessAssignmentTarget(' user-42 ')
  assert.deepEqual(target, {
    name: 'AdminUsers',
    query: { userId: 'user-42', tab: 'roles' }
  })
  assert.deepEqual(navigation.resolveAdminUsersAccessFocus(target.query), {
    embedded: true,
    initialTab: 'roles',
    targetUserId: 'user-42'
  })
})

test('AdminUsers focus query fails closed unless both user id and roles tab are valid', () => {
  assert.equal(typeof navigation.resolveAdminUsersAccessFocus, 'function')
  if (typeof navigation.resolveAdminUsersAccessFocus !== 'function') return

  assert.equal(navigation.resolveAdminUsersAccessFocus({ userId: 'user-42' }), null)
  assert.equal(navigation.resolveAdminUsersAccessFocus({ userId: 'user-42', tab: 'summary' }), null)
  assert.equal(navigation.resolveAdminUsersAccessFocus({ userId: ['user-42'], tab: 'roles' }), null)
  assert.equal(navigation.resolveAdminUsersAccessFocus({ userId: ' ', tab: 'roles' }), null)
})

test('assignment targets preserve fail-closed query values through the full target-to-focus chain', () => {
  assert.equal(typeof navigation.buildAdminAccessAssignmentTarget, 'function')
  assert.equal(typeof navigation.resolveAdminUsersAccessFocus, 'function')
  if (
    typeof navigation.buildAdminAccessAssignmentTarget !== 'function' ||
    typeof navigation.resolveAdminUsersAccessFocus !== 'function'
  ) return

  for (const userId of [undefined, '', ' ', ['user-a', 'user-b']]) {
    const target = navigation.buildAdminAccessAssignmentTarget(userId)
    assert.deepEqual(target.query, { tab: 'roles' })
    assert.equal(navigation.resolveAdminUsersAccessFocus(target.query), null)
  }
})
