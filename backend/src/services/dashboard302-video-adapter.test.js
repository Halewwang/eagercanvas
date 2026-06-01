import assert from 'node:assert/strict'
import test from 'node:test'

import { HttpError } from '../utils/http.js'
import { Dashboard302VideoProviderAdapter } from './providers/dashboard302-video.adapter.js'

test('Dashboard302 video adapter creates Veo 3.1 text-to-video tasks through the Wavespeed endpoint', async () => {
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
        data: {
          id: 'veo-task-1',
          status: 'created'
        }
      }),
      {
        status: 200,
        headers: { 'content-type': 'application/json' }
      }
    )
  }

  try {
    const result = await new Dashboard302VideoProviderAdapter().videoGeneration(
      {
        model: 'veo-3.1',
        prompt: 'Move the camera slowly',
        duration: 7,
        resolution: '720p',
        aspect_ratio: '9:16',
        generate_audio: true,
        seed: 123,
        negative_prompt: ' blurry ',
        callback: ' https://example.com/callback '
      },
      { apiKey: 'sk-test' }
    )

    assert.equal(result.task_id, 'veo-task-1')
    assert.equal(result.status, 'processing')
  } finally {
    global.fetch = originalFetch
  }

  assert.equal(requests.length, 1)
  assert.match(requests[0].url, /\/ws\/api\/v3\/google\/veo3\.1\/text-to-video$/)
  assert.equal(requests[0].method, 'POST')
  assert.deepEqual(requests[0].body, {
    prompt: 'Move the camera slowly',
    aspect_ratio: '9:16',
    duration: 8,
    resolution: '720p',
    generate_audio: true,
    model: 'veo3.1',
    seed: 123,
    negative_prompt: 'blurry',
    callback: 'https://example.com/callback'
  })
})

test('Dashboard302 video adapter creates Veo 3.1 image-to-video tasks with the first input image', async () => {
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
        task_id: 'veo-image-task',
        status: 'submitted'
      }),
      {
        status: 200,
        headers: { 'content-type': 'application/json' }
      }
    )
  }

  try {
    const result = await new Dashboard302VideoProviderAdapter().videoGeneration(
      {
        model_name: 'veo-3.1-pro',
        prompt: 'Animate this image',
        first_frame_image: 'https://example.com/first.png',
        images: ['https://example.com/ref.png'],
        last_frame_image: 'https://example.com/last.png'
      },
      { apiKey: 'sk-test' }
    )

    assert.equal(result.task_id, 'veo-image-task')
    assert.equal(result.status, 'processing')
  } finally {
    global.fetch = originalFetch
  }

  assert.equal(requests.length, 1)
  assert.match(requests[0].url, /\/ws\/api\/v3\/google\/veo3\.1\/image-to-video$/)
  assert.equal(requests[0].body.image, 'https://example.com/first.png')
  assert.equal(requests[0].body.model, 'veo3.1-pro')
  assert.equal(requests[0].body.duration, 8)
  assert.equal(requests[0].body.resolution, '1080p')
})

test('Dashboard302 video adapter falls back from missing Veo endpoints to 302 video APIs', async () => {
  const originalFetch = global.fetch
  const requests = []

  global.fetch = async (url, init) => {
    requests.push({
      url: String(url),
      method: init?.method || 'GET',
      body: init?.body ? JSON.parse(init.body) : null
    })

    if (String(url).endsWith('/ws/api/v3/google/veo3.1/image-to-video')) {
      return new Response(
        JSON.stringify({ message: 'not found' }),
        {
          status: 404,
          headers: { 'content-type': 'application/json' }
        }
      )
    }

    return new Response(
      JSON.stringify({
        task: {
          task_id: 'fallback-task',
          status: 'running'
        }
      }),
      {
        status: 200,
        headers: { 'content-type': 'application/json' }
      }
    )
  }

  try {
    const result = await new Dashboard302VideoProviderAdapter().videoGeneration(
      {
        model: 'veo-3.1',
        prompt: 'Animate the reference',
        image: 'https://example.com/source.png',
        duration: 4,
        enhance_prompt: false
      },
      { apiKey: 'sk-test' }
    )

    assert.equal(result.task_id, 'fallback-task')
    assert.equal(result.status, 'processing')
  } finally {
    global.fetch = originalFetch
  }

  assert.equal(requests.length, 2)
  assert.match(requests[0].url, /\/ws\/api\/v3\/google\/veo3\.1\/image-to-video$/)
  assert.match(requests[1].url, /\/302\/submit\/veo3-v2$/)
  assert.deepEqual(requests[1].body, {
    prompt: 'Animate the reference',
    model: 'veo3.1',
    enhance_prompt: false,
    aspect_ratio: '16:9',
    duration: 4,
    images: ['https://example.com/source.png']
  })
})

test('Dashboard302 video adapter maps unavailable Veo resources to a temporary model error', async () => {
  const originalFetch = global.fetch

  global.fetch = async () => new Response(
    JSON.stringify({ message: 'No available models currently.' }),
    {
      status: 503,
      headers: { 'content-type': 'application/json' }
    }
  )

  try {
    await assert.rejects(
      new Dashboard302VideoProviderAdapter().videoGeneration(
        {
          model: 'veo-3.1',
          prompt: 'Generate video'
        },
        { apiKey: 'sk-test' }
      ),
      (error) => {
        assert.ok(error instanceof HttpError)
        assert.equal(error.status, 503)
        assert.equal(error.code, 'MODEL_TEMPORARILY_UNAVAILABLE')
        assert.match(error.message, /供应商侧无可用资源/)
        return true
      }
    )
  } finally {
    global.fetch = originalFetch
  }
})

test('Dashboard302 video adapter creates generic 302 video tasks with frame images and negative prompt', async () => {
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
        id: 'generic-video-task',
        task_status: 'success'
      }),
      {
        status: 200,
        headers: { 'content-type': 'application/json' }
      }
    )
  }

  try {
    const result = await new Dashboard302VideoProviderAdapter().videoGeneration(
      {
        model: 'custom-video-model',
        prompt: 'Orbit the product',
        duration: 9,
        size: '16:9',
        resolution: '1080p',
        first_frame_image: 'https://example.com/first.png',
        images: ['https://example.com/ref.png'],
        last_frame_image: 'https://example.com/last.png',
        negative_prompt: ' low quality '
      },
      { apiKey: 'sk-test' }
    )

    assert.equal(result.task_id, 'generic-video-task')
    assert.equal(result.status, 'completed')
  } finally {
    global.fetch = originalFetch
  }

  assert.equal(requests.length, 1)
  assert.match(requests[0].url, /\/302\/v2\/video\/create$/)
  assert.deepEqual(requests[0].body, {
    prompt: 'Orbit the product',
    model: 'custom-video-model',
    duration: 9,
    aspect_ratio: '16:9',
    resolution: '1080p',
    image: ['https://example.com/first.png', 'https://example.com/ref.png'],
    end_image: 'https://example.com/last.png',
    negative_prompt: 'low quality'
  })
})

test('Dashboard302 video adapter polls Veo and generic video status from fallback endpoints', async () => {
  const originalFetch = global.fetch
  const requests = []

  global.fetch = async (url, init) => {
    requests.push({
      url: String(url),
      method: init?.method || 'GET'
    })

    if (String(url).includes('/ws/api/v3/predictions/video-task-1/result')) {
      return new Response(
        JSON.stringify({ message: 'unknown endpoint' }),
        {
          status: 404,
          headers: { 'content-type': 'application/json' }
        }
      )
    }

    return new Response(
      JSON.stringify({
        status: 'running',
        data: {
          task_result: {
            video_url: 'https://example.com/generated.mp4'
          }
        }
      }),
      {
        status: 200,
        headers: { 'content-type': 'application/json' }
      }
    )
  }

  try {
    const result = await new Dashboard302VideoProviderAdapter().pollTaskStatus('video-task-1', { apiKey: 'sk-test' })

    assert.equal(result.task_id, 'video-task-1')
    assert.equal(result.status, 'completed')
    assert.equal(result.video_url, 'https://example.com/generated.mp4')
  } finally {
    global.fetch = originalFetch
  }

  assert.equal(requests.length, 2)
  assert.match(requests[0].url, /\/ws\/api\/v3\/predictions\/video-task-1\/result$/)
  assert.match(requests[1].url, /\/302\/submit\/veo3-v2\/video-task-1$/)
  assert.equal(requests[1].method, 'GET')
})
