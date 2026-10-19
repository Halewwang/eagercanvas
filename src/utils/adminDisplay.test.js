import assert from 'node:assert/strict'
import test from 'node:test'
import * as adminDisplay from './adminDisplay.js'

test('admin display role helpers preserve role options, labels, and list formatting', () => {
  assert.ok(Array.isArray(adminDisplay.ADMIN_ROLE_OPTIONS))
  assert.equal(typeof adminDisplay.getAdminRoleLabel, 'function')
  assert.equal(typeof adminDisplay.formatAdminRoleList, 'function')

  assert.deepEqual(adminDisplay.ADMIN_ROLE_OPTIONS, [
    { value: 'super_admin', label: '超级管理员' },
    { value: 'admin', label: '管理员' },
    { value: 'ops', label: '运维' },
    { value: 'support', label: '客服' },
    { value: 'user', label: '普通用户' }
  ])
  assert.equal(adminDisplay.getAdminRoleLabel('super_admin'), '超级管理员')
  assert.equal(adminDisplay.getAdminRoleLabel(' admin '), '管理员')
  assert.equal(adminDisplay.getAdminRoleLabel('custom_role'), 'custom_role')
  assert.equal(adminDisplay.getAdminRoleLabel(''), '-')
  assert.equal(adminDisplay.formatAdminRoleList(['super_admin', 'support', 'custom_role']), '超级管理员、客服、custom_role')
  assert.equal(adminDisplay.formatAdminRoleList(undefined), '')
})

test('admin display user status helpers preserve pill classes and Chinese labels', () => {
  assert.equal(typeof adminDisplay.getAdminUserStatusClass, 'function')
  assert.equal(typeof adminDisplay.getAdminUserStatusLabel, 'function')

  assert.equal(adminDisplay.getAdminUserStatusClass(), 'ui-status-pill-active')
  assert.equal(adminDisplay.getAdminUserStatusClass('suspended'), 'ui-status-pill-suspended')
  assert.equal(adminDisplay.getAdminUserStatusClass('deleted'), 'ui-status-pill-deleted')
  assert.equal(adminDisplay.getAdminUserStatusClass('unknown'), 'ui-status-pill-active')

  assert.equal(adminDisplay.getAdminUserStatusLabel(), '正常')
  assert.equal(adminDisplay.getAdminUserStatusLabel('suspended'), '已暂停')
  assert.equal(adminDisplay.getAdminUserStatusLabel('deleted'), '已删除')
  assert.equal(adminDisplay.getAdminUserStatusLabel('unknown'), '正常')
})

test('dates and model service labels handle missing values', () => {
  assert.equal(adminDisplay.formatAdminDateTime('invalid'), '-')
  assert.equal(adminDisplay.formatAdminDateTime(''), '-')
  assert.equal(adminDisplay.getAdminServiceStatusLabel('active'), '已开通')
  assert.equal(adminDisplay.getAdminServiceStatusLabel('disabled'), '已暂停')
  assert.equal(adminDisplay.getAdminServiceStatusLabel(), '未开通')
})
