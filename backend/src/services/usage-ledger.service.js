import { supabase } from '../config/supabase.js'

const toIsoDate = (value) => {
  const date = new Date(value || Date.now())
  if (Number.isNaN(date.getTime())) return new Date().toISOString().slice(0, 10)
  return date.toISOString().slice(0, 10)
}

const toNumber = (value) => {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

const extractUsageObject = (payload = {}) => {
  if (payload?.usage && typeof payload.usage === 'object') return payload.usage
  if (payload?.data?.usage && typeof payload.data.usage === 'object') return payload.data.usage
  if (payload?.raw?.usage && typeof payload.raw.usage === 'object') return payload.raw.usage
  return {}
}

const pickFirstNumber = (...values) => {
  for (const value of values) {
    const parsed = Number(value)
    if (Number.isFinite(parsed)) return parsed
  }
  return 0
}

export const extractProviderRequestId = (payload = {}) => {
  const candidates = [
    payload?.request_id,
    payload?.requestId,
    payload?.id,
    payload?.task_id,
    payload?.taskId,
    payload?.raw?.request_id,
    payload?.raw?.requestId,
    payload?.raw?.id,
    payload?.raw?.task_id,
    payload?.raw?.taskId,
    payload?.data?.request_id,
    payload?.data?.requestId,
    payload?.data?.id,
    payload?.data?.task_id,
    payload?.data?.taskId
  ]
  const found = candidates.find((item) => item !== undefined && item !== null && String(item).trim() !== '')
  return found ? String(found) : ''
}

export const extractUsageSnapshot = (payload = {}) => {
  const usage = extractUsageObject(payload)
  return {
    inputTokens: pickFirstNumber(
      usage.prompt_tokens,
      usage.input_tokens,
      payload?.input_token,
      payload?.inputTokens,
      payload?.data?.input_token,
      payload?.raw?.input_token
    ),
    outputTokens: pickFirstNumber(
      usage.completion_tokens,
      usage.output_tokens,
      payload?.output_token,
      payload?.outputTokens,
      payload?.data?.output_token,
      payload?.raw?.output_token
    ),
    costUsd: pickFirstNumber(
      usage.total_cost,
      usage.cost,
      payload?.cost,
      payload?.cost_usd,
      payload?.data?.cost,
      payload?.data?.cost_usd,
      payload?.raw?.cost,
      payload?.raw?.cost_usd
    )
  }
}

export const buildUsageEventPayload = ({
  userId,
  runId,
  model,
  eventType,
  inputTokens = 0,
  outputTokens = 0,
  imageCount = 0,
  videoSeconds = 0,
  costUsd = 0,
  latencyMs = 0,
  apiName = '',
  providerRequestId = '',
  estimatedCostUsd = 0,
  billedCostUsd = null,
  billingStatus = '',
  serviceCredentialId = '',
  upstreamTaskId = '',
  clientRequestId = '',
  rawUsage = null
}) => {
  const resolvedBilledCostUsd = billedCostUsd === null ? costUsd : billedCostUsd
  const normalizedBillingStatus = String(billingStatus || '').trim() || (providerRequestId ? 'pending' : 'estimated')

  return {
    user_id: userId,
    run_id: runId,
    provider: 'openai-compatible',
    model: model || null,
    event_type: eventType || 'generation',
    input_tokens: toNumber(inputTokens),
    output_tokens: toNumber(outputTokens),
    image_count: toNumber(imageCount),
    video_seconds: toNumber(videoSeconds),
    cost_usd: toNumber(costUsd),
    estimated_cost_usd: toNumber(estimatedCostUsd),
    billed_cost_usd: toNumber(resolvedBilledCostUsd),
    billing_status: normalizedBillingStatus,
    latency_ms: toNumber(latencyMs),
    api_name: String(apiName || '').trim() || null,
    provider_request_id: String(providerRequestId || '').trim() || null,
    service_credential_id: String(serviceCredentialId || '').trim() || null,
    upstream_task_id: String(upstreamTaskId || '').trim() || null,
    client_request_id: String(clientRequestId || '').trim() || null,
    raw_usage: rawUsage && typeof rawUsage === 'object' ? rawUsage : null
  }
}

export const rebuildUsageDailyAggregateForUserDate = async (userId, dateValue) => {
  const date = toIsoDate(dateValue)
  const start = `${date}T00:00:00.000Z`
  const end = `${date}T23:59:59.999Z`

  const { data, error } = await supabase
    .from('usage_events')
    .select('input_tokens,output_tokens,image_count,video_seconds,cost_usd')
    .eq('user_id', userId)
    .gte('created_at', start)
    .lte('created_at', end)

  if (error) {
    console.warn('[usage] rebuild daily aggregate failed', error.message)
    return
  }

  const summary = (data || []).reduce((acc, item) => {
    acc.total_calls += 1
    acc.total_tokens += toNumber(item.input_tokens) + toNumber(item.output_tokens)
    acc.total_images += toNumber(item.image_count)
    acc.total_video_seconds += toNumber(item.video_seconds)
    acc.total_cost_usd += toNumber(item.cost_usd)
    return acc
  }, {
    total_calls: 0,
    total_tokens: 0,
    total_images: 0,
    total_video_seconds: 0,
    total_cost_usd: 0
  })

  const { error: upsertError } = await supabase
    .from('usage_daily_agg')
    .upsert({
      date,
      user_id: userId,
      ...summary,
      updated_at: new Date().toISOString()
    }, { onConflict: 'date,user_id' })

  if (upsertError) {
    console.warn('[usage] usage_daily_agg upsert failed', upsertError.message)
  }
}

export const insertUsageEvent = async (payload = {}) => {
  const record = buildUsageEventPayload(payload)
  const { data, error } = await supabase
    .from('usage_events')
    .insert(record)
    .select('*')
    .single()

  if (error) {
    console.warn('[usage] insert failed', error.message)
    return null
  }

  await rebuildUsageDailyAggregateForUserDate(record.user_id, data?.created_at)
  return data
}

export const updateUsageEventByRunId = async (runId, patch = {}) => {
  const safeRunId = String(runId || '').trim()
  if (!safeRunId) return null

  const { data: current, error: readError } = await supabase
    .from('usage_events')
    .select('*')
    .eq('run_id', safeRunId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (readError || !current) {
    if (readError) console.warn('[usage] read before update failed', readError.message)
    return null
  }

  const next = {
    ...patch
  }

  const { data, error } = await supabase
    .from('usage_events')
    .update(next)
    .eq('id', current.id)
    .select('*')
    .single()

  if (error) {
    console.warn('[usage] update failed', error.message)
    return null
  }

  await rebuildUsageDailyAggregateForUserDate(data.user_id, data.created_at)
  return data
}
