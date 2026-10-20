import assert from 'node:assert/strict'
import { mock, test } from 'node:test'
import { env } from '../config/env.js'
import { supabase, supabaseStorage } from '../config/supabase.js'
import { createRun, getImageTask } from './runs.service.js'

const userId = 'user-apimart'
const generatedUrl = 'https://images.example.com/generated.png'
const deferred = () => { let resolve; const promise = new Promise(done => { resolve = done }); return { promise, resolve } }

const withHarness = async (options, fn) => {
  const state = { requests: [], uploads: [], runs: [], audit: [], usage: [], failures: {}, background: [] }
  const tables = { users: [{ id: userId, status: 'active', deleted_at: null }], workflow_runs: state.runs, audit_logs: state.audit, usage_events: state.usage, usage_daily_agg: [] }
  const originalKey = env.apimartApiKey
  const originalBase = env.apimartApiBaseUrl
  const symbol = Symbol.for('@vercel/request-context')
  const originalContext = globalThis[symbol]
  env.apimartApiKey = 'test-apimart-key'
  env.apimartApiBaseUrl = 'https://api.apimart.ai/v1'
  globalThis[symbol] = { get: () => ({ waitUntil: promise => state.background.push(promise) }) }
  const db = mock.method(supabase, 'from', table => {
    const query = { op: 'select', filters: [], metadata: null }
    const resolve = single => {
      const key = `${table}.${query.op}`
      if (state.failures[key]) { state.failures[key] -= 1; return { data: null, error: { message: `Database ${key} unavailable` } } }
      let rows = table === 'user_service_credentials' ? [{ id: 'service-active', user_id: userId, status: options.disabled ? 'disabled' : 'active' }] : tables[table]
      assert.ok(rows, `Unexpected table ${table}`)
      rows = rows.filter(row => query.filters.every(([field, value]) => row[field] === value) && (!query.metadata || Object.entries(query.metadata).every(([key, value]) => row.metadata?.[key] === value)))
      if (query.op === 'insert' || query.op === 'upsert') {
        const row = { id: `${table}-${tables[table].length + 1}`, created_at: new Date().toISOString(), ...query.payload }
        tables[table].push(row)
        rows = [row]
      } else if (query.op === 'update') rows.forEach(row => Object.assign(row, structuredClone(query.payload)))
      return { data: single ? (rows[0] || null) : rows.map(row => structuredClone(row)), error: null }
    }
    return {
      select() { return this }, eq(field, value) { query.filters.push([field, value]); return this },
      contains(_column, value) { query.metadata = value; return this }, order() { return this }, limit() { return this }, gte() { return this }, lte() { return this },
      insert(payload) { query.op = 'insert'; query.payload = payload; return this }, upsert(payload) { query.op = 'upsert'; query.payload = payload; return this }, update(payload) { query.op = 'update'; query.payload = payload; return this },
      single() { return Promise.resolve(resolve(true)) }, maybeSingle() { return Promise.resolve(resolve(true)) }, then(yes, no) { return Promise.resolve(resolve(false)).then(yes, no) }
    }
  })
  const storage = mock.method(supabaseStorage.storage, 'from', () => ({
    async upload(name) { state.uploads.push(name); return { error: options.storageFailure ? { message: 'Storage unavailable' } : null } },
    getPublicUrl(name) { return { data: { publicUrl: `https://storage.example/storage/v1/object/public/uploads/${name}` } } }
  }))
  const network = mock.method(globalThis, 'fetch', async (url, init) => {
    const request = { url: String(url), method: init?.method || 'GET', body: init?.body ? JSON.parse(init.body) : null }
    state.requests.push(request)
    if (request.url === generatedUrl) return new Response(Buffer.alloc(32), { headers: { 'content-type': 'image/png' } })
    assert.match(request.url, /^https:\/\/api\.apimart\.ai\/v1\//)
    if (request.method === 'POST') { options.onSubmit?.(state); return Response.json({ code: 200, data: [{ task_id: 'upstream-task-1', status: 'submitted' }] }) }
    if (options.statusGate) await options.statusGate.promise
    return options.response?.(state) || Response.json({ code: 200, data: { id: 'upstream-task-1', status: 'completed', progress: 100, result: { images: [{ url: [generatedUrl] }] } } })
  })
  const errors = mock.method(console, 'error', () => {})
  const warnings = mock.method(console, 'warn', () => {})
  try { await fn(state) } finally {
    errors.mock.restore(); warnings.mock.restore(); network.mock.restore(); storage.mock.restore(); db.mock.restore()
    env.apimartApiKey = originalKey; env.apimartApiBaseUrl = originalBase
    if (originalContext === undefined) delete globalThis[symbol]; else globalThis[symbol] = originalContext
  }
}
const create = () => createRun(userId, { type: 'image', payload: { model: 'gpt-image-2', prompt: 'A circle', size: '1024x1024', quality: 'high', sourceNodeId: 'image-node' } })
const ownerRecord = state => state.audit.find(row => row.action === 'image.task.created')
const posts = state => state.requests.filter(request => request.method === 'POST')
const polls = state => state.requests.filter(request => /\/tasks\//.test(request.url))

test('APIMart image submit persists upstream context and polling completes only after durable media storage', async () => {
  await withHarness({}, async state => {
    const created = await create()
    const taskId = created.result.task_id
    assert.equal(taskId, `local-image-run:${created.runId}`)
    assert.equal(created.result.provider, 'apimart')
    assert.equal(state.background.length, 0)
    assert.equal(posts(state).length, 1)
    assert.equal(ownerRecord(state).metadata.upstream_task_id, 'upstream-task-1')
    assert.equal(ownerRecord(state).metadata.request_context.payload.prompt, 'A circle')
    assert.equal(ownerRecord(state).metadata.request_context.payload.resolution, '1k')
    assert.equal(Object.hasOwn(ownerRecord(state).metadata.request_context.payload, 'quality'), false)
    const result = await getImageTask(userId, taskId)
    assert.equal(result.status, 'completed')
    assert.match(result.data[0].url, /\/storage\/v1\/object\/public\/uploads\//)
    assert.equal(state.runs[0].status, 'completed')
    assert.equal(state.uploads.length, 1)
    assert.equal(state.audit.find(row => row.action === 'media.generated').metadata.assets[0].sourceNodeId, 'image-node')
    assert.equal(state.usage[0].api_name, 'apimart')
    await getImageTask(userId, taskId)
    assert.equal(posts(state).length, 1)
    assert.equal(polls(state).length, 1)
    assert.equal(state.uploads.length, 1)
  })
})

test('refresh recovery polls saved upstream ID and concurrent polls finalize once', async () => {
  const statusGate = deferred()
  await withHarness({ statusGate }, async state => {
    const created = await create()
    const first = getImageTask(userId, created.result.task_id)
    for (let tick = 0; tick < 50 && !polls(state).length; tick += 1) await new Promise(done => setImmediate(done))
    assert.equal(polls(state).length, 1)
    const second = await getImageTask(userId, created.result.task_id)
    assert.equal(second.status, 'processing')
    assert.equal(polls(state).length, 1)
    statusGate.resolve()
    assert.equal((await first).status, 'completed')
    assert.equal(state.uploads.length, 1)
    assert.equal(posts(state).length, 1)
  })
})

test('unknown or foreign task IDs never trigger provider GET or POST', async () => {
  await withHarness({}, async state => {
    const created = await create()
    await assert.rejects(getImageTask(userId, 'upstream-task-1'), { code: 'IMAGE_TASK_NOT_FOUND' })
    ownerRecord(state).user_id = 'other-user'
    await assert.rejects(getImageTask(userId, created.result.task_id), { code: 'IMAGE_TASK_NOT_FOUND' })
    assert.equal(polls(state).length, 0)
    assert.equal(posts(state).length, 1)
  })
})

test('provider failure and durable timeout become failed local tasks without another submission', async () => {
  await withHarness({ response: () => Response.json({ code: 200, data: { id: 'upstream-task-1', status: 'failed', error: { message: 'Provider failed' } } }) }, async state => {
    const created = await create()
    const result = await getImageTask(userId, created.result.task_id)
    assert.equal(result.status, 'failed')
    assert.match(result.message, /Provider failed/)
    assert.equal(state.runs[0].status, 'failed')
    assert.equal(posts(state).length, 1)
  })
  await withHarness({ response: () => Response.json({ code: 200, data: { id: 'upstream-task-1', status: 'processing', progress: 40 } }) }, async state => {
    const created = await create()
    ownerRecord(state).metadata.deadline_at = Date.now() - 1
    const result = await getImageTask(userId, created.result.task_id)
    assert.equal(result.status, 'failed')
    assert.match(result.message, /timed out/i)
    assert.equal(polls(state).length, 1)
    assert.equal(posts(state).length, 1)
  })
})

test('storage failure never completes a task or returns an expiring provider asset', async () => {
  await withHarness({ storageFailure: true }, async state => {
    const created = await create()
    await assert.rejects(getImageTask(userId, created.result.task_id), /upload|saved/i)
    assert.equal(state.runs[0].status, 'running')
    assert.equal(state.audit.some(row => row.action === 'media.generated' && row.metadata.status === 'completed'), false)
    assert.equal(ownerRecord(state).metadata.poll_lock_until, 0)
    assert.equal(posts(state).length, 1)
  })
})

test('completed media checkpoint survives run status write failure and retries without duplicate upload', async () => {
  await withHarness({}, async state => {
    const created = await create()
    state.failures['workflow_runs.update'] = 1
    await assert.rejects(getImageTask(userId, created.result.task_id), { code: 'IMAGE_RUN_STATUS_SAVE_FAILED' })
    assert.equal(state.runs[0].status, 'running')
    assert.equal(state.uploads.length, 1)
    assert.equal((await getImageTask(userId, created.result.task_id)).status, 'completed')
    assert.equal(state.uploads.length, 1)
    assert.equal(posts(state).length, 1)
  })
})

test('audit persistence failure prevents submitting a charged provider request', async () => {
  await withHarness({}, async state => {
    state.failures['audit_logs.insert'] = 1
    await assert.rejects(create(), { code: 'TASK_OWNERSHIP_BIND_FAILED' })
    assert.equal(posts(state).length, 0)
    assert.equal(state.runs[0].status, 'failed')
  })
})


test('media record persistence failure retries its durable URL checkpoint without reuploading or resubmitting', async () => {
  await withHarness({}, async state => {
    const created = await create()
    state.failures['audit_logs.insert'] = 1
    await assert.rejects(getImageTask(userId, created.result.task_id), { code: 'IMAGE_OUTPUT_SAVE_FAILED' })
    assert.equal(state.runs[0].status, 'running')
    assert.match(ownerRecord(state).metadata.persisted_result.data[0].url, /\/storage\/v1\/object\/public\/uploads\//)
    assert.equal((await getImageTask(userId, created.result.task_id)).status, 'completed')
    assert.equal(state.uploads.length, 1)
    assert.equal(posts(state).length, 1)
    assert.equal(polls(state).length, 1)
  })
})

test('failed upstream-ID persistence is explicit and polling never resubmits the charged request', async () => {
  await withHarness({ onSubmit: state => { state.failures['audit_logs.update'] = 1 } }, async state => {
    await assert.rejects(create(), { code: 'IMAGE_TASK_CONTEXT_SAVE_FAILED' })
    assert.equal(state.runs[0].status, 'failed')
    const result = await getImageTask(userId, ownerRecord(state).metadata.task_id)
    assert.equal(result.status, 'failed')
    assert.equal(posts(state).length, 1)
    assert.equal(polls(state).length, 0)
  })
})

test('task reads preserve database errors and do not turn them into missing or completed runs', async () => {
  await withHarness({}, async state => {
    const created = await create()
    state.failures['workflow_runs.select'] = 1
    await assert.rejects(getImageTask(userId, created.result.task_id), { code: 'RUN_GET_FAILED' })
    assert.equal(polls(state).length, 0)
    assert.equal(state.runs[0].status, 'running')
  })
})

test('revoked service after submission prevents status requests to the upstream provider', async () => {
  const options = {}
  await withHarness(options, async state => {
    const created = await create()
    options.disabled = true
    await assert.rejects(getImageTask(userId, created.result.task_id), { code: 'SERVICE_DISABLED' })
    assert.equal(polls(state).length, 0)
    assert.equal(posts(state).length, 1)
  })
})

test('transient provider status errors release the lease for refresh recovery without another POST', async () => {
  let count = 0
  await withHarness({ response: () => ++count === 1 ? Response.json({ code: 503, message: 'Try later' }, { status: 503 }) : null }, async state => {
    const created = await create()
    await assert.rejects(getImageTask(userId, created.result.task_id), { status: 503 })
    assert.equal(state.runs[0].status, 'running')
    assert.equal(ownerRecord(state).metadata.poll_lock_until, 0)
    assert.equal((await getImageTask(userId, created.result.task_id)).status, 'completed')
    assert.equal(posts(state).length, 1)
  })
})

test('expired polling leases can be recovered from durable task metadata', async () => {
  await withHarness({}, async state => {
    const created = await create()
    ownerRecord(state).metadata.poll_version = 8
    ownerRecord(state).metadata.poll_lock_until = Date.now() - 1
    assert.equal((await getImageTask(userId, created.result.task_id)).status, 'completed')
    assert.equal(ownerRecord(state).metadata.poll_version, 10)
    assert.equal(state.uploads.length, 1)
  })
})


test('usage write errors retain the single pending ledger event and do not silently complete', async () => {
  await withHarness({}, async state => {
    const created = await create()
    state.failures['usage_events.update'] = 1
    await assert.rejects(getImageTask(userId, created.result.task_id), { code: 'IMAGE_USAGE_SAVE_FAILED' })
    assert.equal(state.runs[0].status, 'running')
    assert.equal(state.usage.length, 1)
    assert.equal(state.uploads.length, 0)
    assert.equal((await getImageTask(userId, created.result.task_id)).status, 'completed')
    assert.equal(state.usage.length, 1)
    assert.equal(posts(state).length, 1)
  })
})

test('interrupted submission without an upstream ID eventually fails without being submitted again', async () => {
  await withHarness({}, async state => {
    const created = await create()
    delete ownerRecord(state).metadata.upstream_task_id
    ownerRecord(state).metadata.deadline_at = Date.now() - 1
    assert.equal((await getImageTask(userId, created.result.task_id)).status, 'failed')
    assert.match(state.runs[0].error_msg, /timed out/)
    assert.equal(posts(state).length, 1)
    assert.equal(polls(state).length, 0)
  })
})


test('image task ownership cannot be used to poll a run of a different type', async () => {
  await withHarness({}, async state => {
    const created = await create()
    state.runs[0].type = 'chat'
    await assert.rejects(getImageTask(userId, created.result.task_id), { code: 'IMAGE_TASK_NOT_FOUND' })
    assert.equal(polls(state).length, 0)
  })
})

test('completion recovery preserves the original nonzero usage ledger after media or workflow writes fail', async () => {
  for (const failure of ['audit_logs.insert', 'workflow_runs.update']) {
    await withHarness({ response: () => Response.json({ code: 200, data: {
      id: 'upstream-task-1', status: 'completed', progress: 100, cost: 0.075,
      usage: { input_tokens: 12, output_tokens: 34 }, result: { images: [{ url: [generatedUrl] }] }
    } }, { headers: { 'x-request-id': 'request-with-cost' } }) }, async state => {
      const created = await create()
      state.failures[failure] = 1
      await assert.rejects(getImageTask(userId, created.result.task_id))
      assert.equal(state.usage[0].cost_usd, 0.075)
      assert.equal(state.usage[0].estimated_cost_usd, 0.075)
      assert.equal(state.usage[0].raw_usage.data.cost, 0.075)
      assert.equal(state.usage[0].input_tokens, 12)
      assert.equal(state.usage[0].output_tokens, 34)
      const savedUsage = structuredClone(state.usage[0])
      assert.equal((await getImageTask(userId, created.result.task_id)).status, 'completed')
      assert.deepEqual(state.usage[0], savedUsage)
      assert.equal(state.usage.length, 1)
      assert.equal(state.uploads.length, 1)
      assert.equal(posts(state).length, 1)
      assert.equal(polls(state).length, 1)
    })
  }
})


test('reopening after the local deadline recovers a completed paid upstream image and its usage', async () => {
  await withHarness({ response: () => Response.json({ code: 200, data: {
    id: 'upstream-task-1', status: 'completed', progress: 100, cost: 0.075,
    result: { images: [{ url: [generatedUrl] }] }
  } }) }, async state => {
    const created = await create()
    ownerRecord(state).metadata.started_at = Date.now() - 40 * 60 * 1000
    ownerRecord(state).metadata.deadline_at = Date.now() - 10 * 60 * 1000
    const recovered = await getImageTask(userId, created.result.task_id)
    assert.equal(recovered.status, 'completed')
    assert.match(recovered.data[0].url, /\/storage\/v1\/object\/public\/uploads\//)
    assert.equal(state.runs[0].status, 'completed')
    assert.equal(state.usage[0].cost_usd, 0.075)
    assert.equal(state.usage[0].estimated_cost_usd, 0.075)
    assert.equal(state.usage[0].raw_usage.data.cost, 0.075)
    assert.equal(posts(state).length, 1)
    assert.equal(polls(state).length, 1)
    assert.equal(state.uploads.length, 1)
    assert.equal((await getImageTask(userId, created.result.task_id)).status, 'completed')
    assert.equal(posts(state).length, 1)
    assert.equal(polls(state).length, 1)
  })
})
