import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import test from 'node:test'

const navigation = await import('./adminSectionNavigationCore.js').catch(() => ({}))
const navigationHookUrl = new URL('./useAdminSectionNavigation.js', import.meta.url)
const navigationHookSource = existsSync(navigationHookUrl) ? readFileSync(navigationHookUrl, 'utf8') : ''

const makeSectionEl = (top) => ({
  getBoundingClientRect: () => ({ top })
})

test('admin section scroll candidate chooses the visible section closest to the header offset', () => {
  assert.equal(typeof navigation.getAdminSectionScrollCandidate, 'function')

  const sections = {
    overview: makeSectionEl(28),
    users: makeSectionEl(180),
    service: makeSectionEl(122),
    audit: makeSectionEl(460)
  }

  assert.equal(
    navigation.getAdminSectionScrollCandidate([
      { key: 'overview' },
      { key: 'users' },
      { key: 'service' },
      { key: 'audit' }
    ], (key) => sections[key]),
    'service'
  )
})

test('admin section scroll candidate falls back to overview when no section element is available', () => {
  assert.equal(typeof navigation.getAdminSectionScrollCandidate, 'function')

  assert.equal(
    navigation.getAdminSectionScrollCandidate([
      { key: 'overview' },
      { key: 'users' }
    ], () => null),
    'overview'
  )
})

test('admin section scroll candidate skips hidden component refs without DOM geometry', () => {
  assert.equal(typeof navigation.getAdminSectionScrollCandidate, 'function')

  const sections = {
    overview: makeSectionEl(24),
    users: { getSectionEl: () => null },
    service: makeSectionEl(118)
  }

  assert.equal(
    navigation.getAdminSectionScrollCandidate([
      { key: 'overview' },
      { key: 'users' },
      { key: 'service' }
    ], (key) => sections[key]),
    'service'
  )
})

test('admin route entry keeps the dashboard overview at the top of the shell', () => {
  assert.equal(typeof navigation.shouldAutoScrollAdminSection, 'function')

  assert.equal(navigation.shouldAutoScrollAdminSection({
    routeName: 'AdminDashboard',
    sectionKey: 'overview'
  }), false)
  assert.equal(navigation.shouldAutoScrollAdminSection({
    routeName: 'AdminUsers',
    sectionKey: 'users'
  }), true)
  assert.equal(navigation.shouldAutoScrollAdminSection({
    routeName: 'AdminDashboard',
    sectionKey: 'users'
  }), true)
})

test('admin route-specific pages keep nav ownership instead of scroll ownership', () => {
  assert.equal(typeof navigation.shouldRouteOwnAdminActiveSection, 'function')

  assert.equal(navigation.shouldRouteOwnAdminActiveSection({
    routeName: 'AdminDashboard',
    sectionKey: 'overview'
  }), false)
  assert.equal(navigation.shouldRouteOwnAdminActiveSection({
    routeName: 'AdminAudit',
    sectionKey: 'audit'
  }), true)
  assert.equal(navigation.shouldRouteOwnAdminActiveSection({
    routeName: '',
    sectionKey: 'audit'
  }), false)
  assert.equal(navigation.shouldRouteOwnAdminActiveSection({
    routeName: 'AdminAudit',
    sectionKey: ''
  }), false)
})

test('admin section navigation prefers the app scroll container over window', () => {
  assert.equal(typeof navigation.resolveAdminScrollTarget, 'function')

  const explicitTarget = { id: 'explicit' }
  const appTarget = { id: 'app' }
  const windowTarget = {
    document: {
      getElementById: (id) => (id === 'app' ? appTarget : null)
    }
  }

  assert.equal(navigation.resolveAdminScrollTarget({ scrollTarget: explicitTarget, windowTarget }), explicitTarget)
  assert.equal(navigation.resolveAdminScrollTarget({ windowTarget }), appTarget)
  assert.equal(navigation.resolveAdminScrollTarget({ windowTarget: {} }), null)
})

test('admin section navigation composable is exported for the admin page container', () => {
  assert.match(navigationHookSource, /export const useAdminSectionNavigation/)
  assert.match(navigationHookSource, /ADMIN_ROUTE_NAME_BY_SECTION/)
  assert.match(navigationHookSource, /ADMIN_SECTION_BY_ROUTE_NAME/)
  assert.match(navigationHookSource, /getAdminSectionScrollCandidate/)
  assert.match(navigationHookSource, /shouldRouteOwnAdminActiveSection/)
})

test('admin section navigation requests scoped dashboard data for the target section', () => {
  assert.match(navigationHookSource, /loadAll\(\{ sectionKey: key \}\)/)
  assert.match(navigationHookSource, /loadAll\(\{ sectionKey: preferredSection \|\| 'overview' \}\)/)
})

test('admin section navigation avoids duplicate scoped loads during route handoff', () => {
  assert.match(navigationHookSource, /shouldDeferToRouteWatcher/)
  assert.match(navigationHookSource, /if \(loadData && !shouldDeferToRouteWatcher\) void loadAll\(\{ sectionKey: key \}\)/)
})
