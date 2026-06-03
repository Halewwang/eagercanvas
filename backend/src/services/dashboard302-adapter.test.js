import assert from 'node:assert/strict'
import test from 'node:test'

import { Dashboard302ProviderAdapter } from './providers/dashboard302.adapter.js'

test('Dashboard302 adapter creates Wavespeed image tasks from provider model paths', async () => {
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
        code: 200,
        data: {
          id: 'wavespeed-task-1',
          model: 'wavespeed-ai/ghibli',
          outputs: [],
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
    const result = await new Dashboard302ProviderAdapter().imageGeneration(
      {
        model: 'wavespeed-ai/ghibli',
        prompt: 'A soft product image',
        size: '1024x1024',
        style: 'natural',
        quality: 'standard',
        enable_sync_mode: false,
        enable_base64_output: false
      },
      { apiKey: 'sk-test' }
    )

    assert.equal(result.task_id, 'wavespeed-task-1')
    assert.equal(result.status, 'created')
  } finally {
    global.fetch = originalFetch
  }

  assert.equal(requests.length, 1)
  assert.match(requests[0].url, /\/ws\/api\/v3\/wavespeed-ai\/ghibli$/)
  assert.equal(requests[0].method, 'POST')
  assert.equal(requests[0].body.model, undefined)
  assert.equal(requests[0].body.model_name, undefined)
  assert.equal(requests[0].body.style, undefined)
  assert.equal(requests[0].body.quality, undefined)
  assert.equal(requests[0].body.prompt, 'A soft product image')
  assert.equal(requests[0].body.enable_sync_mode, false)
  assert.equal(requests[0].body.enable_base64_output, false)
})

test('Dashboard302 adapter creates Gemini preview image tasks through 302 endpoints', async () => {
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
          id: 'gemini-task-1',
          status: 'created',
          outputs: []
        }
      }),
      {
        status: 200,
        headers: { 'content-type': 'application/json' }
      }
    )
  }

  try {
    const result = await new Dashboard302ProviderAdapter().imageGeneration(
      {
        model: 'gemini-3.1-flash-image-preview',
        prompt: 'A soft product image',
        aspect_ratio: '4:3',
        resolution: '2k',
        enable_sync_mode: false,
        enable_base64_output: false
      },
      { apiKey: 'sk-test' }
    )

    assert.equal(result.task_id, 'gemini-task-1')
    assert.equal(result.status, 'created')
  } finally {
    global.fetch = originalFetch
  }

  assert.equal(requests.length, 1)
  assert.match(requests[0].url, /\/ws\/api\/v3\/google\/nano-banana-2\/text-to-image$/)
  assert.equal(requests[0].method, 'POST')
  assert.deepEqual(requests[0].body, {
    prompt: 'A soft product image',
    aspect_ratio: '4:3',
    resolution: '2k',
    enable_sync_mode: false,
    enable_base64_output: false
  })
})

test('Dashboard302 adapter sends Gemini image edits with references and tool parameters', async () => {
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
          images: [
            { url: 'https://example.com/generated.png' }
          ]
        }
      }),
      {
        status: 200,
        headers: { 'content-type': 'application/json' }
      }
    )
  }

  try {
    const result = await new Dashboard302ProviderAdapter().imageGeneration(
      {
        model: 'gemini-3-pro-image-preview',
        prompt: 'Adjust camera angle only',
        aspect_ratio: '16:9',
        resolution: '4k',
        images: ['https://example.com/source.png'],
        tools: { camera: { horizontal_angle: 270 } }
      },
      { apiKey: 'sk-test' }
    )

    assert.equal(result.data[0].url, 'https://example.com/generated.png')
  } finally {
    global.fetch = originalFetch
  }

  assert.equal(requests.length, 1)
  assert.match(requests[0].url, /\/ws\/api\/v3\/google\/gemini-3-pro-image\/text-to-image$/)
  assert.equal(requests[0].method, 'POST')
  assert.equal(requests[0].body.prompt, 'Adjust camera angle only')
  assert.equal(requests[0].body.aspect_ratio, '16:9')
  assert.equal(requests[0].body.resolution, '4k')
  assert.deepEqual(requests[0].body.images, ['https://example.com/source.png'])
  assert.deepEqual(requests[0].body.tools, { camera: { horizontal_angle: 270 } })
})

test('Dashboard302 adapter sends Gemini Pro text-to-image through the current 302 ws endpoint', async () => {
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
          outputs: ['https://example.com/generated-pro.png'],
          status: 'completed'
        }
      }),
      {
        status: 200,
        headers: { 'content-type': 'application/json' }
      }
    )
  }

  try {
    const result = await new Dashboard302ProviderAdapter().imageGeneration(
      {
        model: 'gemini-3-pro-image-preview',
        prompt: 'Create a product ad',
        aspect_ratio: '3:4',
        resolution: '2k'
      },
      { apiKey: 'sk-test' }
    )

    assert.equal(result.data[0].url, 'https://example.com/generated-pro.png')
  } finally {
    global.fetch = originalFetch
  }

  assert.equal(requests.length, 1)
  assert.match(requests[0].url, /\/ws\/api\/v3\/google\/gemini-3-pro-image\/text-to-image$/)
  assert.equal(requests[0].method, 'POST')
  assert.deepEqual(requests[0].body, {
    prompt: 'Create a product ad',
    aspect_ratio: '3:4',
    resolution: '2k',
    enable_sync_mode: true,
    enable_base64_output: false
  })
})

test('Dashboard302 adapter returns completed prediction image outputs', async () => {
  const originalFetch = global.fetch
  const requests = []

  global.fetch = async (url, init) => {
    requests.push({
      url: String(url),
      method: init?.method || 'GET'
    })

    return new Response(
      JSON.stringify({
        code: 200,
        data: {
          id: 'wavespeed-task-1',
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
  }

  try {
    const result = await new Dashboard302ProviderAdapter().pollTaskStatus('wavespeed-task-1', { apiKey: 'sk-test' })
    assert.equal(result.task_id, 'wavespeed-task-1')
    assert.equal(result.status, 'completed')
    assert.equal(result.data[0].url, 'https://file.302.ai/gpt/imgs/result.png')
  } finally {
    global.fetch = originalFetch
  }

  assert.equal(requests.length, 1)
  assert.match(requests[0].url, /\/ws\/api\/v3\/predictions\/wavespeed-task-1\/result$/)
  assert.equal(requests[0].method, 'GET')
})

test('Dashboard302 adapter creates Kling O1 image-to-video tasks with first-tail inputs', async () => {
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
        task: {
          task_id: 'kling_task_1',
          task_status: 10
        }
      }),
      {
        status: 200,
        headers: { 'content-type': 'application/json' }
      }
    )
  }

  try {
    const result = await new Dashboard302ProviderAdapter().videoGeneration(
      {
        model: 'kling-o1',
        prompt: 'Move the product camera',
        duration: 12,
        aspect_ratio: '4:3',
        first_frame_image: 'https://example.com/first.png',
        last_frame_image: 'https://example.com/last.png'
      },
      { apiKey: 'sk-test' }
    )

    assert.equal(result.task_id, 'kling_task_1')
    assert.equal(result.status, 'processing')
  } finally {
    global.fetch = originalFetch
  }

  assert.equal(requests.length, 1)
  assert.match(requests[0].url, /\/klingai\/m2v_omni_video$/)
  assert.equal(requests[0].method, 'POST')
  assert.deepEqual(requests[0].body, {
    images: ['https://example.com/first.png', 'https://example.com/last.png'],
    prompt: 'Move the product camera',
    duration: 10,
    aspect_ratio: 'auto',
    o1_type: 'firstTail',
    model: 'kling-o1'
  })
})

test('Dashboard302 adapter creates Kling O3 tasks with reference images and audio option', async () => {
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
        task_id: 'task_kling_o3',
        status: 'success'
      }),
      {
        status: 200,
        headers: { 'content-type': 'application/json' }
      }
    )
  }

  try {
    const result = await new Dashboard302ProviderAdapter().videoGeneration(
      {
        model: 'kling-o3',
        prompt: 'Animate the image',
        duration: 2,
        aspect_ratio: '4:3',
        first_frame_image: 'https://example.com/first.png',
        images: ['https://example.com/ref-1.png', 'https://example.com/ref-2.png'],
        mode: 'std',
        enable_audio: true
      },
      { apiKey: 'sk-test' }
    )

    assert.equal(result.task_id, 'task_kling_o3')
    assert.equal(result.status, 'completed')
  } finally {
    global.fetch = originalFetch
  }

  assert.equal(requests.length, 1)
  assert.match(requests[0].url, /\/klingai\/m2v_omni_3_video$/)
  assert.equal(requests[0].method, 'POST')
  assert.deepEqual(requests[0].body, {
    images: [
      'https://example.com/first.png',
      'https://example.com/ref-1.png',
      'https://example.com/ref-2.png'
    ],
    prompt: 'Animate the image',
    duration: 3,
    aspect_ratio: '16:9',
    mode: 'std',
    o1_type: 'referImage',
    enable_audio: true,
    model: 'kling-o3'
  })
})

test('Dashboard302 adapter polls Kling task status from Kling endpoints', async () => {
  const originalFetch = global.fetch
  const requests = []

  global.fetch = async (url, init) => {
    requests.push({
      url: String(url),
      method: init?.method || 'GET'
    })

    return new Response(
      JSON.stringify({
        data: {
          task: {
            task_status: 99
          },
          task_result: {
            video_url: 'https://example.com/kling.mp4'
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
    const result = await new Dashboard302ProviderAdapter().pollTaskStatus('task_kling_o3', { apiKey: 'sk-test' })

    assert.equal(result.task_id, 'task_kling_o3')
    assert.equal(result.status, 'completed')
    assert.equal(result.video_url, 'https://example.com/kling.mp4')
  } finally {
    global.fetch = originalFetch
  }

  assert.equal(requests.length, 1)
  assert.match(requests[0].url, /\/klingai\/task\/task_kling_o3\/fetch$/)
  assert.equal(requests[0].method, 'GET')
})

test('Dashboard302 adapter creates Topaz video enhance tasks with normalized output defaults', async () => {
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
        requestId: 'topaz-request-1'
      }),
      {
        status: 200,
        headers: { 'content-type': 'application/json' }
      }
    )
  }

  try {
    const result = await new Dashboard302ProviderAdapter().videoGeneration(
      {
        tool: 'enhance',
        file: 'https://example.com/input.mp4',
        model: 'prob-4',
        output: {
          frameRate: 0,
          audioTransfer: '',
          audioCodec: '',
          videoEncoder: '',
          videoProfile: '',
          dynamicCompressionLevel: ''
        }
      },
      { apiKey: 'sk-test' }
    )

    assert.equal(result.task_id, 'topaz-request-1')
    assert.equal(result.requestId, 'topaz-request-1')
    assert.equal(result.status, 'processing')
  } finally {
    global.fetch = originalFetch
  }

  assert.equal(requests.length, 1)
  assert.match(requests[0].url, /\/topazlabs\/video\/upload$/)
  assert.equal(requests[0].method, 'POST')
  assert.deepEqual(requests[0].body, {
    file: 'https://example.com/input.mp4',
    filters: [{ model: 'prob-4' }],
    output: {
      frameRate: 30,
      audioTransfer: 'Copy',
      audioCodec: 'AAC',
      videoEncoder: 'H265',
      videoProfile: 'Main',
      dynamicCompressionLevel: 'High'
    }
  })
})

test('Dashboard302 adapter polls Topaz enhance status and normalizes completed output', async () => {
  const originalFetch = global.fetch
  const requests = []

  global.fetch = async (url, init) => {
    requests.push({
      url: String(url),
      method: init?.method || 'GET'
    })

    return new Response(
      JSON.stringify({
        requestId: 'topaz-request-1',
        status: 'complete',
        download: {
          url: 'https://example.com/topaz.mp4'
        }
      }),
      {
        status: 200,
        headers: { 'content-type': 'application/json' }
      }
    )
  }

  try {
    const result = await new Dashboard302ProviderAdapter().pollTaskStatus('topaz-request-1', {
      apiKey: 'sk-test',
      statusProvider: 'topaz'
    })

    assert.equal(result.task_id, 'topaz-request-1')
    assert.equal(result.requestId, 'topaz-request-1')
    assert.equal(result.status, 'completed')
    assert.equal(result.video_url, 'https://example.com/topaz.mp4')
  } finally {
    global.fetch = originalFetch
  }

  assert.equal(requests.length, 1)
  assert.match(requests[0].url, /\/topazlabs\/video\/topaz-request-1\/status$/)
  assert.equal(requests[0].method, 'GET')
})
