import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import test from 'node:test'

const moduleUrl = new URL('./useAdminDesktopOnly.js', import.meta.url)
const componentUrl = new URL('../components/admin/AdminDesktopOnlyAction.vue', import.meta.url)
const desktopModule = await import(moduleUrl).catch(() => ({}))
const componentSource = existsSync(componentUrl) ? readFileSync(componentUrl, 'utf8') : ''

test('desktop-only state follows min-width 768 media changes and cleans up', () => {
  assert.equal(typeof desktopModule.createAdminDesktopOnlyState, 'function')
  if (typeof desktopModule.createAdminDesktopOnlyState !== 'function') return
  const listeners = new Set()
  const query = {
    matches: false,
    addEventListener: (_event, listener) => listeners.add(listener),
    removeEventListener: (_event, listener) => listeners.delete(listener)
  }
  const state = desktopModule.createAdminDesktopOnlyState({ matchMedia: (value) => {
    assert.equal(value, '(min-width: 768px)')
    return query
  } })
  state.start()
  assert.equal(state.isDesktop.value, false)
  query.matches = true
  for (const listener of listeners) listener({ matches: true })
  assert.equal(state.isDesktop.value, true)
  state.stop()
  assert.equal(listeners.size, 0)
})

test('desktop-only action explains why mobile mutations are unavailable', () => {
  assert.match(componentSource, /desktopEnabled/)
  assert.match(componentSource, /移动端只读/)
  assert.match(componentSource, /<slot/)
})
