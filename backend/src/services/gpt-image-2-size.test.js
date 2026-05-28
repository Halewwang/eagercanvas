import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildGptImage2AsyncResultPath,
  buildGptImage2RequestBody,
  extractGptImage2TaskId,
  isGptImage2PendingResult,
  resolveGptImage2Size
} from './gpt-image-2-size.js'

test('resolves GPT Image 2 capsule resolution to provider size', () => {
  assert.equal(resolveGptImage2Size({ ratio: '1:1', resolution: '1k' }), '1024x1024')
  assert.equal(resolveGptImage2Size({ ratio: '1:1', resolution: '2k' }), '2048x2048')
  assert.equal(resolveGptImage2Size({ ratio: '1:1', resolution: '4k' }), '2880x2880')
})

test('keeps GPT Image 2 4K output under provider limits', () => {
  const size = resolveGptImage2Size({ ratio: '16:9', resolution: '4k' })
  const [width, height] = size.split('x').map(Number)

  assert.equal(size, '3840x2160')
  assert.ok(Math.max(width, height) <= 3840)
  assert.ok(width * height <= 8_300_000)
})

test('supports Gemini-matching GPT Image 2 aspect ratios', () => {
  assert.equal(resolveGptImage2Size({ ratio: '4:3', resolution: '1k' }), '1152x864')
  assert.equal(resolveGptImage2Size({ ratio: '3:4', resolution: '1k' }), '864x1152')
  assert.equal(resolveGptImage2Size({ ratio: '4:5', resolution: '1k' }), '896x1120')
  assert.equal(resolveGptImage2Size({ ratio: '5:4', resolution: '1k' }), '1120x896')
  assert.equal(resolveGptImage2Size({ ratio: '21:9', resolution: '4k' }), '3840x1645')
})

test('builds GPT Image 2 request body with supported advanced params', () => {
  assert.deepEqual(
    buildGptImage2RequestBody({
      prompt: 'A product shot',
      ratio: '9:16',
      resolution: '4k',
      quality: 'high',
      background: 'transparent',
      output_format: 'webp'
    }),
    {
      model: 'gpt-image-2',
      prompt: 'A product shot',
      size: '2160x3840',
      quality: 'high',
      background: 'transparent',
      output_format: 'webp',
      n: 1,
      moderation: 'auto',
      output_compression: 100
    }
  )
})

test('extracts GPT Image 2 async task ids from common response shapes', () => {
  assert.equal(extractGptImage2TaskId({ task_id: 'task-a' }), 'task-a')
  assert.equal(extractGptImage2TaskId({ data: { taskId: 'task-b' } }), 'task-b')
  assert.equal(extractGptImage2TaskId({ id: 'task-c' }), 'task-c')
})

test('recognizes GPT Image 2 pending async result responses', () => {
  assert.equal(isGptImage2PendingResult({ message: 'result pending' }), true)
  assert.equal(isGptImage2PendingResult({ err: 'result pending' }), true)
  assert.equal(isGptImage2PendingResult({ error: { message: 'result pending' } }), true)
  assert.equal(isGptImage2PendingResult({ data: { err: 'result pending' } }), true)
  assert.equal(isGptImage2PendingResult({ data: { status: 'queued' } }), true)
  assert.equal(isGptImage2PendingResult({ status: 'processing' }), true)
  assert.equal(isGptImage2PendingResult({ data: 'https://file.302.ai/result.png' }), false)
})

test('builds GPT Image 2 async result path under v1 namespace', () => {
  assert.equal(buildGptImage2AsyncResultPath('task 1'), '/v1/async_result?task_id=task%201')
})
