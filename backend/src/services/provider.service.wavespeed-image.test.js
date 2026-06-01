import assert from 'node:assert/strict'
import test from 'node:test'

import { providerGenerateImage, providerImageStatus } from './provider.service.js'

test('Wavespeed image creation returns a pollable task from 302 response data', async () => {
  const originalFetch = global.fetch
  const requests = []

  global.fetch = async (url, init) => {
    requests.push({
      url: String(url),
      method: init?.method || 'GET',
      headers: init?.headers || {},
      body: init?.body ? JSON.parse(init.body) : null
    })

    return new Response(
      JSON.stringify({
        code: 200,
        message: 'success',
        data: {
          id: '7c731914a25f4700b4fa6ecd6f7c41bd',
          model: 'wavespeed-ai/ghibli',
          outputs: [],
          urls: {
            get: 'https://api.302.ai/ws/api/v3/predictions/7c731914a25f4700b4fa6ecd6f7c41bd/result'
          },
          status: 'created',
          error: ''
        }
      }),
      {
        status: 200,
        headers: { 'content-type': 'application/json' }
      }
    )
  }

  try {
    const result = await providerGenerateImage(
      {
        model: 'wavespeed-ai/ghibli',
        prompt: 'A soft product image',
        size: '1024x1024',
        enable_sync_mode: false,
        enable_base64_output: false
      },
      { apiKey: 'sk-test' }
    )

    assert.equal(result.task_id, '7c731914a25f4700b4fa6ecd6f7c41bd')
    assert.equal(result.status, 'created')
  } finally {
    global.fetch = originalFetch
  }

  assert.equal(requests.length, 1)
  assert.match(requests[0].url, /\/ws\/api\/v3\/wavespeed-ai\/ghibli$/)
  assert.equal(requests[0].body.model, undefined)
  assert.equal(requests[0].body.prompt, 'A soft product image')
  assert.equal(requests[0].body.enable_sync_mode, false)
  assert.equal(requests[0].body.enable_base64_output, false)
})

test('Wavespeed image status returns completed outputs from 302 response data', async () => {
  const originalFetch = global.fetch

  global.fetch = async () => new Response(
    JSON.stringify({
      code: 200,
      message: 'success',
      data: {
        id: '7c731914a25f4700b4fa6ecd6f7c41bd',
        model: 'wavespeed-ai/ghibli',
        outputs: ['https://file.302.ai/gpt/imgs/result.png'],
        status: 'completed',
        error: ''
      }
    }),
    {
      status: 200,
      headers: { 'content-type': 'application/json' }
    }
  )

  try {
    const result = await providerImageStatus('7c731914a25f4700b4fa6ecd6f7c41bd', { apiKey: 'sk-test' })
    assert.equal(result.status, 'completed')
    assert.equal(result.data[0].url, 'https://file.302.ai/gpt/imgs/result.png')
  } finally {
    global.fetch = originalFetch
  }
})
