import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildCodexIssueExportPayload,
  CODEX_ISSUE_SCHEMA_VERSION,
  createCodexIssueTable,
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
  assert.equal(table.issues[0].primary_scope.backend.api_paths[0], '/api/v1/runs/image')
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
