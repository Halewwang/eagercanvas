import assert from 'node:assert/strict'
import test from 'node:test'

import {
  createWedding3x3ApplyPayload,
  createWedding3x3PendingPayload,
  runWedding3x3Generation
} from './Wedding3x3GenerationRunner.js'

const baseOutput = {
  output: {
    prompt: 'A structured wedding product prompt'
  },
  meta: {
    sample: true
  }
}

const baseRunInput = {
  imageSource: 'https://cdn.example.com/reference.png',
  model: 'gpt-image-2',
  output: baseOutput,
  quality: 'high',
  ratio: '3:2',
  resolution: '2k',
  size: '2048x1365'
}

test('wedding 3x3 generation runner builds pending payloads from current output metadata', () => {
  assert.deepEqual(createWedding3x3PendingPayload(baseRunInput), {
    targetMode: 'new',
    model: 'gpt-image-2',
    size: '2048x1365',
    ratio: '3:2',
    resolution: '2k',
    quality: 'high',
    fileType: 'image/png',
    label: 'Wedding 3x3 Result',
    sourcePrompt: 'A structured wedding product prompt',
    sourceRefImages: ['https://cdn.example.com/reference.png'],
    meta: {
      tool: 'wedding-3x3',
      json: baseOutput
    }
  })
})

test('wedding 3x3 generation runner builds apply payloads with the generated image url', () => {
  assert.deepEqual(
    createWedding3x3ApplyPayload({
      ...baseRunInput,
      url: ' https://cdn.example.com/result.png '
    }),
    {
      targetMode: 'new',
      model: 'gpt-image-2',
      url: 'https://cdn.example.com/result.png',
      base64: '',
      fileType: 'image/png',
      size: '2048x1365',
      ratio: '3:2',
      resolution: '2k',
      quality: 'high',
      label: 'Wedding 3x3 Result',
      sourcePrompt: 'A structured wedding product prompt',
      sourceRefImages: ['https://cdn.example.com/reference.png'],
      meta: {
        tool: 'wedding-3x3',
        json: baseOutput
      }
    }
  )
})

test('wedding 3x3 generation runner uses synchronous image generation for non async models', async () => {
  const calls = []
  const url = await runWedding3x3Generation({
    ...baseRunInput,
    imageGen: {
      generate: async (payload) => {
        calls.push(payload)
        return [{ url: 'https://cdn.example.com/sync.png' }]
      }
    }
  })

  assert.equal(url, 'https://cdn.example.com/sync.png')
  assert.deepEqual(calls, [
    {
      model: 'gpt-image-2',
      prompt: 'A structured wedding product prompt',
      image: 'https://cdn.example.com/reference.png',
      size: '2048x1365',
      ratio: '3:2',
      aspect_ratio: '3:2',
      resolution: '2k',
      quality: 'high',
      enable_sync_mode: true,
      enable_base64_output: false
    }
  ])
})

test('wedding 3x3 generation runner polls async image task results when no immediate url is returned', async () => {
  const calls = []
  const url = await runWedding3x3Generation({
    ...baseRunInput,
    model: 'gemini-3.1-flash-image-preview',
    createRun: async (payload) => {
      calls.push(['create', payload])
      return { result: { task_id: 'task-123' } }
    },
    getTask: async (taskId, options) => {
      calls.push(['task', taskId, options])
      return { status: 'completed', data: [{ url: 'https://cdn.example.com/async.png' }] }
    },
    pollOptions: {
      attempts: 1,
      intervalMs: 1,
      sleep: async () => {}
    }
  })

  assert.equal(url, 'https://cdn.example.com/async.png')
  assert.deepEqual(calls, [
    [
      'create',
      {
        model: 'gemini-3.1-flash-image-preview',
        prompt: 'A structured wedding product prompt',
        image: 'https://cdn.example.com/reference.png',
        size: '2048x1365',
        ratio: '3:2',
        aspect_ratio: '3:2',
        resolution: '2k',
        quality: 'high',
        enable_sync_mode: false,
        enable_base64_output: false
      }
    ],
    ['task', 'task-123', { timeout: 45000 }]
  ])
})

test('wedding 3x3 generation runner rejects empty model output', async () => {
  await assert.rejects(
    runWedding3x3Generation({
      ...baseRunInput,
      imageGen: {
        generate: async () => ({ url: '   ' })
      }
    }),
    /No image output from model/
  )
})
