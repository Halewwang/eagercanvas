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

test('GPT Image lite generation omits derouter default image params', async () => {
  const originalFetch = global.fetch
  const requests = []

  global.fetch = async (url, init) => {
    requests.push({
      url: String(url),
      body: init?.body ? JSON.parse(init.body) : null
    })

    return new Response(
      JSON.stringify({
        data: [{ b64_json: 'aW1hZ2UtYnl0ZXM=' }]
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
        prompt: 'A product shot',
        ratio: '1:1',
        resolution: '1k',
        quality: 'auto',
        background: 'auto',
        output_format: 'png',
        moderation: 'auto'
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
  assert.deepEqual(Object.keys(requests[0].body).sort(), ['model', 'prompt', 'size'])
  assert.equal(requests[0].body.size, '1024x1024')
})

test('GPT Image lite 400 errors log a safe derouter request summary', async () => {
  const originalFetch = global.fetch
  const originalWarn = console.warn
  const warnings = []

  global.fetch = async () => new Response(
    JSON.stringify({ error: { message: 'invalid size' } }),
    {
      status: 400,
      headers: { 'content-type': 'application/json' }
    }
  )
  console.warn = (...args) => warnings.push(args)

  try {
    await assert.rejects(
      () => providerGenerateImage(
        {
          model: 'gpt-image-lite',
          prompt: 'Do not log this prompt',
          ratio: '16:9',
          resolution: '2k',
          quality: 'high',
          output_format: 'webp'
        },
        {
          derouterApiBaseUrl: 'https://derouter.test/openai/v1',
          derouterApiKey: 'sk-derouter'
        }
      ),
      (error) => {
        assert.equal(error.status, 400)
        assert.equal(error.code, 'DEROUTER_ERROR')
        return true
      }
    )
  } finally {
    global.fetch = originalFetch
    console.warn = originalWarn
  }

  assert.equal(warnings.length, 1)
  assert.equal(warnings[0][0], '[derouter] image request failed')
  assert.deepEqual(warnings[0][1], {
    status: 400,
    path: '/images/generations',
    multipart: false,
    model: 'gpt-image-2',
    size: '2560x1440',
    quality: 'high',
    output_format: 'webp',
    imageCount: 0,
    message: 'invalid size'
  })
  assert.doesNotMatch(JSON.stringify(warnings), /Do not log this prompt|sk-derouter/)
})

test('GPT Image lite retries derouter upstream server_error once with request id logging', async () => {
  const originalFetch = global.fetch
  const originalWarn = console.warn
  const requests = []
  const warnings = []

  global.fetch = async (url, init) => {
    requests.push({ url: String(url), body: init?.body ? JSON.parse(init.body) : null })
    if (requests.length === 1) {
      return new Response(
        JSON.stringify({
          error: {
            code: 'server_error',
            message: 'api_error: server_error: An error occurred while processing your request. Please include the request ID 6a46778df057-466a-9404-b19938d1502c in your message. (code=server_error)'
          }
        }),
        {
          status: 400,
          headers: { 'content-type': 'application/json' }
        }
      )
    }

    return new Response(
      JSON.stringify({
        data: [{ b64_json: 'cmV0cmllZC1pbWFnZQ==' }]
      }),
      {
        status: 200,
        headers: { 'content-type': 'application/json' }
      }
    )
  }
  console.warn = (...args) => warnings.push(args)

  try {
    const result = await providerGenerateImage(
      {
        model: 'gpt-image-lite',
        prompt: 'Do not log retry prompt',
        ratio: '1:1',
        resolution: '1k',
        quality: 'medium'
      },
      {
        derouterApiBaseUrl: 'https://derouter.test/openai/v1',
        derouterApiKey: 'sk-derouter'
      }
    )

    assert.equal(result.data[0].url, 'data:image/png;base64,cmV0cmllZC1pbWFnZQ==')
  } finally {
    global.fetch = originalFetch
    console.warn = originalWarn
  }

  assert.equal(requests.length, 2)
  assert.equal(warnings.length, 1)
  assert.deepEqual(warnings[0][1], {
    status: 400,
    path: '/images/generations',
    multipart: false,
    model: 'gpt-image-2',
    size: '1024x1024',
    quality: 'medium',
    imageCount: 0,
    message: 'api_error: server_error: An error occurred while processing your request. Please include the request ID 6a46778df057-466a-9404-b19938d1502c in your message. (code=server_error)',
    code: 'server_error',
    requestId: '6a46778df057-466a-9404-b19938d1502c',
    attempt: 1,
    retrying: true
  })
  assert.doesNotMatch(JSON.stringify(warnings), /Do not log retry prompt|sk-derouter/)
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
  const originalWarn = console.warn

  global.fetch = async () => new Response(
    '<html><head><title>413 Request Entity Too Large</title></head><body><center><h1>413 Request Entity Too Large</h1></center><hr><center>nginx</center></body></html>',
    {
      status: 413,
      headers: { 'content-type': 'text/html' }
    }
  )
  console.warn = () => {}

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
    console.warn = originalWarn
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
