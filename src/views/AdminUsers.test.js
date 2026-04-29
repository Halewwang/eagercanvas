import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'

const source = readFileSync(new URL('./AdminUsers.vue', import.meta.url), 'utf8')

test('admin page separates user service operations from billing reconciliation', () => {
  assert.match(source, /用户服务/)
  assert.match(source, /消耗对账/)
  assert.match(source, /服务开通率/)
  assert.match(source, /待处理服务/)

  const userServiceIndex = source.indexOf('用户服务')
  const billingIndex = source.indexOf('消耗对账')
  const auditIndex = source.indexOf('后台审计日志')

  assert.ok(userServiceIndex > -1)
  assert.ok(billingIndex > userServiceIndex)
  assert.ok(auditIndex > billingIndex)
})

test('admin user table keeps the service workflow focused', () => {
  assert.match(source, /服务状态/)
  assert.match(source, /官方消耗/)
  assert.match(source, /待对账/)
  assert.doesNotMatch(source, /用户与角色/)
})
