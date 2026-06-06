import { supabase } from '../config/supabase.js'
import { HttpError } from '../utils/http.js'

const ISSUE_GROUP_COLUMNS = 'id, created_at, updated_at, first_seen_at, last_seen_at, fingerprint, source_layer, category, severity, status, title, event_count, affected_users, affected_sessions, affected_routes, affected_builds, latest_build_id, latest_release_commit, latest_request_id, sample_event_ids, root_cause_layer, root_cause_confidence, evidence_summary, codex_handoff, last_notified_at, notification_count'
const ISSUE_EVENT_COLUMNS = 'id, created_at, source_layer, category, severity, environment, build_id, release_commit, user_id, session_hash, request_id, trace_id, route, route_name, component, method, path_template, status_code, duration_ms, provider, model, upstream_endpoint, upstream_status, db_table, db_operation, db_code, error_code, message_summary, stack_summary, fingerprint, metadata'
const ALLOWED_STATUSES = new Set(['open', 'investigating', 'resolved', 'ignored'])

const splitCsv = (value) => String(value || '')
  .split(',')
  .map((item) => item.trim())
  .filter(Boolean)

const normalizePage = (page) => Math.max(1, Number(page) || 1)
const normalizeLimit = (limit) => Math.max(1, Math.min(100, Number(limit) || 20))

export const listIssueGroupsForAdmin = async ({
  status = '',
  severity = '',
  sourceLayer = '',
  category = '',
  from = '',
  to = '',
  page = 1,
  limit = 20
} = {}) => {
  const safePage = normalizePage(page)
  const safeLimit = normalizeLimit(limit)
  const start = (safePage - 1) * safeLimit
  const end = start + safeLimit - 1

  let query = supabase
    .from('issue_groups')
    .select(ISSUE_GROUP_COLUMNS, { count: 'exact' })

  if (status) query = query.eq('status', status)
  const severities = splitCsv(severity)
  if (severities.length) query = query.in('severity', severities)
  if (sourceLayer) query = query.eq('source_layer', sourceLayer)
  if (category) query = query.eq('category', category)
  if (from) query = query.gte('last_seen_at', from)
  if (to) query = query.lte('last_seen_at', to)

  const { data, error, count } = await query
    .order('last_seen_at', { ascending: false })
    .range(start, end)

  if (error) throw new HttpError(500, error.message, 'ISSUE_GROUP_QUERY_FAILED')

  return {
    items: data || [],
    pagination: {
      page: safePage,
      limit: safeLimit,
      total: Number(count || 0)
    }
  }
}

export const getIssueGroupForAdmin = async (issueGroupId, fallback = {}) => {
  const { data: group, error } = await supabase
    .from('issue_groups')
    .select(ISSUE_GROUP_COLUMNS)
    .eq('id', issueGroupId)
    .maybeSingle()

  if (error) throw new HttpError(500, error.message, 'ISSUE_GROUP_QUERY_FAILED')
  if (!group) throw new HttpError(404, 'Issue group not found', 'ISSUE_GROUP_NOT_FOUND')

  const fingerprint = group.fingerprint || fallback.fingerprint
  let events = []
  if (fingerprint) {
    const { data: eventRows, error: eventsError } = await supabase
      .from('issue_events')
      .select(ISSUE_EVENT_COLUMNS)
      .eq('fingerprint', fingerprint)
      .order('created_at', { ascending: false })
      .limit(50)
    if (eventsError) throw new HttpError(500, eventsError.message, 'ISSUE_EVENT_QUERY_FAILED')
    events = eventRows || []
  }

  return { group, events }
}

export const updateIssueGroupStatus = async (issueGroupId, status) => {
  const nextStatus = String(status || '').trim()
  if (!ALLOWED_STATUSES.has(nextStatus)) {
    throw new HttpError(400, 'Unsupported issue status', 'ISSUE_STATUS_UNSUPPORTED')
  }

  const { data, error } = await supabase
    .from('issue_groups')
    .update({ status: nextStatus, updated_at: new Date().toISOString() })
    .eq('id', issueGroupId)
    .select(ISSUE_GROUP_COLUMNS)
    .single()

  if (error) throw new HttpError(500, error.message, 'ISSUE_GROUP_UPDATE_FAILED')
  return data
}
