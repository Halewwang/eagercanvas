import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'

const hookSource = readFileSync(new URL('./useAdminDashboardRefresh.js', import.meta.url), 'utf8')

test('admin dashboard refresh hook delegates session and loader decisions to the core helpers', () => {
  assert.match(hookSource, /getAdminDashboardRefreshLoaderKeys/)
  assert.match(hookSource, /getAdminDashboardSessionOptions/)
  assert.match(hookSource, /auth\.loadAdminSession\(getAdminDashboardSessionOptions\(options\)\)/)
  assert.match(hookSource, /sectionKey: options\.sectionKey \|\| 'overview'/)
  assert.doesNotMatch(hookSource, /loadAdminSession\(\{ force: true \}\)/)
})

test('admin dashboard refresh hook keeps local preview and denied-session guards', () => {
  assert.match(hookSource, /VITE_BYPASS_AUTH === 'true'/)
  assert.match(hookSource, /if \(!allowed\) \{/)
  assert.match(hookSource, /if \(isLocalPreview\) return/)
  assert.match(hookSource, /router\.replace\('\/'\)/)
})
