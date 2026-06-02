import assert from 'node:assert/strict'
import { randomBytes } from 'node:crypto'
import test from 'node:test'
import sharp from 'sharp'

import { providerGenerateImage } from './provider.service.js'

test('GPT Image lite generation calls derouter synchronous image endpoint', async () => {
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
        created: 1760000000,
        data: [{ b64_json: 'aW1hZ2UtYnl0ZXM=' }]
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
        model: 'gpt-image-lite',
        prompt: 'A product shot',
        ratio: '1:1',
        resolution: '1k',
        quality: 'medium'
      },
      {
        derouterApiBaseUrl: 'https://derouter.test/openai/v1',
        derouterApiKey: 'sk-derouter'
      }
    )

    assert.equal(result.provider, 'derouter')
    assert.equal(result.data[0].url, 'data:image/png;base64,aW1hZ2UtYnl0ZXM=')
  } finally {
    global.fetch = originalFetch
  }

  assert.equal(requests.length, 1)
  assert.equal(requests[0].url, 'https://derouter.test/openai/v1/images/generations')
  assert.equal(requests[0].method, 'POST')
  assert.equal(requests[0].headers.Authorization, 'Bearer sk-derouter')
  assert.equal(requests[0].body.model, 'gpt-image-2')
  assert.equal(requests[0].body.prompt, 'A product shot')
  assert.equal(requests[0].body.size, '1024x1024')
  assert.equal(requests[0].body.quality, 'medium')
  assert.equal(Object.hasOwn(requests[0].body, 'resolution'), false)
})

test('GPT Image lite edit calls derouter multipart image endpoint', async () => {
  const originalFetch = global.fetch
  const requests = []

  global.fetch = async (url, init) => {
    requests.push({
      url: String(url),
      method: init?.method || 'GET',
      headers: init?.headers || {},
      body: init?.body
    })

    return new Response(
      JSON.stringify({
        data: [{ b64_json: 'ZWRpdGVkLWltYWdl' }]
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
        model: 'gpt-image-lite',
        prompt: 'Add a hat',
        image: 'data:image/png;base64,aW5wdXQtaW1hZ2U=',
        ratio: '1:1',
        resolution: '1k',
        quality: 'high'
      },
      {
        derouterApiBaseUrl: 'https://derouter.test/openai/v1',
        derouterApiKey: 'sk-derouter'
      }
    )

    assert.equal(result.provider, 'derouter')
    assert.equal(result.data[0].url, 'data:image/png;base64,ZWRpdGVkLWltYWdl')
  } finally {
    global.fetch = originalFetch
  }

  assert.equal(requests.length, 1)
  assert.equal(requests[0].url, 'https://derouter.test/openai/v1/images/edits')
  assert.equal(requests[0].method, 'POST')
  assert.equal(requests[0].headers.Authorization, 'Bearer sk-derouter')
  assert.equal(requests[0].body.get('model'), 'gpt-image-2')
  assert.equal(requests[0].body.get('prompt'), 'Add a hat')
  assert.equal(requests[0].body.get('size'), '1024x1024')
  assert.equal(requests[0].body.get('quality'), 'high')
  assert.ok(requests[0].body.get('image') instanceof Blob)
})

test('GPT Image lite edit compresses large reference images before derouter multipart upload', async () => {
  const originalFetch = global.fetch
  const requests = []
  const width = 2048
  const height = 2048
  const noisySource = randomBytes(width * height * 3)
  const sourcePng = await sharp(noisySource, {
    raw: { width, height, channels: 3 }
  }).png({ compressionLevel: 0 }).toBuffer()

  global.fetch = async (url, init) => {
    requests.push({
      url: String(url),
      method: init?.method || 'GET',
      headers: init?.headers || {},
      body: init?.body
    })

    return new Response(
      JSON.stringify({
        data: [{ b64_json: 'ZWRpdGVkLWltYWdl' }]
      }),
      {
        status: 200,
        headers: { 'content-type': 'application/json' }
      }
    )
  }

  try {
    await providerGenerateImage(
      {
        model: 'gpt-image-lite',
        prompt: 'Use this reference',
        image: `data:image/png;base64,${sourcePng.toString('base64')}`,
        ratio: '1:1',
        resolution: '1k',
        quality: 'medium'
      },
      {
        derouterApiBaseUrl: 'https://derouter.test/openai/v1',
        derouterApiKey: 'sk-derouter'
      }
    )
  } finally {
    global.fetch = originalFetch
  }

  assert.equal(requests.length, 1)
  assert.equal(requests[0].url, 'https://derouter.test/openai/v1/images/edits')
  const image = requests[0].body.get('image')
  assert.ok(image instanceof Blob)
  assert.equal(image.type, 'image/jpeg')
  assert.ok(image.size < 4 * 1024 * 1024, `optimized reference image should stay below 4MB, got ${image.size}`)
})

test('GPT Image lite reports derouter 413 without leaking upstream HTML', async () => {
  const originalFetch = global.fetch

  global.fetch = async () => new Response(
    '<html><head><title>413 Request Entity Too Large</title></head><body><center><h1>413 Request Entity Too Large</h1></center><hr><center>nginx</center></body></html>',
    {
      status: 413,
      headers: { 'content-type': 'text/html' }
    }
  )

  try {
    await assert.rejects(
      () => providerGenerateImage(
        {
          model: 'gpt-image-lite',
          prompt: 'Use this reference',
          image: 'data:image/png;base64,aW5wdXQtaW1hZ2U=',
          ratio: '1:1',
          resolution: '1k',
          quality: 'medium'
        },
        {
          derouterApiBaseUrl: 'https://derouter.test/openai/v1',
          derouterApiKey: 'sk-derouter'
        }
      ),
      (error) => {
        assert.equal(error.status, 413)
        assert.doesNotMatch(error.message, /<html|<body|nginx/i)
        assert.match(error.message, /derouter.*too large|reference image/i)
        return true
      }
    )
  } finally {
    global.fetch = originalFetch
  }
})

test('GPT Image lite keeps derouter upstream timeout above the documented 240s boundary', async () => {
  const originalFetch = global.fetch
  const originalSetTimeout = global.setTimeout
  const originalClearTimeout = global.clearTimeout
  const timeoutDelays = []

  global.fetch = async () => new Response(
    JSON.stringify({
      data: [{ b64_json: 'aW1hZ2UtYnl0ZXM=' }]
    }),
    {
      status: 200,
      headers: { 'content-type': 'application/json' }
    }
  )
  global.setTimeout = (_callback, delay) => {
    timeoutDelays.push(delay)
    return { delay }
  }
  global.clearTimeout = () => {}

  try {
    await providerGenerateImage(
      {
        model: 'gpt-image-lite',
        prompt: 'A slow render',
        ratio: '1:1',
        resolution: '2k',
        quality: 'high'
      },
      {
        derouterApiBaseUrl: 'https://derouter.test/openai/v1',
        derouterApiKey: 'sk-derouter',
        derouterTimeoutMs: 240000
      }
    )
  } finally {
    global.fetch = originalFetch
    global.setTimeout = originalSetTimeout
    global.clearTimeout = originalClearTimeout
  }

  assert.equal(timeoutDelays[0], 300000)
})

test('GPT Image lite reports derouter timeout aborts as gateway timeout errors', async () => {
  const originalFetch = global.fetch
  const originalSetTimeout = global.setTimeout
  const originalClearTimeout = global.clearTimeout
  const timeoutDelays = []

  global.fetch = async (_url, init = {}) => new Promise((_resolve, reject) => {
    const rejectAbort = () => {
      const error = new Error('This operation was aborted')
      error.name = 'AbortError'
      reject(error)
    }
    if (init.signal?.aborted) {
      rejectAbort()
      return
    }
    init.signal?.addEventListener?.('abort', rejectAbort, { once: true })
  })
  global.setTimeout = (callback, delay) => {
    timeoutDelays.push(delay)
    queueMicrotask(callback)
    return { delay }
  }
  global.clearTimeout = () => {}

  try {
    await assert.rejects(
      () => providerGenerateImage(
        {
          model: 'gpt-image-lite',
          prompt: 'A slow render',
          ratio: '1:1',
          resolution: '2k',
          quality: 'high'
        },
        {
          derouterApiBaseUrl: 'https://derouter.test/openai/v1',
          derouterApiKey: 'sk-derouter',
          derouterTimeoutMs: 240000
        }
      ),
      (error) => {
        assert.equal(error.status, 504)
        assert.equal(error.code, 'DEROUTER_TIMEOUT')
        assert.doesNotMatch(error.message, /This operation was aborted/i)
        assert.match(error.message, /timed out/i)
        return true
      }
    )
  } finally {
    global.fetch = originalFetch
    global.setTimeout = originalSetTimeout
    global.clearTimeout = originalClearTimeout
  }

  assert.equal(timeoutDelays[0], 300000)
})
