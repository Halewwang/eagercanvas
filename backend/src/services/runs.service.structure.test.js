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
  assert.match(source, /shouldPersistImageResultAssetsBeforeResponse/)
  assert.match(source, /const shouldClientPersistImageResultAssets = \(payload = \{\}, providerResponse = \{\}\) =>/)
  assert.match(source, /!shouldPersistImageResultAssetsBeforeResponse\(providerResponse\)/)
  assert.match(source, /markImageResultAssetsForClientPersistence\(providerResponse\)/)
  assert.match(source, /const queueCompletedRunFinalization = \(params = \{\}\) => \{/)
  assert.match(source, /waitUntil\(finalizeCompletedRun\(params\)\.catch\(\(error\) => \{[\s\S]*completed run finalization failed/)
  assert.match(source, /if \(isImageRun && imageHasAssets\) \{[\s\S]*queueCompletedRunFinalization\(\{[\s\S]*return \{[\s\S]*status: 'completed'/)
})

test('getImageTask returns completed provider image URLs before persistence finalization', () => {
  const getImageTaskSource = source.match(/export const getImageTask = async \(_userId, taskId\) => \{[\s\S]*?\n  return result\n\}/)?.[0] || ''
  assert.ok(getImageTaskSource, 'getImageTask source should be found')
  assert.match(getImageTaskSource, /const imageRunContext = await resolveImageTaskContextByTask\(\{ userId: _userId, taskId \}\)/)
  assert.doesNotMatch(getImageTaskSource, /assertImageTaskOwnership\(\{ userId: _userId, taskId \}\)/)
  assert.doesNotMatch(getImageTaskSource, /findImageRunContextByTask\(\{ userId: _userId, taskId \}\)/)
  assert.doesNotMatch(getImageTaskSource, /await persistImageResultAssets\(rawResult\)/)
  assert.match(getImageTaskSource, /const result = markImageResultAssetsForClientPersistence\(rawResult\)/)
  assert.match(getImageTaskSource, /queueImageTaskResultFinalization\(\{[\s\S]*rawResult[\s\S]*sourceNodeId/)
  assert.match(getImageTaskSource, /return result/)
})

test('runs.service wraps GPT Image lite in the existing image task polling contract', () => {
  assert.match(source, /const LOCAL_IMAGE_RUN_TASK_PREFIX = 'local-image-run:'/)
  assert.match(source, /export const isGptImageLiteImageRun = \(payload = \{\}\) =>/)
  assert.match(source, /if \(isGptImageLiteImageRun\(payload\)\) \{[\s\S]*const imageTaskId = buildLocalImageRunTaskId\(run\.id\)[\s\S]*bindImageTaskOwnership\([\s\S]*queueImageLiteRunExecution\([\s\S]*status: 'running'[\s\S]*task_id: imageTaskId/)
  assert.match(source, /persistImageResultAssets\(providerResponse, \{ persistInlineDataUrls: true \}\)/)
  assert.match(source, /waitUntil\(executeQueuedImageRun\(params\)\)/)
  assert.match(source, /findGeneratedMediaRecordByRunId/)
  assert.match(source, /if \(isLocalImageRunTaskId\(taskId\)\) \{[\s\S]*return getLocalImageRunTaskResult\(\{ userId: _userId, taskId, runId \}\)/)
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
