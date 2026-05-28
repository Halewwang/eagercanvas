import assert from 'node:assert/strict'
import test from 'node:test'

import { providerGenerateImage, providerImageStatus } from './provider.service.js'

test('GPT Image 2 create returns async task without polling result endpoint', async () => {
  const originalFetch = global.fetch
  const requests = []

  global.fetch = async (url, init) => {
    requests.push({
      url: String(url),
      method: init?.method || 'GET',
      body: init?.body ? JSON.parse(init.body) : null
    })

    return new Response(
      JSON.stringify({ task_id: 'gpt-task-1' }),
      {
        status: 200,
        headers: { 'content-type': 'application/json' }
      }
    )
  }

  try {
    const result = await providerGenerateImage(
      {
        model: 'gpt-image-2',
        prompt: 'A product shot',
        ratio: '1:1',
        resolution: '1k'
      },
      { apiKey: 'sk-test' }
    )

    assert.equal(result.task_id, 'gpt-task-1')
    assert.equal(result.status, 'running')
  } finally {
    global.fetch = originalFetch
  }

  assert.equal(requests.length, 1)
  assert.match(requests[0].url, /\/v1\/images\/generations\?async=true$/)
  assert.equal(requests[0].body.model, 'gpt-image-2')
})

test('GPT Image 2 status treats provider result pending as processing', async () => {
  const originalFetch = global.fetch
  const requests = []

  global.fetch = async (url) => {
    requests.push(String(url))

    return new Response(
      JSON.stringify({ message: 'result pending' }),
      {
        status: 409,
        headers: { 'content-type': 'application/json' }
      }
    )
  }

  try {
    const result = await providerImageStatus('gpt-task-1', { apiKey: 'sk-test', model: 'gpt-image-2' })
    assert.equal(result.task_id, 'gpt-task-1')
    assert.equal(result.status, 'processing')
    assert.equal(result.message, '')
  } finally {
    global.fetch = originalFetch
  }

  assert.equal(requests.length, 1)
  assert.match(requests[0], /\/v1\/async_result\?task_id=gpt-task-1$/)
})

test('GPT Image 2 status treats official err pending body as processing', async () => {
  const originalFetch = global.fetch

  global.fetch = async () => new Response(
    JSON.stringify({
      content_type: '',
      data: '',
      err: 'result pending',
      status_code: 400
    }),
    {
      status: 200,
      headers: { 'content-type': 'application/json' }
    }
  )

  try {
    const result = await providerImageStatus('gpt-task-1', { apiKey: 'sk-test', model: 'gpt-image-2' })
    assert.equal(result.task_id, 'gpt-task-1')
    assert.equal(result.status, 'processing')
    assert.equal(result.message, '')
  } finally {
    global.fetch = originalFetch
  }
})

test('GPT Image 2 status returns completed image from async result', async () => {
  const originalFetch = global.fetch

  global.fetch = async () => new Response(
    JSON.stringify({
      content_type: 'image/png',
      data: 'https://file.302.ai/gpt/imgs/result.png',
      err: '',
      status_code: 200
    }),
    {
      status: 200,
      headers: { 'content-type': 'application/json' }
    }
  )

  try {
    const result = await providerImageStatus('gpt-task-1', { apiKey: 'sk-test', model: 'gpt-image-2' })
    assert.equal(result.status, 'completed')
    assert.equal(result.data[0].url, 'https://file.302.ai/gpt/imgs/result.png')
  } finally {
    global.fetch = originalFetch
  }
})
