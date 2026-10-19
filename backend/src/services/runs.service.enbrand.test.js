import assert from 'node:assert/strict'
import { mock, test } from 'node:test'

import { env } from '../config/env.js'
import { supabase, supabaseStorage } from '../config/supabase.js'
import { createRun, getImageTask, getVideoTask, streamChatCompletion } from './runs.service.js'

const userId = 'user-enbrand'
const credentialId = 'service-active'
const createdAt = '2026-10-19T00:00:00.000Z'
const contextSymbol = Symbol.for('@vercel/request-context')
const textResult = {
  id: 'resp-enbrand',
  status: 'completed',
  output: [{ type: 'message', content: [{ type: 'output_text', text: 'Enbrand reply' }] }],
  usage: { input_tokens: 9, output_tokens: 4, total_tokens: 13 }
}

const withRunHarness = async (options, fn) => {
  const state = { queries: [], requests: [], runs: [], usage: [], audit: [], uploads: [], background: [], warnings: [] }
  const tables = { users: [{ id: userId, status: options.userStatus || 'active', deleted_at: null }], workflow_runs: state.runs, usage_events: state.usage, audit_logs: state.audit, usage_daily_agg: [] }
  const credential = { id: credentialId, user_id: userId, status: options.credentialStatus || 'active', provider_api_name: 'legacy-302-name-without-runtime-key' }
  const originalContext = globalThis[contextSymbol]
  const originalKey = env.openaiApiKey
  const originalProviderKey = env.providerApiKey
  env.openaiApiKey = 'enbrand-test-key'
  env.providerApiKey = 'shared-video-server-key'
  globalThis[contextSymbol] = { get: () => ({ waitUntil: promise => state.background.push(promise) }) }

  const from = mock.method(supabase, 'from', table => {
    assert.ok(table === 'user_service_credentials' || Object.hasOwn(tables, table), `Unexpected database table: ${table}`)
    const query = { table, operation: 'select', filters: [], payload: null }
    state.queries.push(query)
    const result = single => {
      let rows = table === 'user_service_credentials' ? [credential] : tables[table]
      rows = rows.filter(row => query.filters.every(([field, value]) => row[field] === value) && (!query.contains || Object.entries(query.contains).every(([key, value]) => row.metadata?.[key] === value)))
      if (query.operation === 'insert' || query.operation === 'upsert') {
        const row = { id: `${table}-${tables[table].length + 1}`, created_at: createdAt, ...query.payload }
        tables[table].push(row)
        return { data: single ? row : [row], error: null }
      }
      if (query.operation === 'update') rows.forEach(row => Object.assign(row, query.payload))
      return { data: single ? (rows[0] || null) : rows, error: null }
    }
    return {
      select() { return this },
      eq(field, value) { query.filters.push([field, value]); return this },
      order() { return this },
      limit() { return this },
      gte() { return this },
      lte() { return this },
      contains(_column, value) { query.contains = value; return this },
      insert(payload) { query.operation = 'insert'; query.payload = payload; return this },
      update(payload) { query.operation = 'update'; query.payload = payload; return this },
      upsert(payload) { query.operation = 'upsert'; query.payload = payload; return this },
      single() { return Promise.resolve(result(true)) },
      maybeSingle() { return Promise.resolve(result(true)) },
      then(resolve, reject) { return Promise.resolve(result(false)).then(resolve, reject) }
    }
  })
  const storage = mock.method(supabaseStorage.storage, 'from', bucket => {
    assert.equal(bucket, 'uploads')
    return {
      async upload(name, bytes, uploadOptions) {
        state.uploads.push({ name, bytes, options: uploadOptions })
        return { error: options.uploadFailure ? { message: 'Storage unavailable' } : null }
      },
      getPublicUrl(name) { return { data: { publicUrl: `https://storage.example/storage/v1/object/public/uploads/${name}` } } }
    }
  })
  const fetchMock = mock.method(globalThis, 'fetch', async (url, init) => {
    const request = { url: String(url), headers: init?.headers, body: init?.body ? JSON.parse(init.body) : null }
    state.requests.push(request)
    if (options.video) {
      assert.match(request.url, /\/(?:openai\/v1\/videos|topazlabs\/video)\b/)
      assert.equal(request.headers.Authorization, 'Bearer shared-video-server-key')
    } else {
      assert.ok(['https://api.enbrand.co/v1/responses', 'https://api.enbrand.co/v1/images/generations'].includes(request.url), `Unexpected provider request: ${request.url}`)
      assert.equal(request.headers.Authorization, 'Bearer enbrand-test-key')
    }
    return options.response(request)
  })
  const warn = mock.method(console, 'warn', (...args) => state.warnings.push(args.join(' ')))
  const error = mock.method(console, 'error', (...args) => state.warnings.push(args.join(' ')))
  try {
    await fn(state)
  } finally {
    await Promise.allSettled(state.background)
    error.mock.restore()
    warn.mock.restore()
    fetchMock.mock.restore()
    storage.mock.restore()
    from.mock.restore()
    env.openaiApiKey = originalKey
    env.providerApiKey = originalProviderKey
    if (originalContext === undefined) delete globalThis[contextSymbol]
    else globalThis[contextSymbol] = originalContext
  }
}

const assertEnbrandUsage = (usage, { model = 'gpt-5.6-sol', input = 9, output = 4 } = {}) => {
  assert.equal(usage.api_name, 'enbrand')
  assert.equal(usage.service_credential_id, credentialId)
  assert.equal(usage.model, model)
  assert.equal(usage.input_tokens, input)
  assert.equal(usage.output_tokens, output)
  assert.notEqual(usage.billing_status, 'billed')
  assert.equal(usage.cost_usd, 0)
  assert.equal(usage.billed_cost_usd, 0)
}

const assertOnlyActiveServiceLookup = state => {
  const credentialQueries = state.queries.filter(query => query.table === 'user_service_credentials')
  assert.equal(credentialQueries.length, 1)
  assert.deepEqual(credentialQueries[0].filters, [['user_id', userId]])
}

test('createRun authenticates active service and records enbrand text tokens without 302 billing lookup', async () => {
  await withRunHarness({ response: () => Response.json(textResult, { headers: { 'x-request-id': 'req-enbrand-chat' } }) }, async state => {
    const result = await createRun(userId, { type: 'chat', payload: { messages: [{ role: 'user', content: 'Hello' }] } })
    assert.equal(result.status, 'completed')
    assert.equal(result.result.choices[0].message.content, 'Enbrand reply')
    assertOnlyActiveServiceLookup(state)
    assert.equal(state.requests.length, 1)
    assert.equal(state.requests[0].url, 'https://api.enbrand.co/v1/responses')
    assert.equal(state.requests[0].body.model, 'gpt-5.6-sol')
    assert.equal(state.requests[0].body.store, false)
    assert.equal(state.requests[0].body.stream, false)
    assert.equal(state.usage.length, 1)
    assertEnbrandUsage(state.usage[0])
    assert.equal(state.usage[0].provider_request_id, 'req-enbrand-chat')
    assert.equal(state.runs[0].status, 'completed')
    assert.deepEqual(state.warnings, [])
  })
})

test('streamChatCompletion forwards enbrand Responses events and keeps token billing separate from 302', async () => {
  const response = () => new Response(
    `event: response.output_text.delta\ndata: ${JSON.stringify({ type: 'response.output_text.delta', delta: 'Enbrand reply' })}\n\nevent: response.completed\ndata: ${JSON.stringify({ type: 'response.completed', response: textResult })}\n\n`,
    { headers: { 'content-type': 'text/event-stream', 'x-request-id': 'req-enbrand-stream' } }
  )
  await withRunHarness({ response }, async state => {
    const events = []
    const result = await streamChatCompletion(userId, { messages: [{ role: 'user', content: 'Hello' }] }, { onEvent: event => events.push(event) })
    assert.equal(result.status, 'completed')
    assert.equal(result.result.choices[0].message.content, 'Enbrand reply')
    assert.match(events.join(''), /Enbrand reply/)
    assert.equal(events.filter(event => event.includes('[DONE]')).length, 1)
    assertOnlyActiveServiceLookup(state)
    assert.equal(state.requests.length, 1)
    assert.equal(state.requests[0].url, 'https://api.enbrand.co/v1/responses')
    assert.equal(state.requests[0].body.model, 'gpt-5.6-sol')
    assert.equal(state.requests[0].body.stream, true)
    assert.equal(state.requests[0].body.store, false)
    assertEnbrandUsage(state.usage[0])
    assert.equal(state.usage[0].provider_request_id, 'req-enbrand-stream')
    assert.equal(state.runs[0].status, 'completed')
    assert.deepEqual(state.warnings, [])
  })
})

test('chat, image, and streamed chat require active service before writing a run or calling enbrand', async () => {
  for (const invoke of [
    () => createRun(userId, { type: 'chat', payload: { messages: [] } }),
    () => createRun(userId, { type: 'image', payload: { prompt: 'A circle' } }),
    () => streamChatCompletion(userId, { messages: [] }),
    () => createRun(userId, { type: 'video', payload: { model: 'sora2', prompt: 'A circle' } }),
    () => getImageTask(userId, 'image-task'),
    () => getVideoTask(userId, 'video-task')
  ]) {
    await withRunHarness({ credentialStatus: 'disabled', response: () => { throw new Error('Provider must not be called') } }, async state => {
      await assert.rejects(invoke(), error => error.status === 403 && error.code === 'SERVICE_DISABLED')
      assert.ok(state.queries.every(query => ['users', 'user_service_credentials'].includes(query.table) && query.operation === 'select'))
      assert.equal(state.requests.length, 0)
      assert.equal(state.runs.length, 0)
    })
  }
})

test('retired chat and image models fail before database or network access', async () => {
  await withRunHarness({ response: () => { throw new Error('Provider must not be called') } }, async state => {
    for (const input of [
      { type: 'chat', model: 'gemini-2.5-flash', payload: { messages: [] } },
      { type: 'chat', payload: { model: 'gpt-5.5', messages: [] } },
      { type: 'image', model: 'gpt-image-lite', payload: { prompt: 'A circle' } },
      { type: 'image', payload: { model_name: 'nano-banana-pro', prompt: 'A circle' } }
    ]) await assert.rejects(createRun(userId, input), error => error.status === 400 && error.code === 'UNSUPPORTED_MODEL')
    await assert.rejects(streamChatCompletion(userId, { model: 'gemini-2.5-flash', messages: [] }), { code: 'UNSUPPORTED_MODEL' })
    assert.equal(state.queries.length, 0)
    assert.equal(state.requests.length, 0)
  })
})

const imageResponse = () => Response.json({
  data: [{ b64_json: Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), Buffer.alloc(192)]).toString('base64') }],
  usage: { input_tokens: 6, output_tokens: 10, total_tokens: 16 }
}, { headers: { 'x-request-id': 'req-enbrand-image' } })

test('GPT image returns a local task and persists its output and enbrand usage in the background', async () => {
  await withRunHarness({ response: imageResponse }, async state => {
    const result = await createRun(userId, { type: 'image', payload: { prompt: 'A circle', sourceNodeId: 'image-node' } })
    assert.equal(result.status, 'running')
    assert.equal(result.result.task_id, `local-image-run:${result.runId}`)
    assert.equal(result.result.provider, 'enbrand')
    assert.equal(state.background.length, 1)
    await Promise.all(state.background)
    assertOnlyActiveServiceLookup(state)
    assert.equal(state.requests.length, 1)
    assert.equal(state.requests[0].url, 'https://api.enbrand.co/v1/images/generations')
    assert.equal(state.requests[0].body.model, 'gpt-image-2')
    assert.equal(state.uploads.length, 1)
    assert.equal(state.uploads[0].bytes.length, 200)
    assert.equal(state.runs[0].status, 'completed')
    assertEnbrandUsage(state.usage[0], { model: 'gpt-image-2', input: 6, output: 10 })
    assert.equal(state.usage[0].image_count, 1)
    assert.equal(state.usage[0].provider_request_id, 'req-enbrand-image')
    const media = state.audit.find(row => row.action === 'media.generated')
    assert.equal(media.metadata.status, 'completed')
    assert.match(media.metadata.assets[0].url, /^https:\/\/storage.example\/storage\/v1\/object\/public\/uploads\//)
    assert.equal(media.metadata.assets[0].sourceNodeId, 'image-node')
    assert.deepEqual(state.warnings, [])
  })
})

test('background GPT image storage failure marks the run and media failed without returning inline assets', async () => {
  await withRunHarness({ response: imageResponse, uploadFailure: true }, async state => {
    const result = await createRun(userId, { type: 'image', payload: { prompt: 'A circle' } })
    assert.equal(result.status, 'running')
    await Promise.all(state.background)
    assert.equal(state.requests.length, 1)
    assert.equal(state.uploads.length, 1)
    assert.equal(state.runs[0].status, 'failed')
    assert.equal(state.runs[0].error_msg, 'File upload failed')
    const media = state.audit.find(row => row.action === 'media.generated')
    assert.equal(media.metadata.status, 'failed')
    assert.deepEqual(media.metadata.assets, [])
    assertEnbrandUsage(state.usage[0], { model: 'gpt-image-2', input: 6, output: 10 })
    assert.equal(state.usage[0].image_count, 1)
    assert.equal(state.usage[0].provider_request_id, 'req-enbrand-image')
    assert.ok(state.warnings.some(message => message.includes('queued image run failed')))
  })
})


test('opened users create and poll owned video tasks with the shared server key and no 302 management calls', async () => {
  const response = (request) => request.url.includes('/topazlabs/')
    ? Response.json({ error: { message: 'Unsupported task' } }, { status: 404 })
    : Response.json({ id: 'video_shared_1', status: 'in_progress' })
  await withRunHarness({ video: true, response }, async (state) => {
    const created = await createRun(userId, { type: 'video', payload: { model: 'sora2', prompt: 'A circle', seconds: 4 } })
    assert.equal(created.result.task_id, 'video_shared_1')
    assert.equal(created.status, 'running')
    const polled = await getVideoTask(userId, created.result.task_id)
    assert.equal(polled.status, 'processing')
    assert.equal(state.requests.length, 3)
    assert.equal(state.usage[0].api_name, 'shared')
    assert.equal(state.usage[0].service_credential_id, credentialId)
    assert.equal(state.usage[0].billed_cost_usd, 0)
    assert.ok(state.requests.every((request) => !request.url.includes('/dashboard/')))
    state.audit.splice(0, state.audit.length)
    await assert.rejects(getVideoTask(userId, created.result.task_id), { status: 404, code: 'VIDEO_TASK_NOT_FOUND' })
    assert.equal(state.requests.length, 3)
  })
})

test('paused or deleted accounts cannot create or poll text, image, or video even with an active grant', async () => {
  for (const userStatus of ['suspended', 'deleted']) {
    await withRunHarness({ userStatus, response: () => assert.fail('no provider request is allowed') }, async (state) => {
      for (const invoke of [
        () => createRun(userId, { type: 'chat', payload: { messages: [] } }),
        () => createRun(userId, { type: 'image', payload: { prompt: 'A circle' } }),
        () => createRun(userId, { type: 'video', payload: { model: 'sora2', prompt: 'A circle' } }),
        () => getImageTask(userId, 'image-task'),
        () => getVideoTask(userId, 'video-task')
      ]) await assert.rejects(invoke(), { status: 403, code: userStatus === 'deleted' ? 'ACCOUNT_DELETED' : 'ACCOUNT_SUSPENDED' })
      assert.equal(state.requests.length, 0)
      assert.equal(state.runs.length, 0)
    })
  }
})
