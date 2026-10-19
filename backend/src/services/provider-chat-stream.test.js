import assert from 'node:assert/strict'
import test from 'node:test'

import { providerChatCompletions, providerChatCompletionsStream } from './provider.service.js'

const options = { openaiApiKey: 'enbrand-test-key', apiKey: 'old-302-key' }
const completed = {
  id: 'response-test', status: 'completed',
  output: [{ content: [{ type: 'output_text', text: 'Hi' }] }],
  usage: { input_tokens: 1, output_tokens: 1, total_tokens: 2 }
}

test('provider text calls use enbrand Responses and fixed GPT 5.6 sol without storage', async () => {
  const originalFetch = global.fetch
  const requests = []
  global.fetch = async (url, init) => {
    requests.push({ url: String(url), body: JSON.parse(init.body), headers: init.headers })
    return Response.json(completed)
  }
  try {
    const result = await providerChatCompletions({ model: 'retired-model', messages: [{ role: 'user', content: 'hello' }] }, options)
    assert.equal(result.choices[0].message.content, 'Hi')
    assert.equal(requests.length, 1)
    assert.equal(requests[0].url, 'https://api.enbrand.co/v1/responses')
    assert.equal(requests[0].headers.Authorization, 'Bearer enbrand-test-key')
    assert.equal(requests[0].body.model, 'gpt-5.6-sol')
    assert.equal(requests[0].body.store, false)
    assert.equal(requests[0].body.stream, false)
  } finally {
    global.fetch = originalFetch
  }
})

test('provider text streams translate Responses events into the existing chat SSE contract', async () => {
  const originalFetch = global.fetch
  let request
  global.fetch = async (url, init) => {
    request = { url: String(url), body: JSON.parse(init.body) }
    return new Response(`event: response.completed\ndata: ${JSON.stringify({ type: 'response.completed', response: completed })}\n\n`, {
      headers: { 'content-type': 'text/event-stream' }
    })
  }
  try {
    const response = await providerChatCompletionsStream({ messages: [{ role: 'user', content: 'hello' }] }, options)
    const body = await response.text()
    assert.match(body, /"delta":\{"content":"Hi"\}/)
    assert.match(body, /data: \[DONE\]/)
    assert.equal(request.url, 'https://api.enbrand.co/v1/responses')
    assert.equal(request.body.stream, true)
    assert.equal(request.body.store, false)
  } finally {
    global.fetch = originalFetch
  }
})
