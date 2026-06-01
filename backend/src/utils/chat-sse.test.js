import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildChatCompletionSseEvents,
  extractChatCompletionText,
  formatSseData,
  readChatCompletionSseStream
} from './chat-sse.js'

test('chat SSE helpers extract assistant text from provider completion payloads', () => {
  assert.equal(
    extractChatCompletionText({
      choices: [
        {
          message: {
            content: 'Hello from provider'
          }
        }
      ]
    }),
    'Hello from provider'
  )

  assert.equal(
    extractChatCompletionText({
      output: [
        {
          content: [{ text: 'Hello from output parts' }]
        }
      ]
    }),
    'Hello from output parts'
  )
})

test('chat SSE helpers format delta events and the done sentinel', () => {
  assert.equal(
    formatSseData({ choices: [{ delta: { content: 'Hi' } }] }),
    'data: {"choices":[{"delta":{"content":"Hi"}}]}\n\n'
  )
  assert.deepEqual(
    buildChatCompletionSseEvents({ choices: [{ message: { content: 'Hi' } }] }),
    [
      'data: {"choices":[{"delta":{"content":"Hi"}}]}\n\n',
      'data: [DONE]\n\n'
    ]
  )
})

test('chat SSE stream reader yields provider events and accumulates assistant text', async () => {
  const response = new Response(
    new ReadableStream({
      start(controller) {
        controller.enqueue(new TextEncoder().encode('data: {"id":"chatcmpl-1","choices":[{"delta":{"content":"Hel"}}]}\n\n'))
        controller.enqueue(new TextEncoder().encode('data: {"choices":[{"delta":{"content":"lo"},"finish_reason":"stop"}],"usage":{"prompt_tokens":2,"completion_tokens":1}}\n\n'))
        controller.enqueue(new TextEncoder().encode('data: [DONE]\n\n'))
        controller.close()
      }
    }),
    { headers: { 'content-type': 'text/event-stream' } }
  )

  const events = []
  for await (const event of readChatCompletionSseStream(response)) {
    events.push(event)
  }

  assert.deepEqual(events.map((event) => event.type), ['data', 'data', 'done'])
  assert.deepEqual(events.map((event) => event.delta), ['Hel', 'lo', ''])
  assert.equal(events[1].usage.prompt_tokens, 2)
  assert.equal(events[1].finishReason, 'stop')
})
