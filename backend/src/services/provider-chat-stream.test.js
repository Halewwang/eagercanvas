import assert from 'node:assert/strict'
import test from 'node:test'

import { providerChatCompletionsStream } from './provider.service.js'

test('provider chat stream requests provider SSE with stream enabled', async () => {
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
      new ReadableStream({
        start(controller) {
          controller.enqueue(new TextEncoder().encode('data: {"choices":[{"delta":{"content":"Hi"}}]}\n\n'))
          controller.enqueue(new TextEncoder().encode('data: [DONE]\n\n'))
          controller.close()
        }
      }),
      {
        status: 200,
        headers: { 'content-type': 'text/event-stream' }
      }
    )
  }

  try {
    const response = await providerChatCompletionsStream(
      {
        model: 'gemini-2.5-flash',
        messages: [{ role: 'user', content: 'hello' }],
        stream: false
      },
      { apiKey: 'sk-test' }
    )

    assert.equal(response.ok, true)
    assert.equal(response.headers.get('content-type'), 'text/event-stream')
  } finally {
    global.fetch = originalFetch
  }

  assert.equal(requests.length, 1)
  assert.match(requests[0].url, /\/v1\/chat\/completions$/)
  assert.equal(requests[0].method, 'POST')
  assert.equal(requests[0].body.stream, true)
  assert.equal(requests[0].body.stream_options.include_usage, true)
})
