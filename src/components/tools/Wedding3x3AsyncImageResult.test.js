import assert from 'node:assert/strict'
import test from 'node:test'

import {
  extractWedding3x3GeneratedImageUrl,
  extractWedding3x3ImageTaskId,
  isWedding3x3AsyncImageModel,
  waitForWedding3x3AsyncImageResult
} from './Wedding3x3AsyncImageResult.js'

test('wedding 3x3 async image helpers identify async image models case-insensitively', () => {
  assert.equal(isWedding3x3AsyncImageModel('gemini-3.1-flash-image-preview'), true)
  assert.equal(isWedding3x3AsyncImageModel(' Gemini-3-Pro-Image-Preview '), true)
  assert.equal(isWedding3x3AsyncImageModel('gpt-image-2'), false)
  assert.equal(isWedding3x3AsyncImageModel(''), false)
})

test('wedding 3x3 async image helpers extract task ids from provider aliases', () => {
  assert.equal(extractWedding3x3ImageTaskId({ task_id: ' task-a ' }), 'task-a')
  assert.equal(extractWedding3x3ImageTaskId({ data: { taskId: 'task-b' } }), 'task-b')
  assert.equal(extractWedding3x3ImageTaskId({ raw: { data: { id: 'task-c' } } }), 'task-c')
  assert.equal(extractWedding3x3ImageTaskId({ data: { task_id: '' }, raw: { id: null } }), '')
})

test('wedding 3x3 async image helpers extract generated image urls from common response shapes', () => {
  assert.equal(extractWedding3x3GeneratedImageUrl({ data: [{ url: '' }, { url: ' https://image.example/a.png ' }] }), 'https://image.example/a.png')
  assert.equal(extractWedding3x3GeneratedImageUrl({ image_url: 'https://image.example/b.png' }), 'https://image.example/b.png')
  assert.equal(extractWedding3x3GeneratedImageUrl({ data: { url: 'https://image.example/c.png' } }), 'https://image.example/c.png')
  assert.equal(extractWedding3x3GeneratedImageUrl({ raw: { data: { url: 'https://image.example/d.png' } } }), 'https://image.example/d.png')
  assert.equal(extractWedding3x3GeneratedImageUrl({ raw: { url: '   ' } }), '')
})

test('wedding 3x3 async image polling returns the first response with a generated image url', async () => {
  const calls = []
  const sleeps = []
  const result = await waitForWedding3x3AsyncImageResult(' task-123 ', {
    attempts: 3,
    intervalMs: 25,
    getTask: async (taskId, options) => {
      calls.push({ taskId, options })
      return calls.length === 1
        ? { status: 'processing', message: 'still running' }
        : { status: 'completed', data: [{ url: 'https://image.example/final.png' }] }
    },
    sleep: async (ms) => {
      sleeps.push(ms)
    }
  })

  assert.equal(result.status, 'completed')
  assert.deepEqual(calls, [
    { taskId: 'task-123', options: { timeout: 45000 } },
    { taskId: 'task-123', options: { timeout: 45000 } }
  ])
  assert.deepEqual(sleeps, [25])
})

test('wedding 3x3 async image polling throws provider failures and timeout messages', async () => {
  await assert.rejects(
    waitForWedding3x3AsyncImageResult('task-failed', {
      getTask: async () => ({ status: 'failed', message: 'provider rejected' }),
      sleep: async () => {}
    }),
    /provider rejected/
  )

  await assert.rejects(
    waitForWedding3x3AsyncImageResult('task-timeout', {
      attempts: 2,
      intervalMs: 1,
      getTask: async () => ({ status: 'processing', message: 'queued' }),
      sleep: async () => {}
    }),
    /queued/
  )

  await assert.rejects(
    waitForWedding3x3AsyncImageResult('', {
      getTask: async () => ({ status: 'completed' }),
      sleep: async () => {}
    }),
    /Image task id is missing/
  )
})
