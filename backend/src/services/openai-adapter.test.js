import assert from 'node:assert/strict'
import test from 'node:test'

import { OpenAiProviderAdapter } from './providers/openai.adapter.js'

test('OpenAI adapter creates GPT Image 2 async image tasks', async () => {
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
    const result = await new OpenAiProviderAdapter().imageGeneration(
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
  assert.equal(requests[0].method, 'POST')
  assert.equal(requests[0].body.model, 'gpt-image-2')
  assert.equal(requests[0].body.size, '1024x1024')
  assert.equal(Object.hasOwn(requests[0].body, 'resolution'), false)
})

test('OpenAI adapter creates GPT Image 2 async edit tasks with multipart images', async () => {
  const originalFetch = global.fetch
  const imageDataUrl = `data:image/png;base64,${Buffer.from('image bytes').toString('base64')}`
  const requests = []

  global.fetch = async (url, init) => {
    const formEntries = Array.from(init?.body?.entries?.() || [])
    requests.push({
      url: String(url),
      method: init?.method || 'GET',
      entries: formEntries.map(([key, value]) => [
        key,
        typeof value === 'string'
          ? value
          : {
              name: value.name,
              type: value.type
            }
      ])
    })

    return new Response(
      JSON.stringify({ data: { taskId: 'gpt-edit-task-1' } }),
      {
        status: 200,
        headers: { 'content-type': 'application/json' }
      }
    )
  }

  try {
    const result = await new OpenAiProviderAdapter().imageGeneration(
      {
        model: 'gpt-image-2',
        prompt: 'Change the backdrop',
        images: [imageDataUrl],
        ratio: '1:1',
        resolution: '1k'
      },
      { apiKey: 'sk-test' }
    )

    assert.equal(result.task_id, 'gpt-edit-task-1')
    assert.equal(result.status, 'running')
  } finally {
    global.fetch = originalFetch
  }

  assert.equal(requests.length, 1)
  assert.match(requests[0].url, /\/v1\/images\/edits\?async=true$/)
  assert.equal(requests[0].method, 'POST')
  assert.deepEqual(requests[0].entries.find(([key]) => key === 'model'), ['model', 'gpt-image-2'])
  assert.deepEqual(requests[0].entries.find(([key]) => key === 'prompt'), ['prompt', 'Change the backdrop'])
  assert.deepEqual(requests[0].entries.find(([key]) => key === 'size'), ['size', '1024x1024'])
  assert.deepEqual(requests[0].entries.find(([key]) => key === 'image'), [
    'image',
    {
      name: 'image-1.png',
      type: 'image/png'
    }
  ])
})

test('OpenAI adapter polls GPT Image 2 async results as processing when provider is pending', async () => {
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
    const result = await new OpenAiProviderAdapter().pollTaskStatus('gpt-task-1', {
      apiKey: 'sk-test',
      model: 'gpt-image-2'
    })

    assert.deepEqual(result, {
      task_id: 'gpt-task-1',
      status: 'processing',
      message: '',
      raw: {
        status: 409,
        message: 'result pending'
      }
    })
  } finally {
    global.fetch = originalFetch
  }

  assert.equal(requests.length, 1)
  assert.match(requests[0], /\/v1\/async_result\?task_id=gpt-task-1$/)
})

test('OpenAI adapter falls back to root async result path for GPT Image 2 status', async () => {
  const originalFetch = global.fetch
  const requests = []

  global.fetch = async (url) => {
    requests.push(String(url))

    if (String(url).includes('/v1/async_result')) {
      return new Response(
        JSON.stringify({ message: 'Cannot GET /v1/async_result' }),
        {
          status: 404,
          headers: { 'content-type': 'application/json' }
        }
      )
    }

    return new Response(
      JSON.stringify({
        content_type: 'image/png',
        data: 'https://file.302.ai/gpt/imgs/fallback-result.png',
        err: '',
        status_code: 200
      }),
      {
        status: 200,
        headers: { 'content-type': 'application/json' }
      }
    )
  }

  try {
    const result = await new OpenAiProviderAdapter().pollTaskStatus('gpt-task-1', {
      apiKey: 'sk-test',
      model: 'gpt-image-2'
    })

    assert.equal(result.task_id, 'gpt-task-1')
    assert.equal(result.status, 'completed')
    assert.equal(result.data[0].url, 'https://file.302.ai/gpt/imgs/fallback-result.png')
  } finally {
    global.fetch = originalFetch
  }

  assert.equal(requests.length, 2)
  assert.match(requests[0], /\/v1\/async_result\?task_id=gpt-task-1$/)
  assert.match(requests[1], /\/async_result\?task_id=gpt-task-1$/)
})

test('OpenAI adapter returns completed GPT Image 2 image results', async () => {
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
    const result = await new OpenAiProviderAdapter().pollTaskStatus('gpt-task-1', {
      apiKey: 'sk-test',
      model: 'gpt-image-2'
    })

    assert.equal(result.task_id, 'gpt-task-1')
    assert.equal(result.status, 'completed')
    assert.equal(result.data[0].url, 'https://file.302.ai/gpt/imgs/result.png')
  } finally {
    global.fetch = originalFetch
  }
})

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
