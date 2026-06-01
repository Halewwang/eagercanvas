import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const chatApiUrl = new URL('./chat.js', import.meta.url)

const importChatApiWithMockedHttp = async (handler) => {
  globalThis.__chatStreamFetchHandler = handler
  globalThis.__chatStreamRequests = []

  const source = readFileSync(chatApiUrl, 'utf8')
    .replace(
      "import { apiRequest, fetchWithApiAuth, getApiBaseUrl } from './_httpClient.js'",
      [
        'const apiRequest = () => { throw new Error("apiRequest should not be used in stream tests") }',
        'const getApiBaseUrl = () => "https://api.test"',
        'const fetchWithApiAuth = (url, init) => {',
        '  globalThis.__chatStreamRequests.push({ url, init, body: JSON.parse(init.body) })',
        '  return globalThis.__chatStreamFetchHandler(url, init)',
        '}'
      ].join('\n')
    )

  return import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}#${Date.now()}-${Math.random()}`)
}

const sseResponse = (events, init = {}) => {
  const encoder = new TextEncoder()
  return new Response(new ReadableStream({
    start(controller) {
      for (const event of events) {
        controller.enqueue(encoder.encode(event))
      }
      controller.close()
    }
  }), {
    status: init.status || 200,
    headers: {
      'content-type': init.contentType || 'text/event-stream'
    }
  })
}

test('stream chat completions requests SSE and yields provider delta chunks', async () => {
  const { streamChatCompletions } = await importChatApiWithMockedHttp(async () =>
    sseResponse([
      'data: {"choices":[{"delta":{"content":"Hel"}}]}\n\n',
      'data: {"choices":[{"delta":{"content":"lo"}}]}\n\n',
      'data: [DONE]\n\n'
    ])
  )

  const chunks = []
  for await (const chunk of streamChatCompletions({ model: 'gemini', messages: [{ role: 'user', content: 'Hi' }] })) {
    chunks.push(chunk)
  }

  assert.deepEqual(chunks, ['Hel', 'lo'])
  assert.equal(globalThis.__chatStreamRequests[0].url, 'https://api.test/chat/completions')
  assert.equal(globalThis.__chatStreamRequests[0].body.stream, true)
})

test('stream chat completions surfaces SSE error payload messages', async () => {
  const { streamChatCompletions } = await importChatApiWithMockedHttp(async () =>
    sseResponse(['data: {"error":{"message":"rate limited"}}\n\n'])
  )

  await assert.rejects(
    async () => {
      for await (const _chunk of streamChatCompletions({ messages: [] })) {
        // consume stream
      }
    },
    /rate limited/
  )
})

test('stream chat completions surfaces HTTP 429 and 500 error messages', async () => {
  const cases = [
    { status: 429, body: { error: { message: 'Too many requests' } }, expected: /Too many requests/ },
    { status: 500, body: { message: 'Provider unavailable' }, expected: /Provider unavailable/ }
  ]

  for (const scenario of cases) {
    const { streamChatCompletions } = await importChatApiWithMockedHttp(async () =>
      new Response(JSON.stringify(scenario.body), {
        status: scenario.status,
        headers: { 'content-type': 'application/json' }
      })
    )

    await assert.rejects(
      async () => {
        for await (const _chunk of streamChatCompletions({ messages: [] })) {
          // consume stream
        }
      },
      scenario.expected
    )
  }
})

test('chat stream API no longer forces non-stream JSON fallback mode', () => {
  const source = readFileSync(chatApiUrl, 'utf8')

  assert.doesNotMatch(source, /stream:\s*false/)
  assert.doesNotMatch(source, /Backend currently returns JSON/)
  assert.doesNotMatch(source, /contentType\.includes\('application\/json'\)/)
})
