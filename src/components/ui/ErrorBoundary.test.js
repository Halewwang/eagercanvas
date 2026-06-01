import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { test } from 'node:test'

const errorBoundaryUrl = new URL('./ErrorBoundary.vue', import.meta.url)
const networkBannerUrl = new URL('./NetworkBanner.vue', import.meta.url)
const networkStatusUrl = new URL('./networkStatus.js', import.meta.url)
const uiIndexUrl = new URL('./index.js', import.meta.url)
const appUrl = new URL('../../App.vue', import.meta.url)

const errorBoundarySource = existsSync(errorBoundaryUrl) ? readFileSync(errorBoundaryUrl, 'utf8') : ''
const networkBannerSource = existsSync(networkBannerUrl) ? readFileSync(networkBannerUrl, 'utf8') : ''
const networkStatusSource = existsSync(networkStatusUrl) ? readFileSync(networkStatusUrl, 'utf8') : ''
const uiIndexSource = readFileSync(uiIndexUrl, 'utf8')
const appSource = readFileSync(appUrl, 'utf8')

test('error boundary catches child render errors and shows a resettable fallback', () => {
  assert.ok(existsSync(errorBoundaryUrl))
  assert.match(errorBoundarySource, /onErrorCaptured/)
  assert.match(errorBoundarySource, /const error = ref\(null\)/)
  assert.match(errorBoundarySource, /<slot v-if="!error" \/>/)
  assert.match(errorBoundarySource, /role="alert"/)
  assert.match(errorBoundarySource, /resetBoundary/)
  assert.match(errorBoundarySource, /return false/)
  assert.match(errorBoundarySource, /<style scoped>/)
})

test('network banner reacts to browser online and offline events', () => {
  assert.ok(existsSync(networkBannerUrl))
  assert.ok(existsSync(networkStatusUrl))
  assert.match(networkBannerSource, /bindNetworkStatusListeners/)
  assert.match(networkBannerSource, /syncOfflineDrafts: props\.syncOfflineDrafts/)
  assert.match(networkBannerSource, /stopNetworkStatusListeners\(\)/)
  assert.match(networkStatusSource, /getNavigatorOnlineState/)
  assert.match(networkStatusSource, /navigatorRef\.onLine/)
  assert.match(networkStatusSource, /addEventListener\('online'/)
  assert.match(networkStatusSource, /addEventListener\('offline'/)
  assert.match(networkStatusSource, /removeEventListener\('online'/)
  assert.match(networkStatusSource, /removeEventListener\('offline'/)
  assert.match(networkBannerSource, /syncOfflineDrafts/)
  assert.match(networkStatusSource, /void syncOfflineDrafts\?\.\(\)/)
  assert.match(networkBannerSource, /v-if="!isOnline"/)
  assert.match(networkBannerSource, /role="status"/)
  assert.match(networkBannerSource, /<style scoped>/)
})

test('root app wraps router content with global stability UI modules', () => {
  assert.match(uiIndexSource, /ErrorBoundary/)
  assert.match(uiIndexSource, /NetworkBanner/)
  assert.match(appSource, /ErrorBoundary/)
  assert.match(appSource, /NetworkBanner/)
  assert.doesNotMatch(appSource, /import\s*\{\s*syncOfflineCanvasDrafts\s*\}\s*from\s*['"]\.\/stores\/projects['"]/)
  assert.match(appSource, /import\(['"]\.\/stores\/projects['"]\)/)
  assert.match(appSource, /syncOfflineDrafts/)
  assert.match(appSource, /:sync-offline-drafts="syncOfflineDrafts"/)
  assert.match(appSource, /<ErrorBoundary>/)
  assert.match(appSource, /<router-view \/>/)
})
