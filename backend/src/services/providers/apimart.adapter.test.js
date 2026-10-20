import assert from 'node:assert/strict'
import test from 'node:test'

import { env } from '../../config/env.js'
import { createApimartImage, getApimartImageTask } from './apimart.adapter.js'

const options = { apimartApiKey: 'apimart-test-key' }
const jsonResponse = (body, init = {}) => Response.json(body, { headers: { 'x-request-id': 'req-apimart' }, ...init })
const submitted = { code: 200, data: [{ status: 'submitted', task_id: 'task-image-1' }] }
const withFetch = async (fetchImpl, fn) => {
  const original = global.fetch
  global.fetch = fetchImpl
  try { return await fn() } finally { global.fetch = original }
}

test('APIMart submits only the documented JSON fields and returns its async task without polling', async () => {
  let requests = 0
  await withFetch((url, init) => {
    requests++
    assert.equal(String(url), 'https://api.apimart.ai/v1/images/generations')
    assert.equal(init.method, 'POST')
    assert.equal(init.headers.Authorization, 'Bearer apimart-test-key')
    assert.equal(init.headers['Content-Type'], 'application/json')
    assert.deepEqual(JSON.parse(init.body), { model: 'gpt-image-2', prompt: 'A landscape', n: 1, size: '16:9', resolution: '4k' })
    return jsonResponse(submitted)
  }, async () => {
    const result = await createApimartImage({ model: 'gpt-image-2', prompt: 'A landscape', size: '16:9', resolution: '4k', n: 2, quality: 'high', background: 'opaque', output_format: 'png', official_fallback: true, nsfw_check: true }, { ...options, openaiApiKey: 'unrelated-key', apiKey: 'retired-key' })
    assert.equal(result.task_id, 'task-image-1')
    assert.equal(result.status, 'submitted')
    assert.deepEqual(result.data, [])
    assert.equal(result.raw.code, 200)
    assert.equal(result.request_id, 'req-apimart')
  })
  assert.equal(requests, 1)
})

test('APIMart sends mixed references as image_urls JSON without downloading or multipart', async () => {
  const references = ['https://example.com/reference.png', 'data:image/png;base64,aW1hZ2U=']
  await withFetch((url, init) => {
    assert.equal(String(url), 'https://api.apimart.ai/v1/images/generations')
    assert.deepEqual(JSON.parse(init.body).image_urls, references)
    return jsonResponse(submitted)
  }, () => createApimartImage({ prompt: 'Combine these', images: references, size: '4:3', resolution: '2k' }, options))
})

test('APIMart cannot inherit OpenAI or retired provider keys', async () => {
  const originalKey = env.apimartApiKey
  env.apimartApiKey = ''
  try {
    await withFetch(() => assert.fail('must fail before network'), async () => {
      await assert.rejects(createApimartImage({ prompt: 'test' }, { apiKey: 'retired-key', openaiApiKey: 'enbrand-key' }), { status: 500, code: 'APIMART_NOT_CONFIGURED' })
      await assert.rejects(getApimartImageTask('task-image-1', { apiKey: 'retired-key', openaiApiKey: 'enbrand-key' }), { status: 500, code: 'APIMART_NOT_CONFIGURED' })
    })
  } finally { env.apimartApiKey = originalKey }
})

test('APIMart supports all fifteen references and rejects overflow before a request', async () => {
  const references = Array(15).fill('https://example.com/reference.png')
  await withFetch((_url, init) => {
    assert.equal(JSON.parse(init.body).image_urls.length, 15)
    return jsonResponse(submitted)
  }, () => createApimartImage({ prompt: 'Combine', image_urls: references }, options))
  await withFetch(() => assert.fail('must fail before network'), () => assert.rejects(createApimartImage({ prompt: 'Combine', image_urls: [...references, references[0]] }, options), { status: 400, code: 'TOO_MANY_IMAGES' }))
})

test('task queries encode their ID and flatten result image URL arrays without fetching results', async () => {
  let requests = 0
  await withFetch((url, init) => {
    requests++
    assert.equal(String(url), 'https://api.apimart.ai/v1/tasks/task%2Fimage%3F1')
    assert.equal(init.method, 'GET')
    assert.equal(init.body, undefined)
    return jsonResponse({ code: 200, data: { id: 'task/image?1', status: 'completed', progress: 100, result: { images: [{ url: ['https://example.com/first.png', 'https://example.com/second.png'] }, { url: 'https://example.com/third.png' }] } } })
  }, async () => {
    const result = await getApimartImageTask('task/image?1', options)
    assert.equal(result.task_id, 'task/image?1')
    assert.equal(result.status, 'completed')
    assert.equal(result.progress, 100)
    assert.deepEqual(result.data, [{ url: 'https://example.com/first.png' }, { url: 'https://example.com/second.png' }, { url: 'https://example.com/third.png' }])
  })
  assert.equal(requests, 1)
})

for (const status of ['submitted', 'pending', 'processing', 'failed', 'cancelled']) {
  test(`task query returns ${status} with progress and preserves failure details`, async () => {
    await withFetch(() => jsonResponse({ code: 200, data: { id: 'task-image-1', status, progress: 42, error: { code: 'provider_failure', message: 'Image safety check failed', type: 'upstream_error' } } }), async () => {
      const result = await getApimartImageTask('task-image-1', options)
      assert.equal(result.status, status === 'pending' ? 'submitted' : status)
      assert.equal(result.progress, 42)
      assert.deepEqual(result.data, [])
      if (status === 'failed' || status === 'cancelled') assert.equal(result.error.message, 'Image safety check failed')
    })
  })
}

test('task query rejects a completed task without usable images and unknown task states', async () => {
  for (const [data, code] of [[{ status: 'completed', result: { images: [{ url: [] }] } }, 'NO_IMAGE_OUTPUT'], [{ status: 'unexpected' }, 'PROVIDER_INVALID_RESPONSE']]) {
    await withFetch(() => jsonResponse({ code: 200, data }), () => assert.rejects(getApimartImageTask('task-image-1', options), { status: 502, code }))
  }
  await withFetch(() => assert.fail('empty IDs must not reach network'), () => assert.rejects(getApimartImageTask(''), { status: 400, code: 'IMAGE_TASK_ID_REQUIRED' }))
})

test('APIMart rejects HTTP errors and application errors inside HTTP 200 without retrying', async () => {
  for (const [status, body, expectedStatus] of [[429, { error: { code: 429, message: 'Rate limit exceeded' } }, 429], [200, { code: 402, error: { message: 'Insufficient credits' } }, 402], [200, { code: 500, message: 'Upstream failed' }, 500]]) {
    let requests = 0
    await withFetch(() => { requests++; return jsonResponse(body, { status }) }, async () => {
      await assert.rejects(createApimartImage({ prompt: 'test' }, options), error => {
        assert.equal(error.status, expectedStatus)
        assert.equal(error.code, 'PROVIDER_ERROR')
        assert.equal(error.message, body.error?.message || body.message)
        assert.equal(error.request_id, 'req-apimart')
        return true
      })
    })
    assert.equal(requests, 1)
  }
})

test('APIMart rejects invalid JSON and missing submission task identifiers', async () => {
  await withFetch(() => new Response('not json'), () => assert.rejects(createApimartImage({ prompt: 'test' }, options), { status: 502, code: 'PROVIDER_INVALID_RESPONSE' }))
  await withFetch(() => new Response('Access denied', { status: 401 }), () => assert.rejects(createApimartImage({ prompt: 'test' }, options), { status: 401, code: 'PROVIDER_ERROR' }))
  await withFetch(() => jsonResponse({ code: 200, data: [{ status: 'submitted' }] }), () => assert.rejects(createApimartImage({ prompt: 'test' }, options), { status: 502, code: 'IMAGE_TASK_ID_REQUIRED' }))
})

test('APIMart propagates network failures and pre-cancelled requests without another fetch', async () => {
  let requests = 0
  await withFetch(() => { requests++; throw new TypeError('Network unavailable') }, () => assert.rejects(createApimartImage({ prompt: 'test' }, options), /Network unavailable/))
  assert.equal(requests, 1)
  const controller = new AbortController()
  controller.abort()
  await withFetch(() => assert.fail('cancelled requests must not reach network'), () => assert.rejects(getApimartImageTask('task-image-1', { ...options, signal: controller.signal }), { name: 'AbortError' }))
})

test('APIMart preserves timeout and caller cancellation through response body reading', async () => {
  let signal
  await withFetch(async (_url, init) => {
    signal = init.signal
    return new Response(new ReadableStream({ start(controller) { signal.addEventListener('abort', () => controller.error(signal.reason), { once: true }) } }))
  }, async () => {
    await assert.rejects(createApimartImage({ prompt: 'test' }, { ...options, timeoutMs: 10 }), { name: 'AbortError' })
    assert.equal(signal.aborted, true)
  })
  const controller = new AbortController()
  await withFetch(async (_url, init) => new Response(new ReadableStream({ start(body) {
    init.signal.addEventListener('abort', () => body.error(init.signal.reason), { once: true })
  } })), async () => {
    const request = getApimartImageTask('task-image-1', { ...options, signal: controller.signal })
    controller.abort()
    await assert.rejects(request, { name: 'AbortError' })
  })
})
