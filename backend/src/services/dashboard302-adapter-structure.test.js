import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

test('Dashboard302 adapter delegates shared video response extraction helpers', () => {
  const source = readFileSync(new URL('./providers/dashboard302.adapter.js', import.meta.url), 'utf8')

  assert.match(
    source,
    /import\s*\{[^}]*extractTaskId[^}]*extractVideoUrl[^}]*\}\s*from\s*'\.\/video-response\.js'/s
  )
  assert.doesNotMatch(source, /const extractTaskId =/)
  assert.doesNotMatch(source, /const extractVideoUrl =/)
})

test('Dashboard302 adapter delegates Kling and Topaz video helpers', () => {
  const source = readFileSync(new URL('./providers/dashboard302.adapter.js', import.meta.url), 'utf8')

  assert.match(source, /from '\.\/dashboard302-video-helpers\.js'/)
  assert.match(source, /export\s*\{[^}]*isKlingVideoModel[^}]*isKlingTaskId[^}]*isTopazVideoEnhancePayload[^}]*\}\s*from\s*'\.\/dashboard302-video-helpers\.js'/s)
  assert.doesNotMatch(source, /const pickFirstImageInput =/)
  assert.doesNotMatch(source, /const normalizeKlingStatus =/)
  assert.doesNotMatch(source, /const extractKlingStatus =/)
  assert.doesNotMatch(source, /const normalizeTopazStatus =/)
  assert.doesNotMatch(source, /const buildKlingO1Request =/)
  assert.doesNotMatch(source, /const buildKlingO3Request =/)
})
