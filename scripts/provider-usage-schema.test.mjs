import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const sql = readFileSync(new URL('../supabase/017_provider_usage_snapshots.sql', import.meta.url), 'utf8')

test('provider usage migration defines runs, snapshots, constraints, and indexes', () => {
  assert.match(sql, /create table if not exists public\.provider_usage_sync_runs/)
  assert.match(sql, /create table if not exists public\.provider_usage_snapshots/)
  assert.match(sql, /numeric\(18,6\)/)
  assert.match(sql, /unique \(sync_run_id, provider, api_name\)/)
  assert.match(sql, /idx_provider_usage_snapshots_user_time/)
  assert.match(sql, /admin_provider_billing_user_model_summary/)
  assert.match(sql, /to service_role/)
})

test('provider billing summary preserves exact sums beyond one numeric(18,6) row', () => {
  assert.match(sql, /sum\(cost_amount\)\s+as cost_amount/i)
  assert.doesNotMatch(sql, /sum\(cost_amount\)::numeric\(18,6\)/i)
  assert.match(sql, /with \(security_invoker = true\)/i)
  assert.match(sql, /grant select on public\.admin_provider_billing_user_model_summary\s+to service_role/i)
})
