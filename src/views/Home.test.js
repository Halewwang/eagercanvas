import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { test } from 'node:test'
import { gzipSync } from 'node:zlib'

const homeSource = readFileSync(new URL('./Home.vue', import.meta.url), 'utf8')
const routerSource = readFileSync(new URL('../router/index.js', import.meta.url), 'utf8')
const homeStyleUrl = new URL('./Home.css', import.meta.url)
const homeStylePath = fileURLToPath(homeStyleUrl)

const readHomeStyleSource = () =>
  existsSync(homeStylePath) ? readFileSync(homeStyleUrl, 'utf8') : ''

const homeSvgAssets = [
  'aioncraft-wordmark.svg',
  'row-02.svg',
  'row-03.svg',
  'row-05.svg',
  'row-07.svg',
  'row-08.svg',
  'row-09.svg',
  'row-11.svg',
  'row-13.svg',
  'tab-image-icon.svg',
  'tab-video-icon.svg',
  'module-image-model-icon.svg',
  'module-video-model-icon.svg',
  'icon-3d.svg',
  '3d-module-icon.svg'
]

test('home module tabs fill all three overview columns', () => {
  const tabMatches = homeSource.match(/class="home-tab home-tab-[^"]+"/g) ?? []

  assert.equal(tabMatches.length, 3)
  assert.match(homeSource, /<span>Image<\/span>/)
  assert.match(homeSource, /<span>Video<\/span>/)
  assert.match(homeSource, /<span>3D<\/span>/)
})

test('home page renders the Figma 3D module section', () => {
  assert.match(homeSource, /class="home-module home-module-3d"/)
  assert.match(homeSource, /3D Module/)
  assert.match(homeSource, /Text and views into/)
  assert.match(homeSource, /3D assets/)
})

test('home module icons use Figma-exported colored assets', () => {
  assert.match(homeSource, /tab-image-icon\.svg/)
  assert.match(homeSource, /tab-video-icon\.svg/)
  assert.match(homeSource, /module-image-model-icon\.svg/)
  assert.match(homeSource, /module-video-model-icon\.svg/)
  assert.doesNotMatch(homeSource, /icon-image\.svg/)
  assert.doesNotMatch(homeSource, /icon-video\.svg/)
})

test('home imported svg assets stay within the build size budget', () => {
  const gzipBytes = homeSvgAssets.reduce((total, assetName) => {
    const source = readFileSync(new URL(`../assets/home-figma/${assetName}`, import.meta.url))
    return total + gzipSync(source).length
  }, 0)

  assert.ok(gzipBytes <= 13000, `home imported SVG gzip size ${gzipBytes} exceeds 13000 bytes`)
})

test('home page delegates scoped presentation styles to a focused stylesheet', () => {
  const homeStyleSource = readHomeStyleSource()

  assert.ok(existsSync(homeStylePath), 'Home.css should exist')
  assert.match(homeSource, /<style scoped src="\.\/Home\.css"><\/style>/)
  assert.doesNotMatch(homeSource, /\.home-shell\s*\{/)
  assert.doesNotMatch(homeSource, /@keyframes home-logo-marquee/)
  assert.match(homeStyleSource, /\.home-shell\s*\{/)
  assert.match(homeStyleSource, /@keyframes home-logo-marquee/)
})

test('public home first paint does not wait for auth bootstrap', () => {
  assert.match(routerSource, /const requiresBootstrap = /)
  assert.match(routerSource, /if \(!requiresBootstrap\) \{\s*return true\s*\}/)
  assert.doesNotMatch(homeSource, /onMounted\(async \(\) => \{\s*await bootstrapAuth\(\)/)
  assert.match(homeSource, /void bootstrapAuth\(\)/)
})

test('home page defers non-critical module image downloads', () => {
  const imageClasses = [
    'home-image-panel-left',
    'home-image-panel-right',
    'home-video-large',
    'home-video-top-right',
    'home-video-bottom-left',
    'home-video-bottom-right',
    'home-3d-left',
    'home-3d-right'
  ]

  imageClasses.forEach((className) => {
    const pattern = new RegExp(`class="${className}"[\\s\\S]*loading="lazy"[\\s\\S]*decoding="async"|loading="lazy"[\\s\\S]*decoding="async"[\\s\\S]*class="${className}"`)
    assert.match(homeSource, pattern)
  })
})
