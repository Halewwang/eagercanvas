import assert from 'node:assert/strict'
import test from 'node:test'

import { OpenAiProviderAdapter } from './providers/openai.adapter.js'

test('OpenAI adapter creates Sora video tasks through the OpenAI video endpoint', async () => {
  const originalFetch = global.fetch
  const requests = []

  global.fetch = async (url, init) => {
    requests.push({
      url: String(url),
      method: init?.method || 'GET',
      body: init?.body ? JSON.parse(init.body) : null
    })

    return new Response(
      JSON.stringify({
        id: 'video_abc123',
        status: 'queued'
      }),
      {
        status: 200,
        headers: { 'content-type': 'application/json' }
      }
    )
  }

  try {
    const result = await new OpenAiProviderAdapter().videoGeneration(
      {
        model: 'sora2',
        prompt: 'A gentle camera move',
        size: '9:16',
        seconds: 12,
        images: ['https://example.com/reference.png'],
        callback: 'https://example.com/callback'
      },
      { apiKey: 'sk-test' }
    )

    assert.equal(result.task_id, 'video_abc123')
    assert.equal(result.status, 'processing')
  } finally {
    global.fetch = originalFetch
  }

  assert.equal(requests.length, 1)
  assert.match(requests[0].url, /\/openai\/v1\/videos$/)
  assert.equal(requests[0].method, 'POST')
  assert.deepEqual(requests[0].body, {
    prompt: 'A gentle camera move',
    model: 'sora-2',
    seconds: 12,
    size: '720x1280',
    input_reference: 'https://example.com/reference.png',
    callback: 'https://example.com/callback'
  })
})

test('OpenAI adapter polls Sora status and fetches completed video content', async () => {
  const originalFetch = global.fetch
  const requests = []

  global.fetch = async (url) => {
    requests.push(String(url))
    if (String(url).includes('/content?variant=video')) {
      return new Response(
        JSON.stringify({
          download: {
            url: 'https://example.com/sora-video.mp4'
          }
        }),
        {
          status: 200,
          headers: { 'content-type': 'application/json' }
        }
      )
    }

    return new Response(
      JSON.stringify({
        id: 'video_abc123',
        status: 'completed'
      }),
      {
        status: 200,
        headers: { 'content-type': 'application/json' }
      }
    )
  }

  try {
    const result = await new OpenAiProviderAdapter().pollTaskStatus('task:video_abc123', {
      apiKey: 'sk-test',
      model: 'sora-2'
    })

    assert.equal(result.task_id, 'task:video_abc123')
    assert.equal(result.status, 'completed')
    assert.equal(result.video_url, 'https://example.com/sora-video.mp4')
    assert.equal(result.raw.content.download.url, 'https://example.com/sora-video.mp4')
  } finally {
    global.fetch = originalFetch
  }

  assert.equal(requests.length, 2)
  assert.match(requests[0], /\/openai\/v1\/videos\/video_abc123$/)
  assert.match(requests[1], /\/openai\/v1\/videos\/video_abc123\/content\?variant=video$/)
})
