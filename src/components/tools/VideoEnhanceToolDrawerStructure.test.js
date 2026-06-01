import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import test from 'node:test'

const drawerUrl = new URL('./VideoEnhanceToolDrawer.vue', import.meta.url)
const generationUrl = new URL('./VideoEnhanceGeneration.js', import.meta.url)
const styleUrl = new URL('./VideoEnhanceToolDrawer.css', import.meta.url)
const generationPath = fileURLToPath(generationUrl)
const stylePath = fileURLToPath(styleUrl)
const drawerSource = readFileSync(drawerUrl, 'utf8')

const readStyleSource = () =>
  existsSync(stylePath) ? readFileSync(styleUrl, 'utf8') : ''

test('video enhance drawer delegates scoped panel styles to a focused stylesheet', () => {
  const styleSource = readStyleSource()

  assert.ok(existsSync(stylePath), 'VideoEnhanceToolDrawer.css should exist')
  assert.match(drawerSource, /<style scoped src="\.\/VideoEnhanceToolDrawer\.css"><\/style>/)
  assert.doesNotMatch(drawerSource, /\.multi-angle-overlay\s*\{/)
  assert.doesNotMatch(drawerSource, /\.tool-primary-btn:disabled/)
  assert.match(styleSource, /\.multi-angle-overlay\s*\{/)
  assert.match(styleSource, /\.tool-primary-btn:disabled/)
})

test('video enhance drawer delegates generation payloads and runner logic to a focused module', () => {
  assert.ok(existsSync(generationPath), 'VideoEnhanceGeneration.js should exist')
  assert.match(
    drawerSource,
    /import \{\s*createVideoEnhanceApplyPayload,\s*createVideoEnhancePendingPayload,\s*runVideoEnhancement\s*\} from '\.\/VideoEnhanceGeneration\.js'/s
  )
  assert.doesNotMatch(drawerSource, /const parseRatio = /)
  assert.doesNotMatch(drawerSource, /const buildResolutionSize = /)
  assert.doesNotMatch(drawerSource, /const buildOutput = /)
  assert.doesNotMatch(drawerSource, /videoGen\.generate\(payload\)/)
  assert.doesNotMatch(drawerSource, /No video output from provider/)
})
