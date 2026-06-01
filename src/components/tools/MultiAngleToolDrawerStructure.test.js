import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import test from 'node:test'

const drawerUrl = new URL('./MultiAngleToolDrawer.vue', import.meta.url)
const runnerUrl = new URL('../../utils/multiAngleGenerationRunner.js', import.meta.url)
const sizeOptionsUrl = new URL('../../utils/multiAngleSizeOptions.js', import.meta.url)
const styleUrl = new URL('./MultiAngleToolDrawer.css', import.meta.url)
const runnerPath = fileURLToPath(runnerUrl)
const sizeOptionsPath = fileURLToPath(sizeOptionsUrl)
const stylePath = fileURLToPath(styleUrl)
const drawerSource = readFileSync(drawerUrl, 'utf8')

const readStyleSource = () =>
  existsSync(stylePath) ? readFileSync(styleUrl, 'utf8') : ''

test('multi angle drawer delegates generation orchestration to a focused runner', () => {
  assert.ok(existsSync(runnerPath), 'multiAngleGenerationRunner.js should exist')
  assert.match(
    drawerSource,
    /import \{\s*createMultiAngleApplyPayload,\s*createMultiAngleGenerationContext,\s*createMultiAnglePendingPayload,\s*runMultiAngleGeneration\s*\} from '@\/utils\/multiAngleGenerationRunner\.js'/s
  )
  assert.doesNotMatch(drawerSource, /buildMultiAngleCameraInput/)
  assert.doesNotMatch(drawerSource, /buildMultiAngleCameraPrompt/)
  assert.doesNotMatch(drawerSource, /const buildCameraInput = /)
  assert.doesNotMatch(drawerSource, /const computeRatioLabel = /)
  assert.doesNotMatch(drawerSource, /imageGen\.generate\(/)
  assert.doesNotMatch(drawerSource, /No image output from model/)
})

test('multi angle drawer delegates size ratio and resolution option logic to utilities', () => {
  assert.ok(existsSync(sizeOptionsPath), 'multiAngleSizeOptions.js should exist')
  assert.match(
    drawerSource,
    /import \{\s*getMultiAngleFilteredSizeOptions,\s*getMultiAngleResolutionOptions,\s*normalizeMultiAngleOptionList,\s*ratioFromMultiAngleSize,\s*resolutionFromMultiAngleSize\s*\} from '@\/utils\/multiAngleSizeOptions\.js'/s
  )
  assert.doesNotMatch(drawerSource, /const ratioFromSizeKey = /)
  assert.doesNotMatch(drawerSource, /const resolutionFromSizeString = /)
  assert.doesNotMatch(drawerSource, /const normalizeOptionList = /)
})

test('multi angle drawer delegates scoped panel styles to a focused stylesheet', () => {
  const styleSource = readStyleSource()

  assert.ok(existsSync(stylePath), 'MultiAngleToolDrawer.css should exist')
  assert.match(drawerSource, /<style scoped src="\.\/MultiAngleToolDrawer\.css"><\/style>/)
  assert.doesNotMatch(drawerSource, /\.multi-angle-overlay\s*\{/)
  assert.doesNotMatch(drawerSource, /\.manual-slider::-webkit-slider-thumb/)
  assert.match(styleSource, /\.multi-angle-overlay\s*\{/)
  assert.match(styleSource, /\.manual-slider::-webkit-slider-thumb/)
})
