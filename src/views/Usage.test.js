import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { test } from 'node:test'

const usageViewSource = readFileSync(new URL('./Usage.vue', import.meta.url), 'utf8')
const navButtonUrl = new URL('../components/usage/UsageNavButton.vue', import.meta.url)
const navButtonPath = fileURLToPath(navButtonUrl)
const navButtonSource = existsSync(navButtonPath) ? readFileSync(navButtonUrl, 'utf8') : ''
const surfaceUrl = new URL('../components/usage/UsageSurface.vue', import.meta.url)
const surfacePath = fileURLToPath(surfaceUrl)
const surfaceSource = existsSync(surfacePath) ? readFileSync(surfaceUrl, 'utf8') : ''
const globalStyleSource = readFileSync(new URL('../style.css', import.meta.url), 'utf8')

test('usage page navigation uses a scoped nav button component', () => {
  const navButtonUses = [...usageViewSource.matchAll(/<UsageNavButton\b/g)]

  assert.equal(navButtonUses.length, 2)
  assert.match(usageViewSource, /import UsageNavButton from '@\/components\/usage\/UsageNavButton\.vue'/)
  assert.doesNotMatch(usageViewSource, /flora-button-ghost/)
  assert.doesNotMatch(globalStyleSource, /\.flora-button-ghost(?:\s|:|\{)/)

  assert.match(navButtonSource, /<button\s+type="button"\s+class="usage-nav-button"/)
  assert.match(navButtonSource, /<slot\s*\/>/)
  assert.match(navButtonSource, /<style scoped>/)
  assert.match(navButtonSource, /\.usage-nav-button\s*\{[^}]*background:\s*color-mix\(in srgb, var\(--bg-secondary\) 80%, transparent\)/s)
  assert.match(navButtonSource, /\.usage-nav-button:hover\s*\{[^}]*transform:\s*translateY\(-1px\)/s)
})

test('usage page panels use a scoped surface component', () => {
  const surfaceUses = [...usageViewSource.matchAll(/<UsageSurface\b/g)]

  assert.equal(surfaceUses.length, 2)
  assert.match(usageViewSource, /import UsageSurface from '@\/components\/usage\/UsageSurface\.vue'/)
  assert.doesNotMatch(usageViewSource, /flora-panel/)

  assert.match(surfaceSource, /<div\s+class="usage-surface"/)
  assert.match(surfaceSource, /<slot\s*\/>/)
  assert.match(surfaceSource, /<style scoped>/)
  assert.match(surfaceSource, /\.usage-surface\s*\{[^}]*background:\s*color-mix\(in srgb, var\(--bg-secondary\) 84%, transparent\)/s)
  assert.match(surfaceSource, /\.usage-surface\s*\{[^}]*backdrop-filter:\s*var\(--surface-blur\)/s)
})

test('usage page fails softly in local preview mode', () => {
  assert.match(usageViewSource, /const isLocalPreviewMode = \(\) => import\.meta\.env\.DEV && import\.meta\.env\.VITE_BYPASS_AUTH === 'true'/)
  assert.match(usageViewSource, /onMounted\(async \(\) => \{\s*if \(isLocalPreviewMode\(\)\) return\s*try \{/s)
  assert.match(usageViewSource, /window\.\$message\?\.error\(getErrorMessage\(error, 'Failed to load usage dashboard'\)\)/)
})

test('usage page title uses the requested stronger heading weight', () => {
  assert.match(usageViewSource, /<h1 class="text-3xl font-semibold">My Usage<\/h1>/)
  assert.doesNotMatch(usageViewSource, /<h1 class="text-3xl font-light">My Usage<\/h1>/)
})
