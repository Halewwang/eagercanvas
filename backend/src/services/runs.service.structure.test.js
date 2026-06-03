import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const source = readFileSync(new URL('./runs.service.js', import.meta.url), 'utf8')

test('runs.service delegates generation asset helpers to run-assets service', () => {
  assert.match(source, /from '\.\/run-assets\.js'/)
  assert.doesNotMatch(source, /export const persistRemoteUrlIfNeeded =/)
  assert.doesNotMatch(source, /export const persistDataUrlIfNeeded =/)
  assert.doesNotMatch(source, /export const persistImageResultAssets =/)
  assert.doesNotMatch(source, /export const persistVideoResultAsset =/)
  assert.doesNotMatch(source, /export const buildImageGenerationAssets =/)
  assert.doesNotMatch(source, /export const buildVideoGenerationAssets =/)
  assert.doesNotMatch(source, /const extractProviderVideoUrl =/)
  assert.doesNotMatch(source, /const resolveVideoSourceNodeId =/)
})

test('runs.service preserves existing public helper exports for compatibility', () => {
  assert.match(source, /persistImageResultAssets,[\s\S]*persistVideoResultAsset[\s\S]*from '\.\/run-assets\.js'/)
  assert.match(source, /buildImageGenerationAssets,[\s\S]*buildVideoGenerationAssets[\s\S]*from '\.\/run-assets\.js'/)
})

test('runs.service returns synchronous image assets before noncritical completion bookkeeping', () => {
  assert.match(source, /const shouldClientPersistImageResultAssets = \(payload = \{\}\) =>/)
  assert.match(source, /markImageResultAssetsForClientPersistence\(providerResponse\)/)
  assert.match(source, /const queueCompletedRunFinalization = \(params = \{\}\) => \{/)
  assert.match(source, /if \(isImageRun && imageHasAssets\) \{[\s\S]*queueCompletedRunFinalization\(\{[\s\S]*return \{[\s\S]*status: 'completed'/)
})

test('runs.service delegates task ownership and status helpers to run-task-records service', () => {
  assert.match(source, /from '\.\/run-task-records\.js'/)
  assert.doesNotMatch(source, /const bindVideoTaskOwnership =/)
  assert.doesNotMatch(source, /const bindImageTaskOwnership =/)
  assert.doesNotMatch(source, /const assertImageTaskOwnership =/)
  assert.doesNotMatch(source, /const assertVideoTaskOwnership =/)
  assert.doesNotMatch(source, /const findImageRunIdByTask =/)
  assert.doesNotMatch(source, /const findImageRunContextByTask =/)
  assert.doesNotMatch(source, /const findVideoRunContextByTask =/)
  assert.doesNotMatch(source, /const syncRunStatusFromImageTask =/)
  assert.doesNotMatch(source, /const syncRunStatusFromVideoTask =/)
})
