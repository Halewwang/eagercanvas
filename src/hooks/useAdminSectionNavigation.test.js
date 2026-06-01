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

test('admin section navigation composable is exported for the admin page container', () => {
  assert.match(navigationHookSource, /export const useAdminSectionNavigation/)
  assert.match(navigationHookSource, /ADMIN_ROUTE_NAME_BY_SECTION/)
  assert.match(navigationHookSource, /ADMIN_SECTION_BY_ROUTE_NAME/)
  assert.match(navigationHookSource, /getAdminSectionScrollCandidate/)
})
