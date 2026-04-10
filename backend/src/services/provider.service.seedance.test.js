import assert from 'node:assert/strict'
import test from 'node:test'

import { providerCreateVideo, providerVideoStatus } from './provider.service.js'

test('Seedance 2.0 create uses dedicated volcengine endpoint and content payload', async () => {
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
        id: 'cgt-20260403112523-rt66c'
      }),
      {
        status: 200,
        headers: {
          'content-type': 'application/json'
        }
      }
    )
  }

    try {
    const result = await providerCreateVideo(
      {
        model: 'seedance-2.0',
        prompt: 'make it cinematic',
        duration: 11,
        resolution: '720p',
        ratio: '16:9',
        generate_audio: true,
        images: ['https://example.com/ref-image.png'],
        videos: ['https://example.com/ref-video.mp4'],
        audio_urls: ['https://example.com/ref-audio.mp3'],
        watermark: false
      },
      { apiKey: 'sk-test' }
    )

    assert.equal(result.task_id, 'cgt-20260403112523-rt66c')
    assert.equal(result.status, 'processing')
  } finally {
    global.fetch = originalFetch
  }

  assert.equal(requests.length, 1)
  assert.match(requests[0].url, /\/volcengine\/api\/v3\/contents\/generations\/tasks$/)
  assert.equal(requests[0].body?.model, 'doubao-seedance-2-0-260128')
  assert.equal(requests[0].body?.ratio, '16:9')
  assert.equal(requests[0].body?.generate_audio, true)
  assert.equal(requests[0].body?.watermark, false)
  assert.deepEqual(requests[0].body?.content, [
    { type: 'text', text: 'make it cinematic' },
    {
      type: 'image_url',
      image_url: { url: 'https://example.com/ref-image.png' },
      role: 'reference_image'
    },
    {
      type: 'video_url',
      video_url: { url: 'https://example.com/ref-video.mp4' },
      role: 'reference_video'
    },
    {
      type: 'audio_url',
      audio_url: { url: 'https://example.com/ref-audio.mp3' },
      role: 'reference_audio'
    }
  ])
})

test('Seedance 2.0 status uses dedicated volcengine endpoint and content.video_url', async () => {
  const originalFetch = global.fetch
  const requests = []

  global.fetch = async (url) => {
    requests.push(String(url))

    return new Response(
      JSON.stringify({
        id: 'cgt-20260403112523-rt66c',
        model: 'doubao-seedance-2-0-260128',
        status: 'succeeded',
        content: {
          video_url: 'https://example.com/video.mp4'
        },
        usage: {
          completion_tokens: 411300,
          total_tokens: 411300
        },
        seed: '4829',
        resolution: '720p',
        duration: 11,
        ratio: '16:9',
        created_at: '1775186764',
        updated_at: '1775187235',
        framespersecond: 24
      }),
      {
        status: 200,
        headers: {
          'content-type': 'application/json'
        }
      }
    )
  }

  try {
    const result = await providerVideoStatus('cgt-20260403112523-rt66c', { apiKey: 'sk-test' })
    assert.equal(result.status, 'completed')
    assert.equal(result.video_url, 'https://example.com/video.mp4')
  } finally {
    global.fetch = originalFetch
  }

  assert.equal(requests.length, 1)
  assert.match(requests[0], /\/volcengine\/api\/v3\/contents\/generations\/tasks\/cgt-20260403112523-rt66c$/)
})
