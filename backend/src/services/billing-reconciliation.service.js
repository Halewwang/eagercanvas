import { supabase } from '../config/supabase.js'
import { env } from '../config/env.js'
import { HttpError } from '../utils/http.js'
import { get302ApiRecords, normalize302ApiRecordList } from './dashboard302.service.js'

const toNumber = (...values) => {
  for (const value of values) {
    if (value === undefined || value === null || String(value).trim() === '') continue
    const parsed = Number(value)
    if (Number.isFinite(parsed)) return parsed
  }
  return 0
}

const toText = (...values) => {
  for (const value of values) {
    if (value === undefined || value === null) continue
    const text = String(value).trim()
    if (text) return text
  }
  return ''
}

const toIso = (...values) => {
  const raw = toText(...values)
  if (!raw) return null
  const date = new Date(raw)
  if (!Number.isNaN(date.getTime())) return date.toISOString()
  const unix = Number(raw)
  if (Number.isFinite(unix) && unix > 0) {
    const ms = unix > 10_000_000_000 ? unix : unix * 1000
    return new Date(ms).toISOString()
  }
  return null
}

export const normalizeProviderBillingRecord = (record = {}) => {
  const raw = record && typeof record === 'object' ? record : {}
  return {
    upstreamRequestId: toText(raw.request_id, raw.requestId, raw.id),
    upstreamTaskId: toText(raw.task_id, raw.taskId, raw.upstream_task_id),
    providerApiName: toText(raw.api_name, raw.apiName, raw.provider_api_name, raw.key_name),
    model: toText(raw.model, raw.model_name),
    endpoint: toText(raw.endpoint, raw.path, raw.url),
    status: toText(raw.status, raw.code),
    inputTokens: toNumber(raw.input_token, raw.inputTokens, raw.prompt_tokens, raw.promptTokens),
    outputTokens: toNumber(raw.output_token, raw.outputTokens, raw.completion_tokens, raw.completionTokens),
    imageCount: toNumber(raw.image_count, raw.imageCount, raw.images),
    videoSeconds: toNumber(raw.video_seconds, raw.videoSeconds, raw.duration, raw.seconds),
    costAmount: toNumber(raw.cost_amount, raw.cost, raw.cost_usd, raw.total_cost, raw.amount),
    costCurrency: toText(raw.cost_currency, raw.currency) || 'USD',
    officialCreatedAt: toIso(raw.created_at, raw.createdAt, raw.time, raw.created_time),
    rawRecord: raw
  }
}

export const resolveBillingMatch = (record = {}, { usageEvents = [], credentials = [] } = {}) => {
  const requestId = String(record.upstreamRequestId || '').trim()
  const taskId = String(record.upstreamTaskId || '').trim()
  const apiName = String(record.providerApiName || '').trim()

  const byRequest = requestId
    ? usageEvents.find((item) => String(item.provider_request_id || '').trim() === requestId)
    : null
  if (byRequest) {
    return {
      usageEventId: byRequest.id,
      serviceCredentialId: byRequest.service_credential_id || null,
      userId: byRequest.user_id || null,
      reconciliationStatus: 'matched'
    }
  }

  const byTask = taskId
    ? usageEvents.find((item) => String(item.upstream_task_id || '').trim() === taskId || String(item.provider_request_id || '').trim() === taskId)
    : null
  if (byTask) {
    return {
      usageEventId: byTask.id,
      serviceCredentialId: byTask.service_credential_id || null,
      userId: byTask.user_id || null,
      reconciliationStatus: 'matched'
    }
  }

  const byCredential = apiName
    ? credentials.find((item) => String(item.provider_api_name || '').trim() === apiName)
    : null
  if (byCredential) {
    return {
      usageEventId: null,
      serviceCredentialId: byCredential.id,
      userId: byCredential.user_id || null,
      reconciliationStatus: 'matched'
    }
  }

  return {
    usageEventId: null,
    serviceCredentialId: null,
    userId: null,
    reconciliationStatus: 'unmatched'
  }
}

export const buildBillingRecordPayload = (record = {}, match = {}) => ({
  provider: '302ai',
  upstream_request_id: record.upstreamRequestId || null,
  upstream_task_id: record.upstreamTaskId || null,
  service_credential_id: match.serviceCredentialId || null,
  provider_api_name: record.providerApiName || null,
  user_id: match.userId || null,
  run_id: match.runId || null,
  usage_event_id: match.usageEventId || null,
  model: record.model || null,
  endpoint: record.endpoint || null,
  status: record.status || null,
  input_tokens: Number(record.inputTokens || 0),
  output_tokens: Number(record.outputTokens || 0),
  image_count: Number(record.imageCount || 0),
  video_seconds: Number(record.videoSeconds || 0),
  cost_amount: Number(record.costAmount || 0),
  cost_currency: record.costCurrency || 'USD',
  official_created_at: record.officialCreatedAt || null,
  synced_at: new Date().toISOString(),
  reconciliation_status: match.reconciliationStatus || 'unmatched',
  raw_record: record.rawRecord || {}
})

const loadMatchingContext = async (client, records) => {
  const requestIds = records.map((item) => item.upstreamRequestId).filter(Boolean)
  const taskIds = records.map((item) => item.upstreamTaskId).filter(Boolean)
  const apiNames = records.map((item) => item.providerApiName).filter(Boolean)

  const credentialQuery = apiNames.length
    ? client.from('user_service_credentials').select('id,user_id,provider_api_name').in('provider_api_name', [...new Set(apiNames)])
    : Promise.resolve({ data: [], error: null })

  const usageQueries = []
  const usageSelect = 'id,user_id,run_id,service_credential_id,provider_request_id,upstream_task_id,billing_status'
  if (requestIds.length) {
    usageQueries.push(client.from('usage_events').select(usageSelect).in('provider_request_id', [...new Set(requestIds)]))
  }
  if (taskIds.length) {
    usageQueries.push(client.from('usage_events').select(usageSelect).in('upstream_task_id', [...new Set(taskIds)]))
    usageQueries.push(client.from('usage_events').select(usageSelect).in('provider_request_id', [...new Set(taskIds)]))
  }

  const [usageResults, credentialRes] = await Promise.all([
    usageQueries.length ? Promise.all(usageQueries) : Promise.resolve([]),
    credentialQuery
  ])
  for (const result of usageResults) {
    if (result.error) throw new HttpError(500, result.error.message, 'BILLING_USAGE_QUERY_FAILED')
  }
  if (credentialRes.error) throw new HttpError(500, credentialRes.error.message, 'BILLING_CREDENTIAL_QUERY_FAILED')

  const usageMap = new Map()
  for (const result of usageResults) {
    for (const row of result.data || []) usageMap.set(row.id, row)
  }

  return {
    usageEvents: [...usageMap.values()],
    credentials: credentialRes.data || []
  }
}

const upsertBillingRecordPayloads = async (client, payloads) => {
  const rows = []
  const requestPayloads = payloads.filter((item) => item.upstream_request_id)
  const taskPayloads = payloads.filter((item) => !item.upstream_request_id && item.upstream_task_id)
  const insertPayloads = payloads.filter((item) => !item.upstream_request_id && !item.upstream_task_id)

  const upsertBatch = async (batch, onConflict) => {
    if (!batch.length) return
    const { data, error } = await client
      .from('provider_billing_records')
      .upsert(batch, { onConflict })
      .select('id,usage_event_id,cost_amount,reconciliation_status')
    if (error) throw new HttpError(500, error.message, 'BILLING_RECORD_UPSERT_FAILED')
    rows.push(...(data || []))
  }

  await upsertBatch(requestPayloads, 'upstream_request_id')
  await upsertBatch(taskPayloads, 'upstream_task_id')

  if (insertPayloads.length) {
    const { data, error } = await client
      .from('provider_billing_records')
      .insert(insertPayloads)
      .select('id,usage_event_id,cost_amount,reconciliation_status')
    if (error) throw new HttpError(500, error.message, 'BILLING_RECORD_INSERT_FAILED')
    rows.push(...(data || []))
  }

  return rows
}

const shouldFetchNextRecordPage = (pagination, page) => {
  if (!pagination || typeof pagination !== 'object') return false
  const totalPages = Number(
    pagination.total_pages ||
    pagination.total_page ||
    pagination.totalPages ||
    pagination.last_page ||
    pagination.lastPage ||
    0
  )
  if (Number.isFinite(totalPages) && totalPages > page) return true
  if (pagination.has_more === true || pagination.hasMore === true) return true
  const nextPage = Number(pagination.next_page || pagination.nextPage || 0)
  return Number.isFinite(nextPage) && nextPage > page
}

export const syncProviderBillingRecords = async ({ startTime, endTime, pageSize = 100 } = {}, deps = {}) => {
  const client = deps.supabaseClient || supabase
  const fetchRecords = deps.fetchRecords || get302ApiRecords
  const end = endTime ? new Date(endTime) : new Date()
  const start = startTime ? new Date(startTime) : new Date(end.getTime() - 15 * 60 * 1000)
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    throw new HttpError(400, 'Invalid billing sync time range', 'INVALID_BILLING_SYNC_RANGE')
  }

  const records = []
  let page = 1
  let keepFetching = true
  while (keepFetching) {
    const response = await fetchRecords({
      page,
      limit: Number(pageSize || 100),
      start_time: Math.floor(start.getTime() / 1000),
      end_time: Math.floor(end.getTime() / 1000)
    })
    const normalized = normalize302ApiRecordList(response)
    records.push(...normalized.items.map(normalizeProviderBillingRecord))
    keepFetching = shouldFetchNextRecordPage(normalized.pagination, page)
    page += 1
    if (page > 50) keepFetching = false
  }
  const context = await loadMatchingContext(client, records)

  let matched = 0
  let unmatched = 0
  const payloads = []
  for (const record of records) {
    const match = resolveBillingMatch(record, context)
    if (match.reconciliationStatus === 'matched') matched += 1
    else unmatched += 1
    const usageEvent = context.usageEvents.find((item) => item.id === match.usageEventId)
    payloads.push(buildBillingRecordPayload(record, { ...match, runId: usageEvent?.run_id || null }))
  }

  if (!payloads.length) {
    return { ok: true, fetched: 0, inserted: 0, updated: 0, matched: 0, unmatched: 0 }
  }

  const data = await upsertBillingRecordPayloads(client, payloads)

  for (const row of data || []) {
    if (!row.usage_event_id) continue
    await client
      .from('usage_events')
      .update({
        billing_record_id: row.id,
        billed_cost_usd: Number(row.cost_amount || 0),
        billing_status: row.reconciliation_status === 'matched' ? 'reconciled' : 'unmatched'
      })
      .eq('id', row.usage_event_id)
  }

  return {
    ok: true,
    fetched: records.length,
    inserted: data?.length || 0,
    updated: 0,
    matched,
    unmatched
  }
}

let timer = null
let running = false

export const startBillingReconciliationScheduler = () => {
  if (timer || !env.billingSyncEnabled) return
  const intervalMs = Math.max(5 * 60 * 1000, Number(env.billingSyncIntervalMs || 10 * 60 * 1000))
  timer = setInterval(async () => {
    if (running) return
    running = true
    try {
      const end = new Date()
      const start = new Date(end.getTime() - Math.max(10 * 60 * 1000, Number(env.billingSyncLookbackMs || 10 * 60 * 1000)))
      await syncProviderBillingRecords({ startTime: start.toISOString(), endTime: end.toISOString() })
    } catch (error) {
      console.warn('[billing] scheduled reconciliation failed', error.message || error)
    } finally {
      running = false
    }
  }, intervalMs)
  timer.unref?.()
}
