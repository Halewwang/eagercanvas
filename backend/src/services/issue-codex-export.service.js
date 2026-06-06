import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { supabase } from '../config/supabase.js'
import { HttpError } from '../utils/http.js'

export const CODEX_ISSUE_SCHEMA_VERSION = 'codex_issue_table/v1'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(__dirname, '../../..')
const DEFAULT_OUTPUT_DIR = path.join(repoRoot, 'docs/codex-issue-inbox')
const GROUP_COLUMNS = 'id, created_at, updated_at, first_seen_at, last_seen_at, fingerprint, source_layer, category, severity, status, title, event_count, affected_users, affected_sessions, affected_routes, affected_builds, latest_build_id, latest_release_commit, latest_request_id, sample_event_ids, root_cause_layer, root_cause_confidence, evidence_summary, codex_handoff, last_notified_at, notification_count'
const EVENT_COLUMNS = 'id, created_at, source_layer, category, severity, environment, build_id, release_commit, user_id, session_hash, request_id, trace_id, route, route_name, component, method, path_template, status_code, duration_ms, provider, model, upstream_endpoint, upstream_status, db_table, db_operation, db_code, error_code, message_summary, stack_summary, fingerprint, metadata'

const asArray = (value) => Array.isArray(value) ? value.filter(Boolean) : []
const uniq = (values = []) => [...new Set(values.filter(Boolean))]
const take = (values = [], limit = 10) => asArray(values).slice(0, limit)

const safeTimestamp = (value) => String(value || new Date().toISOString()).replace(/[:.]/g, '-')

const pickFromEvents = (events, key) => uniq(events.map((event) => event?.[key]).filter(Boolean))

const inferInvestigationSteps = (group, events = []) => {
  const steps = []
  const sourceLayer = String(group?.source_layer || '').toLowerCase()
  if (sourceLayer === 'frontend') {
    steps.push('Start with the frontend route/component and replay the latest request_id if present.')
  }
  if (sourceLayer === 'backend') {
    steps.push('Start with the backend route handler and middleware path matching method/path_template.')
  }
  if (sourceLayer === 'database' || pickFromEvents(events, 'db_table').length) {
    steps.push('Inspect Supabase query paths for the listed db_table/db_operation/db_code tuple.')
  }
  if (sourceLayer === 'provider' || pickFromEvents(events, 'provider').length) {
    steps.push('Inspect provider adapter, model payload, upstream_status, and usage/run status handoff.')
  }
  if (group?.latest_request_id) {
    steps.push('Trace latest_request_id across frontend API call, backend logs, provider response, and usage ledger.')
  }
  if (!steps.length) steps.push('Use sample_events to locate the first failing layer and compare neighboring successful requests.')
  return steps
}

export const createCodexIssueTable = ({
  details = [],
  generatedAt = new Date().toISOString()
} = {}) => {
  const issues = details.map(({ group, events = [] }) => {
    const eventList = asArray(events)
    const frontendRoutes = uniq([
      ...asArray(group?.evidence_summary?.routes),
      ...pickFromEvents(eventList, 'route'),
      ...pickFromEvents(eventList, 'route_name')
    ])
    const apiPaths = uniq([
      ...asArray(group?.evidence_summary?.api_paths),
      ...pickFromEvents(eventList, 'path_template')
    ])
    const providers = uniq([
      ...asArray(group?.evidence_summary?.providers),
      ...pickFromEvents(eventList, 'provider')
    ])
    const models = uniq([
      ...asArray(group?.evidence_summary?.models),
      ...pickFromEvents(eventList, 'model')
    ])
    const requestIds = uniq([
      group?.latest_request_id,
      ...asArray(group?.evidence_summary?.request_ids),
      ...pickFromEvents(eventList, 'request_id')
    ])

    const sampleEvents = eventList.slice(0, 10).map((event) => ({
      event_id: event.id,
      created_at: event.created_at,
      request_id: event.request_id || null,
      route: event.route_name || event.route || null,
      api_path: event.path_template || null,
      status_code: event.status_code || null,
      duration_ms: event.duration_ms || null,
      provider: event.provider || null,
      model: event.model || null,
      upstream_status: event.upstream_status || null,
      db_table: event.db_table || null,
      db_operation: event.db_operation || null,
      db_code: event.db_code || null,
      error_code: event.error_code || null,
      message_summary: event.message_summary || null
    }))

    return {
      issue_group_id: group.id,
      fingerprint: group.fingerprint,
      status: group.status,
      severity: group.severity,
      title: group.title,
      source_layer: group.source_layer,
      category: group.category,
      first_seen_at: group.first_seen_at,
      last_seen_at: group.last_seen_at,
      event_count: Number(group.event_count || 0),
      affected: {
        users: Number(group.affected_users || 0),
        sessions: Number(group.affected_sessions || 0),
        routes: Number(group.affected_routes || 0),
        builds: Number(group.affected_builds || 0)
      },
      primary_scope: {
        frontend: {
          routes: take(frontendRoutes),
          components: take(pickFromEvents(eventList, 'component'))
        },
        backend: {
          methods: take(pickFromEvents(eventList, 'method')),
          api_paths: take(apiPaths),
          status_codes: take(pickFromEvents(eventList, 'status_code')),
          request_ids: take(requestIds)
        },
        database: {
          tables: take(pickFromEvents(eventList, 'db_table')),
          operations: take(pickFromEvents(eventList, 'db_operation')),
          codes: take(pickFromEvents(eventList, 'db_code'))
        },
        provider: {
          providers: take(providers),
          models: take(models),
          endpoints: take(pickFromEvents(eventList, 'upstream_endpoint')),
          upstream_statuses: take(pickFromEvents(eventList, 'upstream_status'))
        }
      },
      root_cause: {
        suspected_layer: group.root_cause_layer || group.source_layer || 'unknown',
        confidence: group.root_cause_confidence || 'unknown',
        hints: asArray(group.codex_handoff?.root_cause_hints)
      },
      codex_diagnosis_inputs: {
        latest_request_id: group.latest_request_id || null,
        latest_build_id: group.latest_build_id || null,
        latest_release_commit: group.latest_release_commit || null,
        evidence_summary: group.evidence_summary || {},
        sample_events: sampleEvents
      },
      suggested_investigation: inferInvestigationSteps(group, eventList)
    }
  })

  return {
    schema: CODEX_ISSUE_SCHEMA_VERSION,
    generated_at: generatedAt,
    issue_count: issues.length,
    issues
  }
}

export const renderCodexIssueMarkdown = (table) => {
  const lines = [
    '# Codex Issue Inbox',
    '',
    `Schema: \`${table.schema}\``,
    `Generated: ${table.generated_at}`,
    `Issues: ${table.issue_count}`,
    '',
    '| Severity | Layer | Status | Title | Scope | Latest request | Suggested start |',
    '| --- | --- | --- | --- | --- | --- | --- |'
  ]

  table.issues.forEach((issue) => {
    const scope = [
      issue.primary_scope.frontend.routes[0],
      issue.primary_scope.backend.api_paths[0],
      issue.primary_scope.provider.models[0],
      issue.primary_scope.database.tables[0]
    ].filter(Boolean).join('<br>') || '-'
    const start = issue.suggested_investigation[0] || '-'
    lines.push(`| ${issue.severity} | ${issue.source_layer} | ${issue.status} | ${issue.title} | ${scope} | ${issue.codex_diagnosis_inputs.latest_request_id || '-'} | ${start} |`)
  })

  table.issues.forEach((issue, index) => {
    lines.push(
      '',
      `## ${index + 1}. ${issue.title}`,
      '',
      `- Group: \`${issue.issue_group_id}\``,
      `- Fingerprint: \`${issue.fingerprint}\``,
      `- Root cause: ${issue.root_cause.suspected_layer} (${issue.root_cause.confidence})`,
      `- First/last seen: ${issue.first_seen_at} / ${issue.last_seen_at}`,
      `- Affected: ${issue.affected.users} users, ${issue.affected.sessions} sessions, ${issue.affected.routes} routes`,
      '',
      '### Sample Events',
      '',
      '```json',
      JSON.stringify(issue.codex_diagnosis_inputs.sample_events, null, 2),
      '```'
    )
  })

  return `${lines.join('\n')}\n`
}

export const writeCodexIssueExport = async ({
  details,
  outputDir = DEFAULT_OUTPUT_DIR,
  generatedAt = new Date().toISOString(),
  writeFile = fs.writeFile,
  mkdir = fs.mkdir
} = {}) => {
  const table = createCodexIssueTable({ details, generatedAt })
  await mkdir(outputDir, { recursive: true })
  const baseName = `issue-inbox-${safeTimestamp(generatedAt)}`
  const jsonPath = path.join(outputDir, `${baseName}.json`)
  const markdownPath = path.join(outputDir, `${baseName}.md`)
  await writeFile(jsonPath, `${JSON.stringify(table, null, 2)}\n`, 'utf8')
  await writeFile(markdownPath, renderCodexIssueMarkdown(table), 'utf8')
  return { table, jsonPath, markdownPath }
}

const buildGroupQuery = ({
  status = '',
  severity = '',
  sourceLayer = '',
  limit = 50
} = {}, supabaseClient) => {
  let query = supabaseClient
    .from('issue_groups')
    .select(GROUP_COLUMNS)

  if (status) query = query.eq('status', status)
  if (severity) query = query.in('severity', String(severity).split(',').map((item) => item.trim()).filter(Boolean))
  if (sourceLayer) query = query.eq('source_layer', sourceLayer)
  return query.order('last_seen_at', { ascending: false }).limit(Math.max(1, Math.min(100, Number(limit) || 50)))
}

const fetchEventsForFingerprints = async (fingerprints, supabaseClient) => {
  if (!fingerprints.length) return new Map()
  const { data, error } = await supabaseClient
    .from('issue_events')
    .select(EVENT_COLUMNS)
    .in('fingerprint', fingerprints)
    .order('created_at', { ascending: false })
    .limit(500)
  if (error) throw new HttpError(500, error.message, 'ISSUE_EXPORT_EVENTS_FAILED')
  const grouped = new Map()
  ;(data || []).forEach((event) => {
    const key = event.fingerprint
    if (!grouped.has(key)) grouped.set(key, [])
    grouped.get(key).push(event)
  })
  return grouped
}

export const exportCodexIssues = async ({
  filters = {},
  outputDir = DEFAULT_OUTPUT_DIR,
  generatedAt = new Date().toISOString(),
  supabaseClient = supabase
} = {}) => {
  const { data: groups, error } = await buildGroupQuery(filters, supabaseClient)
  if (error) throw new HttpError(500, error.message, 'ISSUE_EXPORT_GROUPS_FAILED')
  const fingerprints = uniq((groups || []).map((group) => group.fingerprint))
  const eventsByFingerprint = await fetchEventsForFingerprints(fingerprints, supabaseClient)
  const details = (groups || []).map((group) => ({
    group,
    events: eventsByFingerprint.get(group.fingerprint) || []
  }))
  const result = await writeCodexIssueExport({ details, outputDir, generatedAt })
  return {
    generatedAt,
    issueCount: result.table.issue_count,
    jsonPath: result.jsonPath,
    markdownPath: result.markdownPath,
    table: result.table
  }
}

export const getDefaultCodexIssueOutputDir = () => DEFAULT_OUTPUT_DIR
