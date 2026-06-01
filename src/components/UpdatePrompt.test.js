import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'

const updatePromptSource = readFileSync(new URL('./UpdatePrompt.vue', import.meta.url), 'utf8')

test('update prompt lazy-loads canvas store only when refreshing a canvas route', () => {
  assert.doesNotMatch(updatePromptSource, /import\s*\{\s*useCanvasStore\s*\}\s*from\s*['"]@\/stores\/canvas['"]/)
  assert.doesNotMatch(updatePromptSource, /import\s*\{\s*pinia\s*\}\s*from\s*['"]@\/stores\/pinia['"]/)
  assert.match(updatePromptSource, /import\(['"]@\/stores\/canvas['"]\)/)
  assert.doesNotMatch(updatePromptSource, /import\(['"]@\/stores\/pinia['"]\)/)
  assert.match(updatePromptSource, /isCanvasRoute\.value/)
  assert.match(updatePromptSource, /flushSave/)
  assert.match(updatePromptSource, /window\.location\.reload\(\)/)
})
