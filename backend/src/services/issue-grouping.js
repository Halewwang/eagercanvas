import { normalizeIssuePath } from './issue-fingerprint.js'

const MAX_MERGED_VALUES = 50
const SEVERITY_RANK = { p0: 0, p1: 1, p2: 2, p3: 3 }
const STATUS_RANK = { open: 0, investigating: 1, resolved: 2, ignored: 3 }

const asArray = (value) => Array.isArray(value) ? value.filter(Boolean) : []
const clean = (value) => String(value || '').trim().toLowerCase()
const uniq = (values = []) => [...new Set(values.filter(Boolean))]
const take = (values = [], limit = MAX_MERGED_VALUES) => asArray(values).slice(0, limit)

const normalizePathForMerge = (value = '') => {
  const normalized = normalizeIssuePath(value).replace(/^\/api\/v1(?=\/)/, '')
  return normalized || ''
}

const severitySort = (a, b) => (SEVERITY_RANK[a?.severity] ?? 99) - (SEVERITY_RANK[b?.severity] ?? 99)
const statusSort = (a, b) => (STATUS_RANK[a?.status] ?? 99) - (STATUS_RANK[b?.status] ?? 99)

const getEventValues = (events, key) => events.map((event) => event?.[key]).filter(Boolean)

const getEvidence = (group = {}, events = []) => {
  const summary = group.evidence_summary || {}
  const handoffEvidence = group.codex_handoff?.evidence || {}
  return {
    routes: uniq([
      ...asArray(summary.routes),
      handoffEvidence.route,
      ...getEventValues(events, 'route'),
      ...getEventValues(events, 'route_name')
    ]),
    apiPaths: uniq([
      ...asArray(summary.api_paths),
      handoffEvidence.api_path,
      ...getEventValues(events, 'path_template')
    ]),
    methods: uniq([
      handoffEvidence.method,
      ...getEventValues(events, 'method')
    ]),
    statusCodes: uniq(getEventValues(events, 'status_code').map((value) => String(value))),
    providers: uniq([
      ...asArray(summary.providers),
      handoffEvidence.provider,
      ...getEventValues(events, 'provider')
    ]),
    models: uniq([
      ...asArray(summary.models),
      handoffEvidence.model,
      ...getEventValues(events, 'model')
    ]),
    errors: uniq([
      ...asArray(summary.errors),
      handoffEvidence.error_code,
      handoffEvidence.db_code,
      handoffEvidence.message_summary,
      ...getEventValues(events, 'error_code'),
      ...getEventValues(events, 'db_code'),
      ...getEventValues(events, 'message_summary')
    ]),
    users: uniq([
      ...asArray(summary.users),
      ...getEventValues(events, 'user_id')
    ]),
    sessions: uniq([
      ...asArray(summary.sessions),
      ...getEventValues(events, 'session_hash')
    ]),
    builds: uniq([
      ...asArray(summary.builds),
      group.latest_build_id,
      ...getEventValues(events, 'build_id')
    ]),
    requestIds: uniq([
      ...asArray(summary.request_ids),
      group.latest_request_id,
      ...getEventValues(events, 'request_id')
    ]),
    dbTables: uniq(getEventValues(events, 'db_table')),
    dbOperations: uniq(getEventValues(events, 'db_operation')),
    dbCodes: uniq([
      handoffEvidence.db_code,
      ...getEventValues(events, 'db_code')
    ]),
    upstreamEndpoints: uniq(getEventValues(events, 'upstream_endpoint')),
    upstreamStatuses: uniq(getEventValues(events, 'upstream_status').map((value) => String(value)))
  }
}

const hasFilesystemError = (evidence) => evidence.errors.some((error) => /erofs|read-only file system/i.test(String(error)))

const normalizeError = (evidence, group = {}) => {
  if (hasFilesystemError(evidence)) return 'erofs'
  const error = evidence.errors.find(Boolean) || group.error_code || group.category || 'issue'
  return clean(error).replace(/slow request:\s*\d+ms/g, 'slow_request')
}

const primaryPath = (evidence) => normalizePathForMerge(evidence.apiPaths[0] || evidence.routes[0] || '')

export const getIssueMergeKey = ({ group = {}, events = [] } = {}) => {
  const eventList = asArray(events)
  const evidence = getEvidence(group, eventList)
  const error = normalizeError(evidence, group)
  const path = primaryPath(evidence)
  const method = clean(evidence.methods[0] || '')
  const sourceLayer = clean(group.source_layer)
  const category = clean(group.category)

  if (error === 'erofs') return ['filesystem', error, method, path].join('|')
  if (category === 'slow_request' || sourceLayer === 'performance') {
    return ['performance', 'slow_request', method, path].join('|')
  }
  if (sourceLayer === 'provider' || evidence.providers.length || evidence.models.length) {
    return [
      'provider',
      category,
      clean(evidence.providers[0]),
      clean(evidence.models[0]),
      normalizePathForMerge(evidence.upstreamEndpoints[0] || ''),
      error
    ].join('|')
  }
  return [
    sourceLayer || 'unknown',
    category || 'issue',
    method,
    path,
    clean(evidence.statusCodes[0] || ''),
    error
  ].join('|')
}

const mergeEvidenceSummary = (groups = [], events = []) => {
  const allEvidence = groups.map((group) => getEvidence(group, events.filter((event) => event.fingerprint === group.fingerprint)))
  return {
    users: take(uniq(allEvidence.flatMap((evidence) => evidence.users))),
    sessions: take(uniq(allEvidence.flatMap((evidence) => evidence.sessions))),
    routes: take(uniq(allEvidence.flatMap((evidence) => evidence.routes))),
    builds: take(uniq(allEvidence.flatMap((evidence) => evidence.builds))),
    providers: take(uniq(allEvidence.flatMap((evidence) => evidence.providers))),
    models: take(uniq(allEvidence.flatMap((evidence) => evidence.models))),
    api_paths: take(uniq(allEvidence.flatMap((evidence) => evidence.apiPaths).map(normalizePathForMerge))),
    request_ids: take(uniq(allEvidence.flatMap((evidence) => evidence.requestIds))),
    errors: take(uniq(allEvidence.flatMap((evidence) => evidence.errors).map((error) => String(error || '').replace(/Slow request:\s*\d+ms/i, 'Slow request'))))
  }
}

const minDate = (values = []) => values.filter(Boolean).sort()[0] || null
const maxDate = (values = []) => values.filter(Boolean).sort().at(-1) || null

const buildMergedTitle = (representative, evidenceSummary, key) => {
  const path = evidenceSummary.api_paths?.[0] || evidenceSummary.routes?.[0] || ''
  if (key.startsWith('filesystem|erofs')) return ['backend', 'EROFS', path].filter(Boolean).join(' ')
  if (key.startsWith('performance|slow_request')) return ['performance', 'slow_request', path].filter(Boolean).join(' ')
  return representative.title || [representative.source_layer, representative.category, path].filter(Boolean).join(' ')
}

const mergeCodexHandoff = (groups, evidenceSummary, rootCauseLayer) => ({
  schema_version: 'codex_issue_table/v1',
  evidence_summary: evidenceSummary,
  evidence: {
    source_layer: rootCauseLayer,
    route: evidenceSummary.routes?.[0] || 'unknown',
    api_path: evidenceSummary.api_paths?.[0] || 'unknown',
    request_id: evidenceSummary.request_ids?.[0] || 'unknown',
    provider: evidenceSummary.providers?.[0] || 'unknown',
    model: evidenceSummary.models?.[0] || 'unknown',
    error_code: evidenceSummary.errors?.[0] || 'unknown',
    message_summary: evidenceSummary.errors?.[0] || 'unknown'
  },
  root_cause_hints: take(uniq(groups.flatMap((group) => asArray(group.codex_handoff?.root_cause_hints)))),
  suspected_files: take(uniq(groups.flatMap((group) => asArray(group.codex_handoff?.suspected_files))))
})

export const mergeIssueGroupRows = (groups = [], { eventsByFingerprint = new Map() } = {}) => {
  const buckets = new Map()
  asArray(groups).forEach((group) => {
    const events = eventsByFingerprint.get(group.fingerprint) || []
    const key = getIssueMergeKey({ group, events })
    const bucket = buckets.get(key) || []
    bucket.push(group)
    buckets.set(key, bucket)
  })

  return [...buckets.entries()].map(([key, bucketGroups]) => {
    const sorted = [...bucketGroups].sort((a, b) => {
      const severityDelta = severitySort(a, b)
      if (severityDelta) return severityDelta
      return String(b.last_seen_at || '').localeCompare(String(a.last_seen_at || ''))
    })
    const representative = sorted[0]
    const allEvents = bucketGroups.flatMap((group) => eventsByFingerprint.get(group.fingerprint) || [])
    const evidenceSummary = mergeEvidenceSummary(bucketGroups, allEvents)
    const rootCauseLayer = key.startsWith('filesystem|erofs') ? 'backend' : representative.root_cause_layer || representative.source_layer || 'unknown'
    const status = [...bucketGroups].sort(statusSort)[0]?.status || representative.status || 'open'
    const latestGroup = [...bucketGroups].sort((a, b) => String(b.last_seen_at || '').localeCompare(String(a.last_seen_at || '')))[0] || representative

    return {
      ...representative,
      id: representative.id,
      title: buildMergedTitle(representative, evidenceSummary, key),
      source_layer: rootCauseLayer,
      category: key.startsWith('filesystem|erofs') ? 'filesystem_error' : representative.category,
      status,
      event_count: bucketGroups.reduce((total, group) => total + Number(group.event_count || 0), 0),
      affected_users: evidenceSummary.users.length || Math.max(...bucketGroups.map((group) => Number(group.affected_users || 0)), 0),
      affected_sessions: evidenceSummary.sessions.length || Math.max(...bucketGroups.map((group) => Number(group.affected_sessions || 0)), 0),
      affected_routes: evidenceSummary.routes.length || Math.max(...bucketGroups.map((group) => Number(group.affected_routes || 0)), 0),
      affected_builds: evidenceSummary.builds.length || Math.max(...bucketGroups.map((group) => Number(group.affected_builds || 0)), 0),
      first_seen_at: minDate(bucketGroups.map((group) => group.first_seen_at)),
      last_seen_at: maxDate(bucketGroups.map((group) => group.last_seen_at)),
      latest_request_id: latestGroup.latest_request_id || representative.latest_request_id,
      latest_build_id: latestGroup.latest_build_id || representative.latest_build_id,
      latest_release_commit: latestGroup.latest_release_commit || representative.latest_release_commit,
      sample_event_ids: take(uniq(bucketGroups.flatMap((group) => asArray(group.sample_event_ids))), 10),
      root_cause_layer: rootCauseLayer,
      root_cause_confidence: bucketGroups.length > 1 ? 'high' : representative.root_cause_confidence,
      evidence_summary: evidenceSummary,
      codex_handoff: mergeCodexHandoff(bucketGroups, evidenceSummary, rootCauseLayer),
      merged_group_ids: bucketGroups.map((group) => group.id),
      merged_group_count: bucketGroups.length,
      merged_fingerprints: bucketGroups.map((group) => group.fingerprint).filter(Boolean)
    }
  }).sort((a, b) => String(b.last_seen_at || '').localeCompare(String(a.last_seen_at || '')))
}

export const mergeIssueDetails = (details = []) => {
  const eventsByFingerprint = new Map()
  asArray(details).forEach(({ group, events = [] }) => {
    eventsByFingerprint.set(group?.fingerprint, asArray(events))
  })
  const mergedGroups = mergeIssueGroupRows(details.map((detail) => detail.group), { eventsByFingerprint })
  return mergedGroups.map((group) => ({
    group,
    events: group.merged_fingerprints.flatMap((fingerprint) => eventsByFingerprint.get(fingerprint) || [])
      .sort((a, b) => String(b.created_at || '').localeCompare(String(a.created_at || '')))
  }))
}
