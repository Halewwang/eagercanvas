import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildCodexIssueExportPayload,
  CODEX_ISSUE_SCHEMA_VERSION,
  createCodexIssueTable,
  exportCodexIssues,
  renderCodexIssueMarkdown,
  writeCodexIssueExport
} from './issue-codex-export.service.js'

const details = [{
  group: {
    id: 'group-1',
    fingerprint: 'sha256:abc',
    status: 'open',
    severity: 'p1',
    title: 'provider COMPLETED_WITHOUT_ASSET gpt-image-2',
    source_layer: 'provider',
    category: 'provider_error',
    first_seen_at: '2026-06-06T00:00:00.000Z',
    last_seen_at: '2026-06-06T00:01:00.000Z',
    event_count: 2,
    affected_users: 1,
    affected_sessions: 1,
    affected_routes: 1,
    affected_builds: 1,
    latest_request_id: 'req-1',
    latest_build_id: 'build-1',
    latest_release_commit: 'commit-1',
    root_cause_layer: 'provider',
    root_cause_confidence: 'high',
    evidence_summary: {
      routes: ['/canvas/new'],
      providers: ['302ai'],
      models: ['gpt-image-2'],
      request_ids: ['req-1']
    },
    codex_handoff: {
      root_cause_hints: ['Provider/model metadata is available.']
    }
  },
  events: [{
    id: 'event-1',
    created_at: '2026-06-06T00:01:00.000Z',
    request_id: 'req-1',
    route: '/canvas/new',
    method: 'POST',
    path_template: '/api/v1/runs/image',
    status_code: 502,
    provider: '302ai',
    model: 'gpt-image-2',
    upstream_status: 200,
    error_code: 'COMPLETED_WITHOUT_ASSET',
    message_summary: 'completed without asset',
    fingerprint: 'sha256:abc'
  }]
}]

test('createCodexIssueTable organizes issue data for cross-layer Codex diagnosis', () => {
  const table = createCodexIssueTable({
    details,
    generatedAt: '2026-06-06T00:02:00.000Z'
  })

  assert.equal(table.schema, CODEX_ISSUE_SCHEMA_VERSION)
  assert.equal(table.issue_count, 1)
  assert.equal(table.issues[0].primary_scope.provider.models[0], 'gpt-image-2')
  assert.equal(table.issues[0].primary_scope.backend.api_paths[0], '/runs/image')
  assert.equal(table.issues[0].codex_diagnosis_inputs.latest_request_id, 'req-1')
  assert.match(table.issues[0].suggested_investigation.join(' '), /provider adapter/)
})

test('renderCodexIssueMarkdown includes table and sample event evidence', () => {
  const table = createCodexIssueTable({ details, generatedAt: '2026-06-06T00:02:00.000Z' })
  const markdown = renderCodexIssueMarkdown(table)
  assert.match(markdown, /# Codex Issue Inbox/)
  assert.match(markdown, /codex_issue_table\/v1/)
  assert.match(markdown, /COMPLETED_WITHOUT_ASSET/)
  assert.match(markdown, /req-1/)
})

test('writeCodexIssueExport writes json and markdown files with deterministic names', async () => {
  const writes = []
  const result = await writeCodexIssueExport({
    details,
    outputDir: '/tmp/codex-issues',
    generatedAt: '2026-06-06T00:02:00.000Z',
    mkdir: async (dir, options) => writes.push(['mkdir', dir, options]),
    writeFile: async (file, content) => writes.push(['writeFile', file, content])
  })

  assert.equal(result.table.issue_count, 1)
  assert.ok(writes.some((call) => call[0] === 'mkdir' && call[1] === '/tmp/codex-issues'))
  assert.ok(writes.some((call) => call[1].endsWith('issue-inbox-2026-06-06T00-02-00-000Z.json')))
  assert.ok(writes.some((call) => call[1].endsWith('issue-inbox-2026-06-06T00-02-00-000Z.md')))
})

test('buildCodexIssueExportPayload returns downloadable content without writing files', () => {
  const payload = buildCodexIssueExportPayload({
    details,
    generatedAt: '2026-06-06T00:02:00.000Z'
  })

  assert.equal(payload.jsonFileName, 'issue-inbox-2026-06-06T00-02-00-000Z.json')
  assert.equal(payload.markdownFileName, 'issue-inbox-2026-06-06T00-02-00-000Z.md')
  assert.match(payload.jsonContent, /"schema": "codex_issue_table\/v1"/)
  assert.match(payload.markdownContent, /# Codex Issue Inbox/)
})

test('exportCodexIssues limits export to selected issue group ids', async () => {
  const calls = []
  const makeGroup = (id, fingerprint, path) => ({
    id,
    fingerprint,
    status: 'open',
    severity: 'p2',
    title: `performance slow_request ${path}`,
    source_layer: 'performance',
    category: 'slow_request',
    first_seen_at: '2026-06-06T00:00:00.000Z',
    last_seen_at: '2026-06-06T00:01:00.000Z',
    event_count: 1,
    affected_users: 1,
    evidence_summary: {
      api_paths: [path],
      request_ids: [`req-${id}`],
      errors: ['Slow request']
    }
  })
  const supabaseClient = {
    from(table) {
      if (table === 'issue_groups') {
        return {
          select() { return this },
          in(column, values) {
            calls.push(['groups.in', column, values])
            return this
          },
          eq(column, value) {
            calls.push(['groups.eq', column, value])
            return this
          },
          order() { return this },
          limit(value) {
            calls.push(['groups.limit', value])
            return Promise.resolve({
              data: [
                makeGroup('issue-a', 'sha-a', '/api/v1/admin/issues'),
                makeGroup('issue-b', 'sha-b', '/api/v1/images/:taskId')
              ],
              error: null
            })
          }
        }
      }
      if (table === 'issue_events') {
        return {
          select() { return this },
          in(column, values) {
            calls.push(['events.in', column, values])
            return this
          },
          order() { return this },
          limit() {
            return Promise.resolve({ data: [], error: null })
          }
        }
      }
      throw new Error(`unexpected table ${table}`)
    }
  }

  const result = await exportCodexIssues({
    filters: {
      status: 'open',
      severity: 'p2',
      issueGroupIds: ['issue-a', 'issue-b']
    },
    generatedAt: '2026-06-06T00:02:00.000Z',
    supabaseClient,
    writeFiles: false
  })

  assert.deepEqual(
    calls.find((call) => call[0] === 'groups.in'),
    ['groups.in', 'id', ['issue-a', 'issue-b']]
  )
  assert.ok(!calls.some((call) => call[0] === 'groups.eq' && call[1] === 'status'))
  assert.ok(!calls.some((call) => call[0] === 'groups.eq' && call[1] === 'source_layer'))
  assert.equal(result.issueCount, 2)
  assert.deepEqual(result.table.issues.map((issue) => issue.issue_group_id).sort(), ['issue-a', 'issue-b'])
})

test('createCodexIssueTable merges similar groups and includes Codex repair context', () => {
  const table = createCodexIssueTable({
    details: [
      {
        group: {
          id: 'group-export-frontend',
          fingerprint: 'sha256:front',
          status: 'open',
          severity: 'p1',
          title: 'frontend INTERNAL_ERROR /admin/issues/export',
          source_layer: 'frontend',
          category: 'api_error',
          first_seen_at: '2026-06-06T00:00:00.000Z',
          last_seen_at: '2026-06-06T00:01:00.000Z',
          event_count: 1,
          affected_sessions: 1,
          latest_request_id: 'req-front',
          evidence_summary: {
            routes: ['/admin/issues'],
            api_paths: ['/admin/issues/export'],
            request_ids: ['req-front'],
            errors: ['INTERNAL_ERROR']
          },
          codex_handoff: {
            evidence: {
              message_summary: "EROFS: read-only file system, open '/var/task/docs/codex-issue-inbox/a.json'"
            },
            root_cause_hints: ['Serverless filesystem write failed.']
          }
        },
        events: [{
          id: 'event-front',
          created_at: '2026-06-06T00:01:00.000Z',
          request_id: 'req-front',
          route: '/admin/issues',
          method: 'POST',
          path_template: '/admin/issues/export',
          status_code: 500,
          error_code: 'INTERNAL_ERROR',
          message_summary: "EROFS: read-only file system, open '/var/task/docs/codex-issue-inbox/a.json'",
          stack_summary: 'writeCodexIssueExport (/var/task/backend/src/services/issue-codex-export.service.js:10:1)'
        }]
      },
      {
        group: {
          id: 'group-export-db',
          fingerprint: 'sha256:db',
          status: 'open',
          severity: 'p1',
          title: 'database EROFS /api/v1/admin/issues/export',
          source_layer: 'database',
          category: 'db_error',
          first_seen_at: '2026-06-06T00:00:30.000Z',
          last_seen_at: '2026-06-06T00:01:30.000Z',
          event_count: 1,
          affected_users: 1,
          latest_request_id: 'req-db',
          evidence_summary: {
            api_paths: ['/api/v1/admin/issues/export'],
            request_ids: ['req-db'],
            errors: ['EROFS']
          },
          codex_handoff: {
            evidence: {
              db_code: 'EROFS',
              message_summary: "EROFS: read-only file system, open '/var/task/docs/codex-issue-inbox/b.json'"
            }
          }
        },
        events: [{
          id: 'event-db',
          created_at: '2026-06-06T00:01:30.000Z',
          request_id: 'req-db',
          method: 'POST',
          path_template: '/api/v1/admin/issues/export',
          db_code: 'EROFS',
          error_code: 'EROFS',
          message_summary: "EROFS: read-only file system, open '/var/task/docs/codex-issue-inbox/b.json'",
          stack_summary: 'writeFile (/var/task/backend/src/services/issue-codex-export.service.js:11:1)'
        }]
      }
    ],
    generatedAt: '2026-06-06T00:02:00.000Z',
    filters: { status: 'open', min_severity: 'p1' },
    repo: {
      root: '/repo',
      branch: 'main',
      commit: 'abc123',
      build_id: 'build-abc123'
    }
  })

  assert.equal(table.schema_version, CODEX_ISSUE_SCHEMA_VERSION)
  assert.equal(table.issue_count, 1)
  assert.equal(table.repo.commit, 'abc123')
  assert.deepEqual(table.filters, { status: 'open', min_severity: 'p1' })
  const issue = table.issues[0]
  assert.deepEqual(issue.merged_issue_group_ids.sort(), ['group-export-db', 'group-export-frontend'])
  assert.equal(issue.primary_scope.backend.api_paths[0], '/admin/issues/export')
  assert.ok(issue.suspected_files.includes('backend/src/services/issue-codex-export.service.js'))
  assert.ok(issue.reproduction.steps.some((step) => step.includes('/admin/issues')))
  assert.ok(issue.validation.commands.includes('npm run test:backend'))
  assert.match(issue.codex_diagnosis_inputs.sample_events[0].stack_summary, /issue-codex-export/)
})
