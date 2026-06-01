import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { test } from 'node:test'

const drawerUrl = new URL('./Wedding3x3ToolDrawer.vue', import.meta.url)
const fieldModuleUrl = new URL('./ToolAutocompleteFields.js', import.meta.url)
const generationOptionsModuleUrl = new URL('./Wedding3x3GenerationOptions.js', import.meta.url)
const asyncImageResultModuleUrl = new URL('./Wedding3x3AsyncImageResult.js', import.meta.url)
const previewActionsModuleUrl = new URL('./Wedding3x3PreviewActions.js', import.meta.url)
const generationRunnerModuleUrl = new URL('./Wedding3x3GenerationRunner.js', import.meta.url)
const styleModuleUrl = new URL('./Wedding3x3ToolDrawer.css', import.meta.url)
const fieldModulePath = fileURLToPath(fieldModuleUrl)
const generationOptionsModulePath = fileURLToPath(generationOptionsModuleUrl)
const asyncImageResultModulePath = fileURLToPath(asyncImageResultModuleUrl)
const previewActionsModulePath = fileURLToPath(previewActionsModuleUrl)
const generationRunnerModulePath = fileURLToPath(generationRunnerModuleUrl)
const styleModulePath = fileURLToPath(styleModuleUrl)
const drawerSource = readFileSync(drawerUrl, 'utf8')

const readFieldModuleSource = () =>
  existsSync(fieldModulePath) ? readFileSync(fieldModuleUrl, 'utf8') : ''

const readGenerationRunnerSource = () =>
  existsSync(generationRunnerModulePath) ? readFileSync(generationRunnerModuleUrl, 'utf8') : ''

const readStyleModuleSource = () =>
  existsSync(styleModulePath) ? readFileSync(styleModuleUrl, 'utf8') : ''

test('wedding 3x3 drawer delegates autocomplete field UI to a focused tool module', () => {
  const fieldModuleSource = readFieldModuleSource()

  assert.ok(existsSync(fieldModulePath), 'ToolAutocompleteFields.js should exist')
  assert.match(drawerSource, /import \{ AutocompleteField, MultiAutocompleteField \} from '\.\/ToolAutocompleteFields\.js'/)
  assert.doesNotMatch(drawerSource, /const AutocompleteField = defineComponent/)
  assert.doesNotMatch(drawerSource, /const MultiAutocompleteField = defineComponent/)
  assert.doesNotMatch(drawerSource, /const useFieldPopover = /)
  assert.doesNotMatch(drawerSource, /const normalizeDropdownItems = /)
  assert.doesNotMatch(drawerSource, /const matchesOptionQuery = /)

  assert.match(fieldModuleSource, /export const normalizeDropdownItems = /)
  assert.match(fieldModuleSource, /export const matchesOptionQuery = /)
  assert.match(fieldModuleSource, /export const AutocompleteField = defineComponent\(\{/)
  assert.match(fieldModuleSource, /export const MultiAutocompleteField = defineComponent\(\{/)
})

test('tool autocomplete helpers preserve option labels and search metadata', async () => {
  assert.ok(existsSync(fieldModulePath), 'ToolAutocompleteFields.js should exist')
  const { matchesOptionQuery, normalizeDropdownItems } = await import(fieldModuleUrl.href)

  const normalized = normalizeDropdownItems([
    'Editorial',
    { key: 'garden', label: 'Garden', description: 'Outdoor ceremony' },
    { key: 'minimal' }
  ])

  assert.deepEqual(normalized, [
    { key: 'Editorial', label: 'Editorial', description: '' },
    { key: 'garden', label: 'Garden', description: 'Outdoor ceremony' },
    { key: 'minimal', label: 'minimal', description: '' }
  ])
  assert.equal(matchesOptionQuery(normalized[1], 'outdoor'), true)
  assert.equal(matchesOptionQuery(normalized[1], 'GAR'), true)
  assert.equal(matchesOptionQuery(normalized[2], 'minimal'), true)
  assert.equal(matchesOptionQuery(normalized[0], ''), true)
  assert.equal(matchesOptionQuery(normalized[0], 'venue'), false)
})

test('wedding 3x3 drawer delegates generation option derivation to a focused module', () => {
  assert.ok(existsSync(generationOptionsModulePath), 'Wedding3x3GenerationOptions.js should exist')
  assert.match(
    drawerSource,
    /import \{\s*getWedding3x3RatioOptions,\s*getWedding3x3ResolutionOptions,\s*resolutionFromSizeKey,\s*resolveWedding3x3SelectedSize\s*\} from '\.\/Wedding3x3GenerationOptions\.js'/s
  )
  assert.doesNotMatch(drawerSource, /const ratioFromSizeKey = /)
  assert.doesNotMatch(drawerSource, /const resolutionFromSizeKey = /)
})

test('wedding 3x3 drawer delegates async image result parsing and polling to a focused module', () => {
  assert.ok(existsSync(asyncImageResultModulePath), 'Wedding3x3AsyncImageResult.js should exist')
  const generationRunnerSource = readGenerationRunnerSource()

  assert.match(generationRunnerSource, /from '\.\/Wedding3x3AsyncImageResult\.js'/)
  assert.doesNotMatch(drawerSource, /from '\.\/Wedding3x3AsyncImageResult\.js'/)
  assert.doesNotMatch(drawerSource, /const ASYNC_IMAGE_MODELS = /)
  assert.doesNotMatch(drawerSource, /const isAsyncImageModel = /)
  assert.doesNotMatch(drawerSource, /const extractImageTaskId = /)
  assert.doesNotMatch(drawerSource, /const extractGeneratedImageUrl = /)
  assert.doesNotMatch(drawerSource, /const waitForAsyncImageResult = /)
})

test('wedding 3x3 drawer delegates preview copy and download actions to a focused module', () => {
  assert.ok(existsSync(previewActionsModulePath), 'Wedding3x3PreviewActions.js should exist')
  assert.match(
    drawerSource,
    /import \{\s*copyWedding3x3PreviewText,\s*downloadWedding3x3JsonPreview\s*\} from '\.\/Wedding3x3PreviewActions\.js'/s
  )
  assert.doesNotMatch(drawerSource, /const copyText = async/)
  assert.doesNotMatch(drawerSource, /navigator\.clipboard\.writeText/)
  assert.doesNotMatch(drawerSource, /URL\.createObjectURL/)
  assert.doesNotMatch(drawerSource, /URL\.revokeObjectURL/)
})

test('wedding 3x3 drawer delegates generation run orchestration to a focused module', () => {
  assert.ok(existsSync(generationRunnerModulePath), 'Wedding3x3GenerationRunner.js should exist')
  assert.match(
    drawerSource,
    /import \{\s*createWedding3x3ApplyPayload,\s*createWedding3x3PendingPayload,\s*runWedding3x3Generation\s*\} from '\.\/Wedding3x3GenerationRunner\.js'/s
  )
  assert.doesNotMatch(drawerSource, /createImageGenerationRun/)
  assert.doesNotMatch(drawerSource, /getImageGenerationTask/)
  assert.doesNotMatch(drawerSource, /isWedding3x3AsyncImageModel/)
  assert.doesNotMatch(drawerSource, /extractWedding3x3GeneratedImageUrl/)
  assert.doesNotMatch(drawerSource, /extractWedding3x3ImageTaskId/)
  assert.doesNotMatch(drawerSource, /waitForWedding3x3AsyncImageResult/)
})

test('wedding 3x3 drawer delegates scoped panel styles to a focused stylesheet', () => {
  const styleModuleSource = readStyleModuleSource()

  assert.ok(existsSync(styleModulePath), 'Wedding3x3ToolDrawer.css should exist')
  assert.match(drawerSource, /<style scoped src="\.\/Wedding3x3ToolDrawer\.css"><\/style>/)
  assert.doesNotMatch(drawerSource, /\.wedding-overlay\s*\{/)
  assert.doesNotMatch(drawerSource, /:deep\(\.autocomplete-option\)/)
  assert.match(styleModuleSource, /\.wedding-overlay\s*\{/)
  assert.match(styleModuleSource, /:deep\(\.autocomplete-option\)/)
})
