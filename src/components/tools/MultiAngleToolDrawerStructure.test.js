import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import test from 'node:test'

const drawerUrl = new URL('./MultiAngleToolDrawer.vue', import.meta.url)
const runnerUrl = new URL('../../utils/multiAngleGenerationRunner.js', import.meta.url)
const styleUrl = new URL('./MultiAngleToolDrawer.css', import.meta.url)
const runnerPath = fileURLToPath(runnerUrl)
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

test('multi angle uses documented independent ratio and resolution controls', () => {
  assert.match(drawerSource, /getGptImageGenerationSettings/)
  assert.doesNotMatch(drawerSource, /ratioFromMultiAngleSize|resolutionFromMultiAngleSize|props\.size/)
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


test('multi angle output controls require actual model capabilities', () => {
  assert.match(drawerSource, /v-if="normalizedRatioOptions\.length"/)
  assert.match(drawerSource, /v-if="filteredResolutionOptions\.length"/)
  assert.doesNotMatch(drawerSource, /return options\.length \? options :/)
})


test('multi angle describes approximate viewpoint guidance', () => {
  assert.match(drawerSource, /Target Viewpoint/)
  assert.match(drawerSource, /Viewpoint guidance; generated angles may vary\./)
  assert.doesNotMatch(drawerSource, />Camera Control</)
})


test('restored generation controls use the shared dark select and inherit documented parameters', () => {
  assert.doesNotMatch(drawerSource, /<select\b|<option\b/)
  assert.match(drawerSource, /<BaseSelect[\s\S]*aria-label="Multi-angle ratio"/)
  assert.match(drawerSource, /<BaseSelect[\s\S]*aria-label="Multi-angle resolution"/)
  assert.doesNotMatch(drawerSource, /quality:|background: props/)
})


test('multi angle output selection couples parameters only on user events', () => {
  assert.match(drawerSource, /@update:model-value="selectGenerationSize\('ratio', \$event\)"/)
  assert.match(drawerSource, /@update:model-value="selectGenerationSize\('resolution', \$event\)"/)
  assert.match(drawerSource, /selectGptImageGenerationSize\(/)
  assert.doesNotMatch(drawerSource, /watch\(selectedRatio|watch\(selectedResolution/)
})

test('multi angle awaits durable task saving and prevents resubmission after interrupted polling', () => {
  assert.match(drawerSource, /onSubmitted: Function/)
  assert.match(drawerSource, /onSubmitted: async \(taskId\) => \{\s*submittedTaskId\.value = taskId\s*await props\.onSubmitted\?\.\(taskId\)/)
  assert.match(drawerSource, /:disabled="!imageSource \|\| applying \|\| !!submittedTaskId"/)
  assert.match(drawerSource, /imageTaskTerminal: error\?\.imageTaskTerminal === true/)
})
