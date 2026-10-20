import assert from 'node:assert/strict'
import test from 'node:test'

import { env } from '../../config/env.js'
import { readChatCompletionSseStream } from '../../utils/chat-sse.js'
import {
  createEnbrandChatCompletion,
  createEnbrandChatCompletionStream
} from './enbrand.adapter.js'

const options = { openaiApiKey: 'enbrand-test-key' }
const completion = (text = 'Hello') => ({
  id: 'resp-test',
  status: 'completed',
  output: [{ type: 'message', content: [{ type: 'output_text', text }] }],
  usage: { input_tokens: 3, output_tokens: 2, total_tokens: 5 }
})
const jsonResponse = (body, init = {}) => new Response(JSON.stringify(body), {
  headers: { 'content-type': 'application/json', 'x-request-id': 'req-test' },
  ...init
})
const sse = (type, body = {}) => `event: ${type}\ndata: ${JSON.stringify({ type, ...body })}\n\n`
const withFetch = async (fetchImpl, fn) => {
  const original = global.fetch
  global.fetch = fetchImpl
  try {
    return await fn()
  } finally {
    global.fetch = original
  }
}
const readEvents = async (response) => {
  const events = []
  for await (const event of readChatCompletionSseStream(response)) events.push(event)
  return events
}

test('Enbrand uses only its own credentials and exact Responses model/payload', async () => {
  await withFetch(async (url, init) => {
    assert.equal(String(url), 'https://api.enbrand.co/v1/responses')
    assert.equal(init.headers.Authorization, 'Bearer enbrand-test-key')
    assert.deepEqual(JSON.parse(init.body), {
      model: 'gpt-5.6-sol',
      store: false,
      stream: false,
      input: [
        { role: 'system', content: 'Be concise' },
        { role: 'user', content: [
          { type: 'input_text', text: 'What is this?' },
          { type: 'input_image', image_url: 'data:image/png;base64,aGVsbG8=', detail: 'low' }
        ] }
      ],
      max_output_tokens: 50
    })
    return jsonResponse(completion())
  }, async () => {
    const result = await createEnbrandChatCompletion({
      model: 'legacy-model',
      messages: [
        { role: 'system', content: 'Be concise' },
        { role: 'user', content: [
          { type: 'text', text: 'What is this?' },
          { type: 'image_url', image_url: { url: 'data:image/png;base64,aGVsbG8=', detail: 'low' } }
        ] }
      ],
      max_tokens: 50,
      store: true,
      stream_options: { include_usage: true },
      unsupported_legacy_field: true
    }, { ...options, apiKey: 'old-provider-key', baseUrl: 'https://old-provider.example' })
    assert.equal(result.choices[0].message.content, 'Hello')
    assert.equal(result.choices[0].finish_reason, 'stop')
    assert.equal(result.request_id, 'req-test')
    assert.equal(result.raw.request_id, 'req-test')
    assert.equal(result.usage.prompt_tokens, 3)
    assert.equal(result.usage.completion_tokens, 2)
    assert.equal(result.usage.total_tokens, 5)
  })
})

test('Enbrand cannot inherit a legacy provider key when OpenAI is unconfigured', async () => {
  const previous = env.openaiApiKey
  env.openaiApiKey = ''
  try {
    await withFetch(() => assert.fail('must fail before network'), async () => {
      await assert.rejects(createEnbrandChatCompletion({ messages: [] }, { apiKey: 'old-key' }), {
        code: 'OPENAI_NOT_CONFIGURED'
      })
    })
  } finally {
    env.openaiApiKey = previous
  }
})

test('Responses preserves assistant text as output_text across multiple turns', async () => {
  await withFetch(async (_url, init) => {
    assert.deepEqual(JSON.parse(init.body).input, [
      { role: 'user', content: [{ type: 'input_text', text: 'First question' }] },
      { role: 'assistant', content: [{ type: 'output_text', text: 'Previous answer' }] },
      { role: 'user', content: 'Follow-up question' }
    ])
    return jsonResponse(completion())
  }, async () => {
    await createEnbrandChatCompletion({ messages: [
      { role: 'user', content: [{ type: 'text', text: 'First question' }] },
      { role: 'assistant', content: [{ type: 'text', text: 'Previous answer' }] },
      { role: 'user', content: 'Follow-up question' }
    ] }, options)
  })
})

test('Responses honors max_completion_tokens with explicit Responses limits taking priority', async () => {
  const limits = [
    [{ max_completion_tokens: 80 }, 80],
    [{ max_tokens: 40, max_completion_tokens: 80 }, 80],
    [{ max_tokens: 40, max_completion_tokens: 80, max_output_tokens: 120 }, 120]
  ]
  for (const [payload, expected] of limits) {
    await withFetch(async (_url, init) => {
      const body = JSON.parse(init.body)
      assert.equal(body.max_output_tokens, expected)
      assert.equal(Object.hasOwn(body, 'max_completion_tokens'), false)
      assert.equal(Object.hasOwn(body, 'max_tokens'), false)
      return jsonResponse(completion())
    }, () => createEnbrandChatCompletion({ messages: [], ...payload }, options))
  }
})

test('nonstream completion aggregates gateway SSE even with JSON content type and a tail without delimiter', async () => {
  const body = sse('response.created', { response: { id: 'resp-test' } }) +
    sse('response.output_text.delta', { delta: 'Hel' }) +
    sse('response.output_text.delta', { delta: 'lo' }) +
    sse('response.completed', { response: completion() }).trimEnd()
  await withFetch(() => new Response(body, { headers: { 'content-type': 'application/json' } }), async () => {
    const result = await createEnbrandChatCompletion({ messages: [{ role: 'user', content: 'Hi' }] }, options)
    assert.equal(result.choices[0].message.content, 'Hello')
    assert.equal(result.usage.prompt_tokens, 3)
  })
})

test('stream converts chunked Responses deltas and undelimited completion usage to ChatCompletion SSE', async () => {
  const text = sse('response.created', { response: { id: 'resp-test' } }) +
    sse('response.output_text.delta', { delta: '你' }) +
    sse('response.output_text.delta', { delta: '好' }) +
    sse('response.completed', { response: completion('你好') }).trimEnd()
  const bytes = new TextEncoder().encode(text)
  await withFetch(async (url, init) => {
    assert.equal(JSON.parse(init.body).stream, true)
    assert.equal(Object.hasOwn(JSON.parse(init.body), 'stream_options'), false)
    return new Response(new ReadableStream({ start(controller) {
      for (let i = 0; i < bytes.length; i += 7) controller.enqueue(bytes.slice(i, i + 7))
      controller.close()
    } }), { headers: { 'content-type': 'text/event-stream', 'x-request-id': 'req-stream', 'content-length': '999' } })
  }, async () => {
    const response = await createEnbrandChatCompletionStream({ messages: [] }, options)
    assert.equal(response.headers.get('x-request-id'), 'req-stream')
    assert.equal(response.headers.get('content-length'), null)
    const events = await readEvents(response)
    assert.equal(events.map((event) => event.delta).join(''), '你好')
    assert.equal(events.find((event) => event.usage)?.usage.completion_tokens, 2)
    assert.equal(events.find((event) => event.finishReason)?.finishReason, 'stop')
    assert.equal(events.at(-1).type, 'done')
  })
})

test('stream supports a JSON completion fallback', async () => {
  await withFetch(() => jsonResponse(completion()), async () => {
    const events = await readEvents(await createEnbrandChatCompletionStream({ messages: [] }, options))
    assert.equal(events.map((event) => event.delta).join(''), 'Hello')
    assert.equal(events.at(-1).type, 'done')
  })
})

for (const stream of [false, true]) {
  for (const [label, body, code] of [
    ['failed', sse('response.failed', { response: { status: 'failed', error: { message: 'Upstream failed' } } }), 'PROVIDER_ERROR'],
    ['incomplete', sse('response.incomplete', { response: { status: 'incomplete', incomplete_details: { reason: 'max_output_tokens' } } }), 'PROVIDER_RESPONSE_INCOMPLETE'],
    ['empty', sse('response.completed', { response: completion('') }), 'NO_TEXT_OUTPUT'],
    ['interrupted', sse('response.output_text.delta', { delta: 'Partial' }), 'PROVIDER_STREAM_INTERRUPTED']
  ]) {
    test(`${stream ? 'stream' : 'nonstream'} rejects ${label} Responses output`, async () => {
      await withFetch(() => new Response(body, { headers: { 'content-type': 'text/event-stream' } }), async () => {
        if (stream) {
          await assert.rejects(readEvents(await createEnbrandChatCompletionStream({ messages: [] }, options)), { code })
        } else {
          await assert.rejects(createEnbrandChatCompletion({ messages: [] }, options), { code })
        }
      })
    })
  }
}

test('Responses HTTP errors preserve status and request metadata', async () => {
  await withFetch(() => jsonResponse({ error: { message: 'Quota exceeded' } }, {
    status: 429,
    headers: { 'x-request-id': 'req-error' }
  }), async () => {
    await assert.rejects(createEnbrandChatCompletion({ messages: [] }, options), (error) => {
      assert.equal(error.status, 429)
      assert.equal(error.message, 'Quota exceeded')
      assert.equal(error.request_id, 'req-error')
      return true
    })
  })
})

test('stream timeout remains active after response headers until its body finishes', async () => {
  let signal
  await withFetch(async (_url, init) => {
    signal = init.signal
    return new Response(new ReadableStream({ start(controller) {
      signal.addEventListener('abort', () => controller.error(signal.reason), { once: true })
    } }), { headers: { 'content-type': 'text/event-stream' } })
  }, async () => {
    const response = await createEnbrandChatCompletionStream({ messages: [] }, { ...options, timeoutMs: 20 })
    await assert.rejects(readEvents(response), { name: 'AbortError' })
    assert.equal(signal.aborted, true)
  })
})

test('canceling a transformed stream aborts its upstream fetch', async () => {
  let signal
  let sourceCancelled = false
  await withFetch(async (_url, init) => {
    signal = init.signal
    return new Response(new ReadableStream({
      start(controller) {
        controller.enqueue(new TextEncoder().encode(sse('response.output_text.delta', { delta: 'Hello' })))
        signal.addEventListener('abort', () => controller.error(signal.reason), { once: true })
      },
      cancel() { sourceCancelled = true }
    }), { headers: { 'content-type': 'text/event-stream' } })
  }, async () => {
    const response = await createEnbrandChatCompletionStream({ messages: [] }, options)
    const reader = response.body.getReader()
    await reader.read()
    await reader.cancel()
    assert.equal(signal.aborted || sourceCancelled, true)
  })
})

test('caller abort and timeout both remain effective for nonstream body reading', async () => {
  const controller = new AbortController()
  await withFetch(async (_url, init) => new Response(new ReadableStream({ start(body) {
    init.signal.addEventListener('abort', () => body.error(init.signal.reason), { once: true })
  } }), { headers: { 'content-type': 'application/json' } }), async () => {
    const request = createEnbrandChatCompletion({ messages: [] }, { ...options, signal: controller.signal, timeoutMs: 1000 })
    controller.abort()
    await assert.rejects(request, { name: 'AbortError' })
  })
})
