import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { supabase } from '../config/supabase.js'
import { HttpError } from '../utils/http.js'
import { mergeIssueDetails } from './issue-grouping.js'

export const CODEX_ISSUE_SCHEMA_VERSION = 'codex_issue_table/v1'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(__dirname, '../../..')
const DEFAULT_OUTPUT_DIR = path.join(repoRoot, 'docs/codex-issue-inbox')
const GROUP_COLUMNS = 'id, created_at, updated_at, first_seen_at, last_seen_at, fingerprint, source_layer, category, severity, status, title, event_count, affected_users, affected_sessions, affected_routes, affected_builds, latest_build_id, latest_release_commit, latest_request_id, sample_event_ids, root_cause_layer, root_cause_confidence, evidence_summary, codex_handoff, last_notified_at, notification_count'
const EVENT_COLUMNS = 'id, created_at, source_layer, category, severity, environment, build_id, release_commit, user_id, session_hash, request_id, trace_id, route, route_name, component, method, path_template, status_code, duration_ms, provider, model, upstream_endpoint, upstream_status, db_table, db_operation, db_code, error_code, message_summary, stack_summary, fingerprint, metadata'

const asArray = (value) => Array.isArray(value) ? value.filter(Boolean) : []
const uniq = (values = []) => [...new Set(values.filter(Boolean))]
const take = (values = [], limit = 10) => asArray(values).slice(0, limit)
const normalizeIssueGroupIds = (value = []) => {
  const rawValues = Array.isArray(value) ? value : String(value || '').split(',')
  return uniq(rawValues.map((item) => String(item || '').trim()).filter(Boolean)).slice(0, 100)
}

const safeTimestamp = (value) => String(value || new Date().toISOString()).replace(/[:.]/g, '-')

const pickFromEvents = (events, key) => uniq(events.map((event) => event?.[key]).filter(Boolean))

const normalizeIssuePathForOutput = (value = '') => String(value || '').replace(/^\/api\/v1(?=\/)/, '') || value

const buildRepoInfo = ({
  env = process.env,
  root = repoRoot
} = {}) => ({
  root,
  branch: env.VERCEL_GIT_COMMIT_REF
    || env.GITHUB_REF_NAME
    || env.GIT_BRANCH
    || env.BRANCH
    || 'unknown',
  commit: env.VERCEL_GIT_COMMIT_SHA
    || env.GITHUB_SHA
    || env.VITE_APP_RELEASE_COMMIT
    || env.RELEASE_COMMIT
    || 'unknown',
  build_id: env.VERCEL_DEPLOYMENT_ID
    || env.VITE_APP_BUILD_ID
    || env.BUILD_ID
    || 'unknown',
  environment: env.VERCEL_ENV || env.NODE_ENV || 'unknown'
})

const inferSuspectedFiles = (issue = {}) => {
  const paths = [
    ...asArray(issue.primary_scope?.backend?.api_paths),
    ...asArray(issue.primary_scope?.frontend?.routes)
  ].map(normalizeIssuePathForOutput)
  const files = new Set()
  const add = (...items) => items.filter(Boolean).forEach((item) => files.add(item))
  const text = [
    issue.title,
    issue.category,
    issue.source_layer,
    ...paths,
    ...asArray(issue.codex_diagnosis_inputs?.evidence_summary?.errors),
    ...asArray(issue.codex_diagnosis_inputs?.sample_events).flatMap((event) => [
      event.message_summary,
      event.stack_summary,
      event.api_path,
      event.route
    ])
  ].filter(Boolean).join(' ')

  if (/admin\/issues/i.test(text)) {
    add(
      'backend/src/routes/admin.routes.js',
      'backend/src/services/admin-issues.service.js',
      'backend/src/services/issue-codex-export.service.js',
      'src/hooks/useAdminIssueInbox.js',
      'src/components/admin/features/AdminIssueInboxSection.vue'
    )
  }
  if (/admin\/users/i.test(text)) {
    add(
      'backend/src/routes/admin.routes.js',
      'backend/src/services/admin-users-list.js',
      'src/views/AdminUsers.vue'
    )
  }
  if (/auth\/(me|refresh)/i.test(text)) {
    add(
      'backend/src/routes/auth.routes.js',
      'src/api/auth.js',
      'src/stores/auth.js',
      'src/utils/request.js'
    )
  }
  if (/images\/:taskid|images\/generations/i.test(text)) {
    add(
      'backend/src/routes/index.js',
      'backend/src/services/runs.service.js',
      'backend/src/services/run-task-records.js',
      'backend/src/services/run-assets.js'
    )
  }
  if (/projects(\/|:|$)/i.test(text)) {
    add(
      'backend/src/routes/projects.routes.js',
      'backend/src/services/projects.service.js',
      'src/api/projects.js'
    )
  }
  if (/workspace\/current\/templates|workspace\/workspaces/i.test(text)) {
    add(
      'backend/src/routes/workspace.routes.js',
      'backend/src/services/workspace.service.js',
      'src/api/workspace.js'
    )
  }
  if (/302\/(api-record|balance)/i.test(text)) {
    add(
      'backend/src/routes/admin.routes.js',
      'backend/src/services/dashboard302.service.js',
      'backend/src/services/admin-usage.service.js'
    )
  }
  if (issue.source_layer === 'provider' || issue.primary_scope?.provider?.providers?.length) {
    add(
      'backend/src/services/provider.service.js',
      'backend/src/services/provider-http-client.js',
      'backend/src/services/run-provider-access.js'
    )
  }
  if (/erofs|read-only file system/i.test(text)) {
    add(
      'backend/src/services/issue-codex-export.service.js',
      'backend/src/routes/admin.routes.js'
    )
  }
  if (issue.source_layer === 'frontend') {
    add('src/observability/index.js', 'src/utils/request.js')
  }
  return [...files]
}

const buildReproduction = (issue = {}) => {
  const route = issue.primary_scope?.frontend?.routes?.[0]
  const apiPath = issue.primary_scope?.backend?.api_paths?.[0]
  const steps = []
  if (route) steps.push(`Open ${route}.`)
  if (/admin\/issues\/export/.test(String(apiPath))) {
    steps.push('Click 导出 Codex in the admin Issue Inbox.')
  } else if (apiPath) {
    const method = issue.primary_scope?.backend?.methods?.[0] || 'GET'
    steps.push(`Trigger ${method} ${apiPath} and capture the request_id.`)
  }
  if (!steps.length) steps.push('Replay the latest_request_id and compare neighboring sample_events.')
  return {
    steps,
    requires_live_provider: Boolean(issue.primary_scope?.provider?.providers?.length),
    requires_admin_session: steps.some((step) => /admin/i.test(step))
  }
}

const buildValidation = (issue = {}) => {
  const commands = new Set(['npm run check'])
  if (['backend', 'database', 'provider', 'performance'].includes(issue.source_layer)) commands.add('npm run test:backend')
  if (issue.source_layer === 'frontend') commands.add('npm run test:frontend')
  commands.add('npm run build')
  const browserSmoke = []
  const route = issue.primary_scope?.frontend?.routes?.[0]
  if (route) browserSmoke.push(`${route} with VITE_BYPASS_AUTH=true`)
  if (/admin\/issues/i.test(String(issue.primary_scope?.backend?.api_paths?.[0] || ''))) {
    browserSmoke.push('/admin/issues export and detail smoke')
  }
  return {
    commands: [...commands],
    browser_smoke: uniq(browserSmoke)
  }
}

const getRootCauseHints = (group = {}) => asArray(group.codex_handoff?.root_cause_hints)

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
  generatedAt = new Date().toISOString(),
  filters = {},
  repo = buildRepoInfo()
} = {}) => {
  const mergedDetails = mergeIssueDetails(details)
  const issues = mergedDetails.map(({ group, events = [] }, index) => {
    const eventList = asArray(events)
    const frontendRoutes = uniq([
      ...asArray(group?.evidence_summary?.routes),
      ...pickFromEvents(eventList, 'route'),
      ...pickFromEvents(eventList, 'route_name')
    ])
    const apiPaths = uniq([
      ...asArray(group?.evidence_summary?.api_paths),
      ...pickFromEvents(eventList, 'path_template')
    ].map(normalizeIssuePathForOutput))
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
      message_summary: event.message_summary || null,
      stack_summary: event.stack_summary || null
    }))

    const issue = {
      id: `ISS-${String(generatedAt).slice(0, 10).replace(/-/g, '')}-${String(index + 1).padStart(3, '0')}`,
      issue_group_id: group.id,
      merged_issue_group_ids: asArray(group.merged_group_ids).length ? group.merged_group_ids : [group.id],
      merged_group_count: Number(group.merged_group_count || 1),
      fingerprint: group.fingerprint,
      status: group.status,
      severity: group.severity,
      priority: String(group.severity || '').toUpperCase(),
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
        hints: getRootCauseHints(group)
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
    const suspectedFiles = uniq([
      ...asArray(group.codex_handoff?.suspected_files),
      ...inferSuspectedFiles(issue)
    ])
    return {
      ...issue,
      impact: {
        events: issue.event_count,
        affected_users: issue.affected.users,
        affected_sessions: issue.affected.sessions,
        affected_routes: issue.affected.routes,
        first_seen: issue.first_seen_at,
        last_seen: issue.last_seen_at
      },
      evidence: {
        routes: issue.primary_scope.frontend.routes,
        api_paths: issue.primary_scope.backend.api_paths,
        request_ids: issue.primary_scope.backend.request_ids,
        providers: issue.primary_scope.provider.providers,
        models: issue.primary_scope.provider.models,
        db_tables: issue.primary_scope.database.tables,
        db_operations: issue.primary_scope.database.operations,
        db_codes: issue.primary_scope.database.codes,
        errors: asArray(group.evidence_summary?.errors)
      },
      root_cause_hints: issue.root_cause.hints,
      suspected_files: suspectedFiles,
      reproduction: buildReproduction(issue),
      validation: buildValidation(issue),
      redaction: {
        prompt_omitted: true,
        media_omitted: true,
        user_exported_as_hash: true
      }
    }
  })

  return {
    schema: CODEX_ISSUE_SCHEMA_VERSION,
    schema_version: CODEX_ISSUE_SCHEMA_VERSION,
    generated_at: generatedAt,
    repo,
    filters,
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
    '| Priority | Source | Issue ID | Title | Impact | Evidence | Root-Cause Signal | Suspected Files | Repro | Validation |',
    '| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |'
  ]

  table.issues.forEach((issue) => {
    const scope = [
      issue.primary_scope.frontend.routes[0],
      issue.primary_scope.backend.api_paths[0],
      issue.primary_scope.provider.models[0],
      issue.primary_scope.database.tables[0]
    ].filter(Boolean).join('<br>') || '-'
    const impact = `${issue.impact.events} events, ${issue.impact.affected_users} users`
    const rootSignal = issue.root_cause_hints[0] || issue.root_cause.suspected_layer || '-'
    const suspectedFiles = issue.suspected_files.slice(0, 3).join('<br>') || '-'
    const repro = issue.reproduction.steps[0] || '-'
    const validation = issue.validation.commands.join('<br>') || '-'
    lines.push(`| ${issue.priority} | ${issue.source_layer} | ${issue.id} | ${issue.title} | ${impact} | ${scope} | ${rootSignal} | ${suspectedFiles} | ${repro} | ${validation} |`)
  })

  table.issues.forEach((issue, index) => {
    lines.push(
      '',
      `## ${index + 1}. ${issue.title}`,
      '',
      `- Group: \`${issue.issue_group_id}\``,
      `- Merged groups: ${issue.merged_issue_group_ids.map((id) => `\`${id}\``).join(', ')}`,
      `- Fingerprint: \`${issue.fingerprint}\``,
      `- Root cause: ${issue.root_cause.suspected_layer} (${issue.root_cause.confidence})`,
      `- First/last seen: ${issue.first_seen_at} / ${issue.last_seen_at}`,
      `- Affected: ${issue.affected.users} users, ${issue.affected.sessions} sessions, ${issue.affected.routes} routes`,
      `- Suspected files: ${issue.suspected_files.map((file) => `\`${file}\``).join(', ') || '-'}`,
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

export const buildCodexIssueExportPayload = ({
  details,
  generatedAt = new Date().toISOString(),
  filters = {},
  repo = buildRepoInfo()
} = {}) => {
  const table = createCodexIssueTable({ details, generatedAt, filters, repo })
  const baseName = `issue-inbox-${safeTimestamp(generatedAt)}`
  const jsonFileName = `${baseName}.json`
  const markdownFileName = `${baseName}.md`
  const jsonContent = `${JSON.stringify(table, null, 2)}\n`
  const markdownContent = renderCodexIssueMarkdown(table)
  return {
    table,
    jsonFileName,
    markdownFileName,
    jsonContent,
    markdownContent
  }
}

export const writeCodexIssueExport = async ({
  details,
  outputDir = DEFAULT_OUTPUT_DIR,
  generatedAt = new Date().toISOString(),
  filters = {},
  repo = buildRepoInfo(),
  writeFile = fs.writeFile,
  mkdir = fs.mkdir
} = {}) => {
  const payload = buildCodexIssueExportPayload({ details, generatedAt, filters, repo })
  await mkdir(outputDir, { recursive: true })
  const jsonPath = path.join(outputDir, payload.jsonFileName)
  const markdownPath = path.join(outputDir, payload.markdownFileName)
  await writeFile(jsonPath, payload.jsonContent, 'utf8')
  await writeFile(markdownPath, payload.markdownContent, 'utf8')
  return { ...payload, jsonPath, markdownPath }
}

const buildGroupQuery = ({
  status = '',
  severity = '',
  sourceLayer = '',
  issueGroupIds = [],
  issue_group_ids = [],
  limit = 50
} = {}, supabaseClient) => {
  let query = supabaseClient
    .from('issue_groups')
    .select(GROUP_COLUMNS)

  const selectedGroupIds = normalizeIssueGroupIds(issueGroupIds.length ? issueGroupIds : issue_group_ids)
  if (selectedGroupIds.length) {
    query = query.in('id', selectedGroupIds)
    return query
      .order('last_seen_at', { ascending: false })
      .limit(Math.max(1, Math.min(100, selectedGroupIds.length)))
  }

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
  supabaseClient = supabase,
  writeFiles = true
} = {}) => {
  const { data: groups, error } = await buildGroupQuery(filters, supabaseClient)
  if (error) throw new HttpError(500, error.message, 'ISSUE_EXPORT_GROUPS_FAILED')
  const fingerprints = uniq((groups || []).map((group) => group.fingerprint))
  const eventsByFingerprint = await fetchEventsForFingerprints(fingerprints, supabaseClient)
  const details = (groups || []).map((group) => ({
    group,
    events: eventsByFingerprint.get(group.fingerprint) || []
  }))
  const result = writeFiles
    ? await writeCodexIssueExport({ details, outputDir, generatedAt, filters })
    : buildCodexIssueExportPayload({ details, generatedAt, filters })
  return {
    generatedAt,
    issueCount: result.table.issue_count,
    jsonPath: result.jsonPath,
    markdownPath: result.markdownPath,
    jsonFileName: result.jsonFileName,
    markdownFileName: result.markdownFileName,
    jsonContent: result.jsonContent,
    markdownContent: result.markdownContent,
    table: result.table
  }
}

export const getDefaultCodexIssueOutputDir = () => DEFAULT_OUTPUT_DIR
