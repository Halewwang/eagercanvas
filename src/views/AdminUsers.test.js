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
  assert.doesNotMatch(source, /用户与角色/)
})

test('admin user table treats 302 official billing as the only cost source', () => {
  assert.doesNotMatch(source, /本地估算/)
  assert.doesNotMatch(source, /estimatedUsage/)
  assert.doesNotMatch(source, /差异/)
  assert.match(source, /item\.officialUsage\?\.totalCostAmount/)
  assert.match(source, /formatUsageAmount\(item\.officialUsage\?\.totalCostAmount, item\.officialUsage\?\.currency/)
  assert.doesNotMatch(source, /formatUsd/)
})

test('admin user table does not show pending reconciliation counts', () => {
  assert.doesNotMatch(source, /待对账用户/)
  assert.doesNotMatch(source, /待对账 \$/)
  assert.doesNotMatch(source, /pendingBillingUsers/)
  assert.doesNotMatch(source, /reconciliation\?\.pendingCount/)
})

test('admin user table hides deleted users from the default list', () => {
  assert.match(source, /option value="all">未删除/)
  assert.match(source, /filterStatus === 'all' \? status !== 'deleted' : status === filterStatus/)
})

test('admin dashboard keeps the usage trend compact and internally scrollable', () => {
  assert.match(source, /xl:grid-cols-\[1\.5fr_1fr\] xl:items-start/)
  assert.match(source, /ref="overviewSideRef"/)
  assert.match(source, /:style="usageTrendCardStyle"/)
  assert.match(source, /admin-usage-trend-scroll flex-1 space-y-3/)
  assert.match(source, /ResizeObserver/)
  assert.match(source, /\.admin-usage-trend-scroll[\s\S]*overflow-y: auto/)
})
