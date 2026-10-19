import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const source = readFileSync(new URL('./AdminUserOperationsCell.vue', import.meta.url), 'utf8')

test('user operation menu is compact, neutral, grouped, and icon-led', () => {
  assert.match(source, /aria-label="用户操作"/)
  assert.match(source, /EllipsisHorizontalOutline/)
  for (const label of ['详情与角色', '模型服务', '账户状态']) assert.match(source, new RegExp(label))
  assert.doesNotMatch(source, /rgb\(15,22,36\)|AdminRoleMultiSelect|保存角色/)
})

test('user operation mutations preserve the desktop-only guard', () => {
  assert.match(source, /ADMIN_DESKTOP_ACTIONS_KEY/)
  assert.match(source, /:disabled="!desktopActionsEnabled \|\|/)
})

test('role management entry excludes the signed-in user', () => {
  assert.match(source, /v-if="canManageRoles && !isSelf\(user\)"/)
})

test('operation menu escapes table clipping through the installed popover and supports keyboard dismissal', () => {
  assert.match(source, /<NPopover[\s\S]*?trigger="click"[\s\S]*?placement="bottom-end"/)
  assert.match(source, /<button[\s\S]*?type="button"[\s\S]*?aria-label="用户操作"/)
  assert.match(source, /@keydown\.esc\.stop\.prevent="closeMenu"/)
  assert.doesNotMatch(source, /<details|<summary|position: absolute|:to="false"/)
})

test('paused service has a clear recovery action and the user header only describes account management', () => {
  assert.match(source, /user\.service\?\.serviceStatus === 'disabled' \? '恢复服务' : '开通服务'/)
  const header = readFileSync(new URL('./AdminUserServiceHeader.vue', import.meta.url), 'utf8')
  assert.match(header, /服务权限、角色和账户状态/)
  assert.doesNotMatch(header, /官方消耗|待处理事项/)
})
