import { supabase } from '../config/supabase.js'
import { HttpError } from '../utils/http.js'
import { mergeIssueGroupRows } from './issue-grouping.js'

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
  const rawEnd = 99

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
    .range(0, rawEnd)

  if (error) throw new HttpError(500, error.message, 'ISSUE_GROUP_QUERY_FAILED')
  const mergedItems = mergeIssueGroupRows(data || [])
  const pagedItems = mergedItems.slice(start, end + 1)

  return {
    items: pagedItems,
    pagination: {
      page: safePage,
      limit: safeLimit,
      total: mergedItems.length || Number(count || 0)
    }
  }
}

export const getIssueGroupForAdmin = async (issueGroupId, fallback = {}) => {
  const requestedGroupIds = splitCsv(fallback.groupIds || fallback.group_ids)
  const safeGroupIds = requestedGroupIds.includes(issueGroupId)
    ? requestedGroupIds
    : [issueGroupId, ...requestedGroupIds].filter(Boolean)

  const readGroups = async () => {
    if (safeGroupIds.length > 1) {
      return supabase
        .from('issue_groups')
        .select(ISSUE_GROUP_COLUMNS)
        .in('id', safeGroupIds)
    }
    const result = await supabase
      .from('issue_groups')
      .select(ISSUE_GROUP_COLUMNS)
      .eq('id', issueGroupId)
      .maybeSingle()
    return {
      data: result.data ? [result.data] : [],
      error: result.error
    }
  }

  const { data: groupRows, error } = await readGroups()

  if (error) throw new HttpError(500, error.message, 'ISSUE_GROUP_QUERY_FAILED')
  if (!groupRows?.length) throw new HttpError(404, 'Issue group not found', 'ISSUE_GROUP_NOT_FOUND')

  const fingerprints = groupRows.map((group) => group.fingerprint).filter(Boolean)
  if (!fingerprints.length && fallback.fingerprint) fingerprints.push(fallback.fingerprint)
  let events = []
  if (fingerprints.length) {
    let eventQuery = supabase
      .from('issue_events')
      .select(ISSUE_EVENT_COLUMNS)
    eventQuery = fingerprints.length === 1
      ? eventQuery.eq('fingerprint', fingerprints[0])
      : eventQuery.in('fingerprint', fingerprints)
    const { data: eventRows, error: eventsError } = await eventQuery
      .order('created_at', { ascending: false })
      .limit(50)
    if (eventsError) throw new HttpError(500, eventsError.message, 'ISSUE_EVENT_QUERY_FAILED')
    events = eventRows || []
  }

  const eventsByFingerprint = new Map()
  events.forEach((event) => {
    const bucket = eventsByFingerprint.get(event.fingerprint) || []
    bucket.push(event)
    eventsByFingerprint.set(event.fingerprint, bucket)
  })
  const mergedGroups = mergeIssueGroupRows(groupRows, { eventsByFingerprint })
  const group = mergedGroups[0] || groupRows[0]

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
