import { supabase } from '../config/supabase.js'
import { buildIssueFingerprint } from './issue-fingerprint.js'
import { redactIssuePayload } from './issue-redaction.js'
import { queueIssueAlertForGroup } from './issue-notification.service.js'

const DEFAULT_ENVIRONMENT = process.env.NODE_ENV || 'development'
const MAX_SAMPLE_EVENT_IDS = 5
const MAX_EVIDENCE_VALUES = 20

const nonEmpty = (value) => {
  const text = String(value || '').trim()
  return text || null
}

const normalizeSeverity = (severity, payload = {}) => {
  const value = String(severity || '').toLowerCase()
  if (['p0', 'p1', 'p2', 'p3'].includes(value)) return value
  if (payload.source_layer === 'frontend') return 'p2'
  if (payload.source_layer === 'provider' || payload.source_layer === 'database') return 'p1'
  if (payload.status_code >= 500) return 'p1'
  return 'p2'
}

const addBounded = (values = [], value) => {
  const next = new Set(Array.isArray(values) ? values : [])
  if (value) next.add(value)
  return [...next].slice(0, MAX_EVIDENCE_VALUES)
}

const buildTitle = (record) => {
  const layer = record.source_layer || 'unknown'
  const code = record.error_code || record.category || 'issue'
  const target = record.model || record.path_template || record.route || record.db_table || ''
  return [layer, code, target].filter(Boolean).join(' ')
}

export const buildIssueEventRecord = (payload = {}, { now = () => new Date().toISOString() } = {}) => {
  const redacted = redactIssuePayload(payload)
  const record = {
    created_at: now(),
    source_layer: nonEmpty(redacted.source_layer) || 'backend',
    category: nonEmpty(redacted.category) || 'runtime_error',
    severity: normalizeSeverity(redacted.severity, redacted),
    environment: nonEmpty(redacted.environment) || DEFAULT_ENVIRONMENT,
    build_id: nonEmpty(redacted.build_id),
    release_commit: nonEmpty(redacted.release_commit),
    user_id: nonEmpty(redacted.user_id),
    session_hash: nonEmpty(redacted.session_hash),
    request_id: nonEmpty(redacted.request_id),
    trace_id: nonEmpty(redacted.trace_id),
    route: nonEmpty(redacted.route),
    route_name: nonEmpty(redacted.route_name),
    component: nonEmpty(redacted.component),
    method: nonEmpty(redacted.method)?.toUpperCase() || null,
    path_template: nonEmpty(redacted.path_template),
    status_code: Number.isFinite(Number(redacted.status_code)) ? Number(redacted.status_code) : null,
    duration_ms: Number.isFinite(Number(redacted.duration_ms)) ? Number(redacted.duration_ms) : null,
    provider: nonEmpty(redacted.provider),
    model: nonEmpty(redacted.model || redacted.metadata?.model),
    upstream_endpoint: nonEmpty(redacted.upstream_endpoint),
    upstream_status: Number.isFinite(Number(redacted.upstream_status)) ? Number(redacted.upstream_status) : null,
    db_table: nonEmpty(redacted.db_table),
    db_operation: nonEmpty(redacted.db_operation),
    db_code: nonEmpty(redacted.db_code),
    error_code: nonEmpty(redacted.error_code),
    message_summary: nonEmpty(redacted.message_summary),
    stack_summary: nonEmpty(redacted.stack_summary),
    metadata: redacted.metadata || {}
  }
  record.fingerprint = nonEmpty(redacted.fingerprint) || buildIssueFingerprint(record)
  return record
}

const buildEvidenceSummary = (record, existing = {}) => ({
  users: addBounded(existing.users, record.user_id),
  sessions: addBounded(existing.sessions, record.session_hash),
  routes: addBounded(existing.routes, record.route_name || record.route),
  builds: addBounded(existing.builds, record.build_id),
  providers: addBounded(existing.providers, record.provider),
  models: addBounded(existing.models, record.model),
  api_paths: addBounded(existing.api_paths, record.path_template),
  request_ids: addBounded(existing.request_ids, record.request_id),
  errors: addBounded(existing.errors, record.error_code || record.message_summary)
})

const buildCodexHandoff = (record, evidenceSummary) => ({
  schema_version: 'codex_issue_table/v1',
  evidence: {
    source_layer: record.source_layer,
    category: record.category,
    route: record.route_name || record.route || 'unknown',
    api_path: record.path_template || 'unknown',
    request_id: record.request_id || 'unknown',
    provider: record.provider || 'unknown',
    model: record.model || 'unknown',
    db_table: record.db_table || 'unknown',
    error_code: record.error_code || 'unknown',
    message_summary: record.message_summary || 'unknown'
  },
  root_cause_hints: [
    record.request_id ? 'Request id is available for cross-layer tracing.' : '',
    record.provider ? 'Provider/model metadata is available.' : '',
    record.db_table ? 'Database table metadata is available.' : ''
  ].filter(Boolean),
  suspected_files: [],
  evidence_summary: evidenceSummary
})

const buildGroupPayload = (record, event, existing = null, now) => {
  const evidenceSummary = buildEvidenceSummary(record, existing?.evidence_summary || {})
  const sampleEventIds = addBounded(existing?.sample_event_ids || [], event?.id).slice(0, MAX_SAMPLE_EVENT_IDS)
  return {
    updated_at: now,
    first_seen_at: existing?.first_seen_at || record.created_at,
    last_seen_at: record.created_at,
    fingerprint: record.fingerprint,
    source_layer: record.source_layer,
    category: record.category,
    severity: record.severity,
    status: existing?.status || 'open',
    title: existing?.title || buildTitle(record),
    event_count: Number(existing?.event_count || 0) + 1,
    affected_users: evidenceSummary.users.length,
    affected_sessions: evidenceSummary.sessions.length,
    affected_routes: evidenceSummary.routes.length,
    affected_builds: evidenceSummary.builds.length,
    latest_build_id: record.build_id,
    latest_release_commit: record.release_commit,
    latest_request_id: record.request_id,
    sample_event_ids: sampleEventIds,
    root_cause_layer: record.source_layer,
    root_cause_confidence: record.request_id || record.provider || record.db_table ? 'high' : 'medium',
    evidence_summary: evidenceSummary,
    codex_handoff: buildCodexHandoff(record, evidenceSummary),
    notification_count: Number(existing?.notification_count || 0)
  }
}

export const upsertIssueGroupForEvent = async (record, event, {
  supabaseClient = supabase,
  now = () => new Date().toISOString()
} = {}) => {
  const { data: existing, error: readError } = await supabaseClient
    .from('issue_groups')
    .select('*')
    .eq('fingerprint', record.fingerprint)
    .maybeSingle()

  if (readError) return { data: null, error: readError }

  const payload = buildGroupPayload(record, event, existing, now())
  if (existing?.id) {
    const { data, error } = await supabaseClient
      .from('issue_groups')
      .update(payload)
      .eq('id', existing.id)
      .select('*')
      .single()
    return { data, error }
  }

  const { data, error } = await supabaseClient
    .from('issue_groups')
    .insert({ ...payload, created_at: payload.first_seen_at })
    .select('*')
    .single()
  return { data, error }
}

export const recordIssueEvent = async (payload = {}, options = {}) => {
  const supabaseClient = options.supabaseClient || supabase
  const record = buildIssueEventRecord(payload, options)
  const { data: event, error } = await supabaseClient
    .from('issue_events')
    .insert(record)
    .select('*')
    .single()

  if (error) {
    return { ok: false, event: null, group: null, error }
  }

  const { data: group, error: groupError } = await upsertIssueGroupForEvent(record, event, options)
  if (groupError) {
    return { ok: false, event, group: null, error: groupError }
  }

  if (group) {
    queueIssueAlertForGroup(group).catch(() => {})
  }

  return { ok: true, event, group, error: null }
}

export const queueIssueEvent = async (payload = {}, options = {}) => {
  try {
    return await recordIssueEvent(payload, options)
  } catch (error) {
    return { ok: false, event: null, group: null, error }
  }
}

export const queueProviderIssue = (error, {
  operation = 'provider_request',
  provider = '',
  model = '',
  requestId = '',
  payload = {},
  upstreamEndpoint = '',
  upstreamStatus = null
} = {}) => queueIssueEvent({
  source_layer: 'provider',
  category: 'provider_error',
  severity: Number(error?.status || upstreamStatus || 0) >= 500 ? 'p1' : 'p2',
  request_id: requestId,
  provider,
  model,
  upstream_endpoint: upstreamEndpoint,
  upstream_status: Number.isFinite(Number(upstreamStatus || error?.status))
    ? Number(upstreamStatus || error?.status)
    : null,
  error_code: error?.code || error?.name || 'PROVIDER_ERROR',
  message_summary: error?.message || 'Provider request failed',
  stack_summary: error?.stack || '',
  metadata: {
    operation,
    request_options_provider: provider,
    payload_model: payload?.model || payload?.model_name || '',
    task_id: payload?.task_id || payload?.taskId || payload?.request_id || ''
  }
})

export const queueDatabaseIssue = (error, {
  requestId = '',
  userId = '',
  method = '',
  pathTemplate = '',
  table = '',
  operation = ''
} = {}) => queueIssueEvent({
  source_layer: 'database',
  category: 'db_error',
  severity: 'p1',
  request_id: requestId,
  user_id: userId,
  method,
  path_template: pathTemplate,
  db_table: table,
  db_operation: operation,
  db_code: error?.code || '',
  error_code: error?.code || error?.name || 'DB_ERROR',
  message_summary: error?.message || 'Database operation failed',
  stack_summary: error?.stack || '',
  metadata: {
    details: error?.details || '',
    hint: error?.hint || ''
  }
})
