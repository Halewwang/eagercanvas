# 302 Usage Snapshots and Admin Read Models Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Store authoritative 302 cumulative usage snapshots, separate official totals from local model attribution, and serve local currency-safe admin read models without per-user upstream fan-out.

**Architecture:** A synchronization service resolves each active service credential's runtime key, reads 302 usage-log, and persists a run plus one snapshot row per API name. Pure contract helpers derive deltas and reconciliation state. Overview, user list, user detail, and usage routes combine the latest successful value with the latest synchronization status and local billing summaries; only explicit synchronization contacts 302.

**Tech Stack:** Node.js ESM, Express, Zod, Supabase/Postgres SQL, 302 dashboard/usage-log services, Node test runner.

## Global Constraints

- 302 usage-log is the sole authoritative cumulative amount.
- Raw `current_cost` is never an official fallback.
- Local `provider_billing_records` provide model/request attribution only.
- New values use `{ amount, currency }`; do not put PTC in `totalCostUsd`.
- Unavailable official data is `unavailable`, never numeric zero.
- Compare official and attributed amounts only when currency and cumulative scope match.
- Reconciled tolerance is `max(0.01 PTC, official amount × 0.001)`.
- Do not allocate unexplained difference to models.
- The first snapshot is a baseline and produces no historical delta.
- Follow TDD and observe every new test fail before production code.

---

### Task 1: Add snapshot and synchronization-run storage

**Files:**
- Create: `supabase/017_provider_usage_snapshots.sql`
- Create: `scripts/provider-usage-schema.test.mjs`

**Interfaces:**
- Produces: `provider_usage_sync_runs` and `provider_usage_snapshots` tables with service-role-only write access.
- Consumes: `users` and `user_service_credentials` foreign keys.

- [ ] **Step 1: Write the failing schema test**

```js
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
```

- [ ] **Step 2: Verify RED**

Run: `node --test scripts/provider-usage-schema.test.mjs`

Expected: FAIL with `ENOENT` for migration 017.

- [ ] **Step 3: Create the migration**

```sql
create table if not exists public.provider_usage_sync_runs (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  status text not null check (status in ('running', 'completed', 'partial', 'failed')),
  requested_by uuid references public.users(id) on delete set null,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  total_keys integer not null default 0 check (total_keys >= 0),
  succeeded_keys integer not null default 0 check (succeeded_keys >= 0),
  failed_keys integer not null default 0 check (failed_keys >= 0),
  matched_users integer not null default 0 check (matched_users >= 0),
  unmatched_keys integer not null default 0 check (unmatched_keys >= 0),
  error_summary jsonb
);

create table if not exists public.provider_usage_snapshots (
  id uuid primary key default gen_random_uuid(),
  sync_run_id uuid not null references public.provider_usage_sync_runs(id) on delete cascade,
  provider text not null,
  api_name text not null,
  user_id uuid references public.users(id) on delete set null,
  service_credential_id uuid references public.user_service_credentials(id) on delete set null,
  total_amount numeric(18,6),
  currency text,
  snapshot_at timestamptz not null default now(),
  status text not null check (status in ('success', 'unmatched', 'failed')),
  error_code text,
  unique (sync_run_id, provider, api_name)
);

create index if not exists idx_provider_usage_snapshots_user_time
  on public.provider_usage_snapshots(user_id, snapshot_at desc);
create index if not exists idx_provider_usage_snapshots_api_time
  on public.provider_usage_snapshots(api_name, snapshot_at desc);
create index if not exists idx_provider_usage_snapshots_run
  on public.provider_usage_snapshots(sync_run_id);

create or replace view public.admin_provider_billing_user_model_summary
with (security_invoker = true) as
select
  user_id,
  coalesce(model, 'unknown') as model,
  cost_currency,
  count(*)::bigint as call_count,
  sum(input_tokens)::bigint as input_tokens,
  sum(output_tokens)::bigint as output_tokens,
  sum(image_count)::bigint as image_count,
  sum(video_seconds)::bigint as video_seconds,
  sum(cost_amount)::numeric(18,6) as cost_amount
from public.provider_billing_records
where user_id is not null
group by user_id, coalesce(model, 'unknown'), cost_currency;

revoke all on public.admin_provider_billing_user_model_summary from anon, authenticated;
grant select on public.admin_provider_billing_user_model_summary to service_role;

alter table public.provider_usage_sync_runs enable row level security;
alter table public.provider_usage_snapshots enable row level security;
drop policy if exists provider_usage_sync_runs_service_role on public.provider_usage_sync_runs;
drop policy if exists provider_usage_snapshots_service_role on public.provider_usage_snapshots;
create policy provider_usage_sync_runs_service_role on public.provider_usage_sync_runs
for all to service_role using (true) with check (true);
create policy provider_usage_snapshots_service_role on public.provider_usage_snapshots
for all to service_role using (true) with check (true);
```

- [ ] **Step 4: Verify GREEN and commit**

Run: `node --test scripts/provider-usage-schema.test.mjs`

Expected: PASS.

```bash
git add supabase/017_provider_usage_snapshots.sql scripts/provider-usage-schema.test.mjs
git commit -m "feat: add provider usage snapshot schema"
```

### Task 2: Implement currency-safe usage comparison and snapshot deltas

**Files:**
- Create: `backend/src/services/provider-usage-contract.js`
- Create: `backend/src/services/provider-usage-contract.test.js`

**Interfaces:**
- Produces: `compareUsageEvidence({ official, attributed })` and `buildOfficialSnapshotDelta(previous, current)`.
- Consumes: values shaped as `{ amount, currency, capturedAt }`.

- [ ] **Step 1: Write failing contract tests**

```js
test('comparison returns reconciled inside absolute or relative tolerance', () => {
  assert.deepEqual(compareUsageEvidence({
    official: { amount: 100, currency: 'PTC' }, attributed: { amount: 99.95, currency: 'PTC' }
  }), { state: 'reconciled', differenceAmount: 0.05, coverageRate: 0.9995, currency: 'PTC' })
})

test('comparison preserves unavailable and not-comparable states', () => {
  assert.equal(compareUsageEvidence({ official: null, attributed: { amount: 1, currency: 'PTC' } }).state, 'unavailable')
  assert.equal(compareUsageEvidence({
    official: { amount: 1, currency: 'PTC' }, attributed: { amount: 1, currency: 'USD' }
  }).state, 'not_comparable')
})

test('snapshot delta treats baseline and negative movement explicitly', () => {
  assert.equal(buildOfficialSnapshotDelta(null, { amount: 10, currency: 'PTC' }).state, 'baseline')
  assert.equal(buildOfficialSnapshotDelta(
    { amount: 10, currency: 'PTC' }, { amount: 8, currency: 'PTC' }
  ).state, 'anomalous')
})
```

- [ ] **Step 2: Verify RED**

Run: `node --test backend/src/services/provider-usage-contract.test.js`

Expected: FAIL with `ERR_MODULE_NOT_FOUND`.

- [ ] **Step 3: Implement the pure contract**

```js
export const ABSOLUTE_TOLERANCE_PTC = 0.01
export const RELATIVE_TOLERANCE = 0.001

const round6 = (value) => Number(Number(value || 0).toFixed(6))

export const compareUsageEvidence = ({ official, attributed }) => {
  if (!official || official.amount === null || official.amount === undefined) {
    return { state: 'unavailable', differenceAmount: null, coverageRate: null, currency: null }
  }
  if (!attributed || official.currency !== attributed.currency) {
    return { state: 'not_comparable', differenceAmount: null, coverageRate: null, currency: official.currency }
  }
  const differenceAmount = round6(Number(official.amount) - Number(attributed.amount))
  const coverageRate = Number(official.amount) === 0
    ? (Number(attributed.amount) === 0 ? 1 : null)
    : round6(Number(attributed.amount) / Number(official.amount))
  const tolerance = Math.max(
    official.currency === 'PTC' ? ABSOLUTE_TOLERANCE_PTC : 0,
    Math.abs(Number(official.amount)) * RELATIVE_TOLERANCE
  )
  const state = Math.abs(differenceAmount) <= tolerance
    ? 'reconciled'
    : (differenceAmount < 0 || coverageRate === null ? 'anomalous' : 'partial')
  return { state, differenceAmount, coverageRate, currency: official.currency }
}

export const buildOfficialSnapshotDelta = (previous, current) => {
  if (!current || current.amount === null || current.amount === undefined) return { state: 'unavailable', amount: null }
  if (!previous) return { state: 'baseline', amount: null, currency: current.currency }
  if (previous.currency !== current.currency) return { state: 'not_comparable', amount: null, currency: current.currency }
  const amount = round6(Number(current.amount) - Number(previous.amount))
  return amount < 0
    ? { state: 'anomalous', amount, currency: current.currency }
    : { state: 'comparable', amount, currency: current.currency }
}
```

- [ ] **Step 4: Verify GREEN and commit**

Run: `node --test backend/src/services/provider-usage-contract.test.js`

Expected: PASS.

```bash
git add backend/src/services/provider-usage-contract.js backend/src/services/provider-usage-contract.test.js
git commit -m "feat: define provider usage evidence contract"
```

### Task 3: Synchronize 302 usage-log into snapshots

**Files:**
- Create: `backend/src/services/provider-usage-sync.service.js`
- Create: `backend/src/services/provider-usage-sync.service.test.js`

**Interfaces:**
- Produces: `sync302UsageSnapshots({ requestedBy }, deps)` returning run counts and status.
- Consumes: `get302RuntimeApiKeyByName()`, `get302ApiKeyUsageByKey()`, `normalize302ApiKeyUsage()`, active `user_service_credentials`, and tables from Task 1.

- [ ] **Step 1: Write a failing partial-run test**

```js
test('sync stores successful and failed keys without exposing secrets', async () => {
  const writes = []
  const result = await sync302UsageSnapshots({ requestedBy: 'admin-1' }, {
    listCredentials: async () => [
      { id: 'c1', user_id: 'u1', provider_api_name: 'key-one' },
      { id: 'c2', user_id: 'u2', provider_api_name: 'key-two' }
    ],
    createRun: async (row) => ({ id: 'run-1', ...row }),
    finishRun: async (_id, row) => writes.push(['run', row]),
    insertSnapshots: async (rows) => writes.push(['snapshots', rows]),
    resolveRuntimeKey: async (name) => `sk-${name}`,
    fetchUsage: async (secret) => {
      if (secret.endsWith('two')) throw Object.assign(new Error('secret sk-key-two failed'), { code: 'DASHBOARD_302_TIMEOUT' })
      return { data: { total_cost: 4.75, currency: 'PTC' } }
    },
    now: () => new Date('2026-07-11T00:00:00.000Z')
  })
  assert.equal(result.status, 'partial')
  assert.equal(result.succeededKeys, 1)
  assert.equal(result.failedKeys, 1)
  assert.doesNotMatch(JSON.stringify(writes), /sk-key-two/)
})

test('sync deduplicates api names and reports all-failed runs', async () => {
  let inserted = []
  const result = await sync302UsageSnapshots({}, {
    listCredentials: async () => [
      { id: 'c1', user_id: 'u1', provider_api_name: 'key-one' },
      { id: 'c1-newer', user_id: 'u1', provider_api_name: 'key-one' },
      { id: 'c2', user_id: 'u2', provider_api_name: 'key-two' }
    ],
    createRun: async (row) => ({ id: 'run-2', ...row }),
    finishRun: async () => {},
    insertSnapshots: async (rows) => { inserted = rows },
    resolveRuntimeKey: async () => { throw Object.assign(new Error('failed'), { code: 'DASHBOARD_302_TIMEOUT' }) },
    fetchUsage: async () => assert.fail('fetchUsage should not run without a runtime key'),
    now: () => new Date('2026-07-11T00:00:00.000Z')
  })
  assert.equal(result.status, 'failed')
  assert.equal(inserted.length, 2)
  assert.equal(new Set(inserted.map((row) => row.api_name)).size, 2)
})
```

- [ ] **Step 2: Verify RED**

Run: `node --test backend/src/services/provider-usage-sync.service.test.js`

Expected: FAIL with `ERR_MODULE_NOT_FOUND`.

- [ ] **Step 3: Implement dependency-injected synchronization**

```js
const mapWithConcurrency = async (items, worker, limit = 4) => {
  const results = new Array(items.length)
  let nextIndex = 0
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (nextIndex < items.length) {
      const index = nextIndex
      nextIndex += 1
      results[index] = await worker(items[index], index)
    }
  }))
  return results
}

export const sync302UsageSnapshots = async ({ requestedBy = null } = {}, deps = {}) => {
  const capturedAt = (deps.now || (() => new Date()))().toISOString()
  const credentials = [...new Map(
    (await deps.listCredentials()).map((row) => [String(row.provider_api_name || ''), row])
  ).values()].filter((row) => row.provider_api_name)
  const run = await deps.createRun({ provider: '302', status: 'running', requested_by: requestedBy, total_keys: credentials.length })
  const snapshots = await mapWithConcurrency(credentials, async (credential) => {
    try {
      const runtimeKey = await deps.resolveRuntimeKey(credential.provider_api_name)
      const normalized = normalize302ApiKeyUsage(await deps.fetchUsage(runtimeKey))
      return {
        sync_run_id: run.id, provider: '302', api_name: credential.provider_api_name,
        user_id: credential.user_id, service_credential_id: credential.id,
        total_amount: normalized.totalCost, currency: normalized.currency || 'PTC',
        snapshot_at: capturedAt, status: 'success', error_code: null
      }
    } catch (error) {
      return {
        sync_run_id: run.id, provider: '302', api_name: credential.provider_api_name,
        user_id: credential.user_id, service_credential_id: credential.id,
        total_amount: null, currency: null, snapshot_at: capturedAt,
        status: 'failed', error_code: String(error?.code || 'DASHBOARD_302_USAGE_ERROR')
      }
    }
  }, 4)
  await deps.insertSnapshots(snapshots)
  const succeededKeys = snapshots.filter((row) => row.status === 'success').length
  const failedKeys = snapshots.length - succeededKeys
  const status = failedKeys === 0 ? 'completed' : (succeededKeys ? 'partial' : 'failed')
  await deps.finishRun(run.id, {
    status, completed_at: capturedAt, succeeded_keys: succeededKeys, failed_keys: failedKeys,
    matched_users: new Set(snapshots.filter((row) => row.user_id).map((row) => row.user_id)).size,
    unmatched_keys: snapshots.filter((row) => !row.user_id).length,
    error_summary: failedKeys ? { failedCodes: snapshots.filter((row) => row.error_code).map((row) => row.error_code) } : null
  })
  return { runId: run.id, status, totalKeys: snapshots.length, succeededKeys, failedKeys }
}
```

Default dependencies use Supabase plus the existing 302 service exports. Keep the concurrency helper private to this service and fixed at 4.

- [ ] **Step 4: Verify GREEN and commit**

Run: `node --test backend/src/services/provider-usage-sync.service.test.js backend/src/services/dashboard302.service.test.js`

Expected: PASS.

```bash
git add backend/src/services/provider-usage-sync.service.js backend/src/services/provider-usage-sync.service.test.js
git commit -m "feat: snapshot official 302 usage"
```

### Task 4: Build currency-neutral admin usage read models

**Files:**
- Create: `backend/src/services/admin-usage-read-model.js`
- Create: `backend/src/services/admin-usage-read-model.test.js`
- Modify: `backend/src/services/admin-usage-view.js`
- Modify: `backend/src/services/admin-usage-view.test.js`

**Interfaces:**
- Produces: `buildAdminUsageEvidence({ snapshots, billingRecords, failedKeyCount })` and user rows with `officialUsage`, `attribution`, and `reconciliation`.
- Consumes: `compareUsageEvidence()` from Task 2.

- [ ] **Step 1: Write failing read-model tests**

```js
test('read model separates official totals from model attribution', () => {
  const result = buildAdminUsageEvidence({
    snapshots: [{ apiName: 'key-a', amount: 4.75, currency: 'PTC', capturedAt: '2026-07-11T00:00:00Z' }],
    billingRecords: [{ model: 'gpt-image-2', amount: 4.5, currency: 'PTC', reconciliationStatus: 'matched' }]
  })
  assert.equal(result.official.amount, 4.75)
  assert.equal(result.attribution.amount, 4.5)
  assert.equal(result.attribution.byModel[0].model, 'gpt-image-2')
  assert.equal(result.reconciliation.differenceAmount, 0.25)
})

test('failed official data is unavailable rather than zero', () => {
  const result = buildAdminUsageEvidence({ snapshots: [], billingRecords: [], failedKeyCount: 1 })
  assert.equal(result.official.amount, null)
  assert.equal(result.reconciliation.state, 'unavailable')
})
```

- [ ] **Step 2: Verify RED**

Run: `node --test backend/src/services/admin-usage-read-model.test.js`

Expected: FAIL with `ERR_MODULE_NOT_FOUND`.

- [ ] **Step 3: Implement the evidence aggregator**

```js
export const buildAdminUsageEvidence = ({ snapshots = [], billingRecords = [], failedKeyCount = 0 } = {}) => {
  const successful = snapshots.filter((row) => row.amount !== null && row.amount !== undefined)
  const currencies = new Set(successful.map((row) => row.currency))
  const official = successful.length && currencies.size === 1
    ? {
        amount: successful.reduce((sum, row) => sum + Number(row.amount), 0),
        currency: successful[0].currency,
        source: '302_usage_log',
        capturedAt: successful.map((row) => row.capturedAt).sort().at(-1),
        state: failedKeyCount ? 'partial' : 'available'
      }
    : { amount: null, currency: null, source: '302_usage_log', capturedAt: null, state: 'unavailable' }
  const comparableRecords = billingRecords.filter((row) => row.currency === official.currency)
  const attribution = aggregateBillingRecords(comparableRecords)
  const reconciliation = compareUsageEvidence({ official, attributed: attribution })
  return { official, attribution, reconciliation: failedKeyCount && reconciliation.state === 'reconciled'
    ? { ...reconciliation, state: 'partial' }
    : reconciliation }
}
```

Implement the referenced aggregator in the same module:

```js
const aggregateBillingRecords = (records = []) => {
  const byModel = new Map()
  const result = { amount: 0, currency: records[0]?.currency || null, calls: 0, tokens: 0, images: 0, videoSeconds: 0, byModel: [] }
  for (const row of records) {
    const amount = Number(row.amount || 0)
    const model = String(row.model || 'unknown')
    result.amount += amount
    result.calls += Number(row.calls || 1)
    result.tokens += Number(row.inputTokens || 0) + Number(row.outputTokens || 0)
    result.images += Number(row.imageCount || 0)
    result.videoSeconds += Number(row.videoSeconds || 0)
    const entry = byModel.get(model) || { model, amount: 0, calls: 0 }
    entry.amount += amount
    entry.calls += Number(row.calls || 1)
    byModel.set(model, entry)
  }
  result.amount = Number(result.amount.toFixed(6))
  result.byModel = [...byModel.values()].sort((a, b) => b.amount - a.amount)
  return result
}
```

- [ ] **Step 4: Replace the legacy mixed view**

In `admin-usage-view.js`, return:

```js
{
  officialUsage: evidence.official,
  attribution: evidence.attribution,
  reconciliation: evidence.reconciliation
}
```

Keep a temporary `usage.totalCostUsd` compatibility mapping only for untouched callers in this plan. Add a test that new fields contain PTC while the compatibility field is marked for removal in Plan 3.

- [ ] **Step 5: Verify GREEN and commit**

Run: `node --test backend/src/services/admin-usage-read-model.test.js backend/src/services/admin-usage-view.test.js`

Expected: PASS.

```bash
git add backend/src/services/admin-usage-read-model.js backend/src/services/admin-usage-read-model.test.js backend/src/services/admin-usage-view.js backend/src/services/admin-usage-view.test.js
git commit -m "feat: separate official usage from attribution"
```

### Task 5: Replace live user-list enrichment with paginated local reads

**Files:**
- Modify: `backend/src/services/admin-users-list.js`
- Modify: `backend/src/services/admin-users-list.test.js`
- Create: `backend/src/services/admin-user-detail.js`
- Create: `backend/src/services/admin-user-detail.test.js`
- Create: `backend/src/services/admin-overview.service.js`
- Create: `backend/src/services/admin-overview.service.test.js`

**Interfaces:**
- Produces: `listUsersForAdmin(query) -> { items, pagination }`, `getAdminUserDetail(userId)`, `getAdminUserUsage(userId, query)`, and `getAdminOverview()`.
- Consumes: latest `provider_usage_snapshots`, local billing records, roles, credentials, and profiles.

- [ ] **Step 1: Write failing no-fan-out and pagination tests**

```js
test('listUsersForAdmin pages users and never loads live 302 inventory', async () => {
  const originalFetch = global.fetch
  global.fetch = async () => assert.fail('admin user list must not call 302')
  const restore = mock.method(supabase, 'from', (table) => createQuery({
    table, calls, dataByTable, countByTable: { users: 61 }
  }))
  try {
    const result = await listUsersForAdmin({ page: 2, limit: 25, status: 'active' })
    assert.deepEqual(result.pagination, { page: 2, limit: 25, total: 61 })
    assert.equal(calls.some((call) => call[0] === 'provider_usage_snapshots'), true)
  } finally {
    restore.mock.restore()
    global.fetch = originalFetch
  }
})

test('overview uses local snapshots and exposes actionable counts', async () => {
  const result = buildAdminOverview({
    users: [{ status: 'active' }, { status: 'active' }, { status: 'suspended' }],
    credentials: [{ user_id: 'u1', status: 'active' }],
    officialUsage: { amount: 7.5, currency: 'PTC', capturedAt: '2026-07-11T00:00:00Z', state: 'available' },
    reconciliationRows: [{ userId: 'u1', state: 'partial' }, { userId: 'u2', state: 'partial' }],
    highRiskPermissionChanges: 1,
    providerFailures: 0
  })
  assert.equal(result.officialUsage.currency, 'PTC')
  assert.equal(result.notifications.reconciliationGapUsers, 2)
})

test('latest provider failure keeps the previous successful cumulative value', () => {
  const current = selectCurrentSnapshotEvidence([
    { api_name: 'key-a', total_amount: 12, currency: 'PTC', status: 'success', snapshot_at: '2026-07-10T00:00:00Z' },
    { api_name: 'key-a', total_amount: null, currency: null, status: 'failed', snapshot_at: '2026-07-11T00:00:00Z' }
  ])
  assert.equal(current.successfulSnapshots[0].amount, 12)
  assert.equal(current.failedKeyCount, 1)
})

test('usage evidence uses the summary query rather than the current record page', async () => {
  const result = await getAdminUserUsage('u1', { page: 2, limit: 25 }, { client: createUsageClient({
    recordPage: [{ cost_amount: 1, cost_currency: 'PTC' }],
    summaryRows: [{ model: 'gpt-image-2', call_count: 80, cost_amount: 20, cost_currency: 'PTC' }]
  }) })
  assert.equal(result.attribution.amount, 20)
  assert.equal(result.records.items[0].cost_amount, 1)
})
```

- [ ] **Step 2: Verify RED**

Run: `node --test backend/src/services/admin-users-list.test.js backend/src/services/admin-overview.service.test.js`

Expected: FAIL because the list returns an array, loads billing inventory, and overview service is absent.

- [ ] **Step 3: Implement paginated candidate filtering**

Normalize query values with:

```js
const page = Math.max(1, Number(query.page) || 1)
const limit = Math.min(100, Math.max(1, Number(query.limit) || 25))
const from = (page - 1) * limit
const to = from + limit - 1
```

Extend the existing test `createQuery()` helper with `range()`, `ilike()`, and a `{ count }` response, and add `createUsageClient({ recordPage, summaryRows, snapshots })` so the preceding behavior tests are executable. Resolve optional role, service-status, and reconciliation-status user ID sets first, intersect them, then apply the resulting IDs plus search/status to the users query before `.range(from, to)`. Load profiles, roles, credentials, latest snapshots, and rows from `admin_provider_billing_user_model_summary` only for returned page user IDs. Remove `loadUserApiKeyBillingInventory()` from this path.

- [ ] **Step 4: Implement local overview aggregation**

`getAdminOverview()` reads counts from users/credentials, the latest successful snapshot per API name, the latest synchronization status per API name, billing reconciliation gaps, and recent high-risk audit actions. A failed latest synchronization marks the result `partial` but never erases that API name's previous successful cumulative value. Return:

```js
{
  users: { total, active, suspended, deleted },
  services: { active, coverageRate },
  officialUsage: { amount, currency, capturedAt, state },
  reconciliation: { coverageRate, gapUsers, state },
  notifications: { serviceNotEnabledUsers, reconciliationGapUsers, highRiskPermissionChanges, providerFailures }
}
```

`admin-overview.service.js` exports the tested `buildAdminOverview(input)` pure aggregator. `getAdminOverview({ client = supabase } = {})` loads `users`, `user_service_credentials`, ordered `provider_usage_snapshots`, latest `provider_usage_sync_runs`, comparable `provider_billing_records`, and recent high-risk `admin_operation_logs`, calls `selectCurrentSnapshotEvidence()`, then passes normalized rows into `buildAdminOverview()`.

- [ ] **Step 5: Implement user detail and usage reads**

```js
export const getAdminUserDetail = async (userId, { client = supabase } = {}) => {
  const safeUserId = String(userId || '').trim()
  if (!safeUserId) throw new HttpError(400, 'userId is required', 'INVALID_TARGET_USER')
  const [userRes, profileRes, roleRes, credentialRes, assignmentRes, snapshotRes, billingRes] = await Promise.all([
    client.from('users').select('id,email,status,created_at,suspended_at,suspended_reason,deleted_at').eq('id', safeUserId).maybeSingle(),
    client.from('user_profiles').select('display_name,registered_at,last_login_at').eq('user_id', safeUserId).maybeSingle(),
    client.from('user_roles').select('role_id,roles(code)').eq('user_id', safeUserId),
    client.from('user_service_credentials').select('id,provider,provider_api_name,status,key_last4,limit_cost,limit_daily_cost,expired_on,created_at,updated_at').eq('user_id', safeUserId).order('created_at', { ascending: false }),
    client.from('user_api_key_assignments').select('api_name,created_at').eq('user_id', safeUserId).order('created_at', { ascending: false }),
    client.from('provider_usage_snapshots').select('api_name,total_amount,currency,snapshot_at,status,error_code').eq('user_id', safeUserId).order('snapshot_at', { ascending: false }),
    client.from('admin_provider_billing_user_model_summary').select('model,call_count,input_tokens,output_tokens,image_count,video_seconds,cost_amount,cost_currency').eq('user_id', safeUserId)
  ])
  const failed = [userRes, profileRes, roleRes, credentialRes, assignmentRes, snapshotRes, billingRes].find((result) => result.error)
  if (failed) throw new HttpError(500, failed.error.message, 'ADMIN_USER_DETAIL_QUERY_FAILED')
  if (!userRes.data) throw new HttpError(404, 'Target user not found', 'TARGET_USER_NOT_FOUND')
  return buildAdminUserDetail({
    user: userRes.data,
    profile: profileRes.data,
    roles: (roleRes.data || []).map((row) => row.roles?.code).filter(Boolean),
    credentials: credentialRes.data || [], assignments: assignmentRes.data || [],
    snapshots: snapshotRes.data || [], billingRecords: billingRes.data || []
  })
}

export const getAdminUserUsage = async (userId, query = {}, { client = supabase } = {}) => {
  const page = Math.max(1, Number(query.page) || 1)
  const limit = Math.min(100, Math.max(1, Number(query.limit) || 25))
  const fromIndex = (page - 1) * limit
  const recordsQuery = client.from('provider_billing_records')
    .select('id,model,input_tokens,output_tokens,image_count,video_seconds,cost_amount,cost_currency,reconciliation_status,official_created_at', { count: 'exact' })
    .eq('user_id', userId).order('official_created_at', { ascending: false }).range(fromIndex, fromIndex + limit - 1)
  const summaryQuery = client.from('admin_provider_billing_user_model_summary')
    .select('model,call_count,input_tokens,output_tokens,image_count,video_seconds,cost_amount,cost_currency')
    .eq('user_id', userId)
  const snapshotsQuery = client.from('provider_usage_snapshots')
    .select('api_name,total_amount,currency,snapshot_at,status,error_code')
    .eq('user_id', userId).order('snapshot_at', { ascending: true })
  if (query.from) {
    recordsQuery.gte('official_created_at', `${query.from}T00:00:00.000Z`)
  }
  if (query.to) {
    recordsQuery.lte('official_created_at', `${query.to}T23:59:59.999Z`)
  }
  const [recordsRes, summaryRes, snapshotsRes] = await Promise.all([recordsQuery, summaryQuery, snapshotsQuery])
  const failed = [recordsRes, summaryRes, snapshotsRes].find((result) => result.error)
  if (failed) throw new HttpError(500, failed.error.message, 'ADMIN_USER_USAGE_QUERY_FAILED')
  const snapshots = snapshotsRes.data || []
  const current = selectCurrentSnapshotEvidence(snapshots)
  const evidence = buildAdminUsageEvidence({
    snapshots: current.successfulSnapshots,
    billingRecords: (summaryRes.data || []).map(normalizeAdminBillingRecord),
    failedKeyCount: current.failedKeyCount
  })
  return {
    ...evidence,
    records: { items: recordsRes.data || [], pagination: { page, limit, total: Number(recordsRes.count || 0) } },
    series: buildAdminOfficialUsageSeries(snapshots)
  }
}
```

The same file defines the referenced pure helpers:

```js
export const normalizeAdminBillingRecord = (row = {}) => ({
  id: row.id,
  model: String(row.model || 'unknown'),
  inputTokens: Number(row.input_tokens || 0),
  outputTokens: Number(row.output_tokens || 0),
  imageCount: Number(row.image_count || 0),
  videoSeconds: Number(row.video_seconds || 0),
  amount: Number(row.cost_amount || 0),
  calls: Number(row.call_count || 1),
  currency: String(row.cost_currency || ''),
  reconciliationStatus: String(row.reconciliation_status || ''),
  createdAt: row.official_created_at || null
})

export const selectCurrentSnapshotEvidence = (rows = []) => {
  const ordered = [...rows].sort((a, b) => String(b.snapshot_at).localeCompare(String(a.snapshot_at)))
  const latestStatusByApiName = new Map()
  const latestSuccessByApiName = new Map()
  for (const row of ordered) {
    if (!latestStatusByApiName.has(row.api_name)) latestStatusByApiName.set(row.api_name, row)
    if (row.status === 'success' && row.total_amount !== null && !latestSuccessByApiName.has(row.api_name)) {
      latestSuccessByApiName.set(row.api_name, row)
    }
  }
  return {
    successfulSnapshots: [...latestSuccessByApiName.values()].map((row) => ({
      apiName: row.api_name, amount: row.total_amount, currency: row.currency, capturedAt: row.snapshot_at
    })),
    failedKeyCount: [...latestStatusByApiName.values()].filter((row) => row.status === 'failed').length,
    latestStatuses: [...latestStatusByApiName.values()]
  }
}

export const buildAdminOfficialUsageSeries = (rows = []) => {
  const byApiName = new Map()
  for (const row of rows.filter((item) => item.status === 'success' && item.total_amount !== null)) {
    const list = byApiName.get(row.api_name) || []
    list.push({ amount: row.total_amount, currency: row.currency, capturedAt: row.snapshot_at, status: row.status })
    byApiName.set(row.api_name, list)
  }
  return [...byApiName.entries()].flatMap(([apiName, list]) => list
    .sort((a, b) => String(a.capturedAt).localeCompare(String(b.capturedAt)))
    .map((current, index, sorted) => ({
      apiName,
      capturedAt: current.capturedAt,
      ...buildOfficialSnapshotDelta(index ? sorted[index - 1] : null, current)
    })))
}

export const buildAdminUserDetail = ({ user, profile, roles, credentials, assignments, snapshots, billingRecords }) => {
  const current = selectCurrentSnapshotEvidence(snapshots)
  const evidence = buildAdminUsageEvidence({
    snapshots: current.successfulSnapshots,
    billingRecords: billingRecords.map(normalizeAdminBillingRecord),
    failedKeyCount: current.failedKeyCount
  })
  return {
    id: user.id, email: user.email, displayName: profile?.display_name || '',
    status: user.status, createdAt: user.created_at, lastLoginAt: profile?.last_login_at || null,
    suspendedAt: user.suspended_at || null, suspendedReason: user.suspended_reason || null,
    deletedAt: user.deleted_at || null, roles, credentials, assignments,
    officialUsage: evidence.official, attribution: evidence.attribution, reconciliation: evidence.reconciliation
  }
}
```

Unit tests cover field mapping, currency neutrality, baseline gaps, negative-delta anomalies, latest-failure retention of the previous successful value, and reconciliation totals remaining independent of detail pagination. The service-role summary view is the only source for cumulative attribution totals; never substitute the current detail page as the summary.

- [ ] **Step 6: Verify GREEN and commit**

Run: `node --test backend/src/services/admin-users-list.test.js backend/src/services/admin-user-detail.test.js backend/src/services/admin-overview.service.test.js backend/src/services/admin-usage-view.test.js`

Expected: PASS; the user-list test contains no expected dashboard302 call.

```bash
git add backend/src/services/admin-users-list.js backend/src/services/admin-users-list.test.js backend/src/services/admin-user-detail.js backend/src/services/admin-user-detail.test.js backend/src/services/admin-overview.service.js backend/src/services/admin-overview.service.test.js
git commit -m "perf: serve admin users from local read models"
```

### Task 6: Expose overview, user detail, usage, and synchronization routes

**Files:**
- Modify: `backend/src/routes/admin.routes.js`
- Modify: `backend/src/routes/admin.routes.test.js`
- Modify: `backend/src/services/admin-usage.service.js`
- Modify: `backend/src/services/admin-operation-logs.js`
- Modify: `backend/src/services/admin-operation-logs.test.js`
- Modify: `src/api/admin.js`

**Interfaces:**
- Produces: `GET /admin/overview`, paginated `GET /admin/users`, `GET /admin/users/:userId`, `GET /admin/users/:userId/usage`, `GET /admin/users/:userId/audit`, and `POST /admin/usage/sync`.
- Consumes: services from Tasks 3–5.

- [ ] **Step 1: Add failing route-contract tests**

```js
test('admin read models and sync routes use explicit permissions', () => {
  assert.match(source, /get\('\/overview', requirePermission\(\['admin\.dashboard\.read'\]\)/)
  assert.match(source, /get\('\/users\/:userId\/usage', requirePermission\(\['admin\.usage\.read_all'\]\)/)
  assert.match(source, /post\('\/usage\/sync', requirePermission\(\['admin\.billing\.reconcile'\]\)/)
})
```

- [ ] **Step 2: Verify RED**

Run: `node --test backend/src/routes/admin.routes.test.js`

Expected: FAIL because the routes do not exist.

- [ ] **Step 3: Add the routes and stable response shapes**

```js
adminRouter.get('/overview', requirePermission(['admin.dashboard.read']), asyncHandler(async (_req, res) => {
  res.json({ data: await getAdminOverview() })
}))

adminRouter.get('/users', requirePermission(['admin.user.read']), asyncHandler(async (req, res) => {
  res.json({ data: await listUsersForAdmin(req.query) })
}))

adminRouter.get('/users/:userId', requirePermission(['admin.user.read']), asyncHandler(async (req, res) => {
  res.json({ data: await getAdminUserDetail(req.params.userId) })
}))

adminRouter.get('/users/:userId/usage', requirePermission(['admin.usage.read_all']), asyncHandler(async (req, res) => {
  res.json({ data: await getAdminUserUsage(req.params.userId, req.query) })
}))

adminRouter.get('/users/:userId/audit', requirePermission(['admin.audit.read']), asyncHandler(async (req, res) => {
  res.json({ data: await listAdminOperationLogs({
    page: req.query.page, limit: req.query.limit, targetUserId: req.params.userId
  }) })
}))

adminRouter.post('/usage/sync', requirePermission(['admin.billing.reconcile']), asyncHandler(async (req, res) => {
  res.json({ data: await sync302UsageSnapshots({ requestedBy: req.user.id }) })
}))
```

Update `listAdminOperationLogs()` to accept `targetUserId = ''` and apply `query.eq('target_user_id', targetUserId)` before `.range()` when present. Add a test that the target filter is passed to Supabase. Re-export `getAdminOverview`, `getAdminUserDetail`, `getAdminUserUsage`, and `sync302UsageSnapshots` from `admin-usage.service.js` because `admin.routes.js` continues to consume that compatibility barrel.

- [ ] **Step 4: Add frontend API functions**

```js
export const getAdminOverview = () => apiRequest({ url: '/admin/overview', method: 'get' })
export const getAdminUsers = (params) => apiRequest({ url: '/admin/users', method: 'get', params })
export const getAdminUser = (userId) => apiRequest({ url: `/admin/users/${encodeURIComponent(userId)}`, method: 'get' })
export const getAdminUserUsage = (userId, params) => apiRequest({ url: `/admin/users/${encodeURIComponent(userId)}/usage`, method: 'get', params })
export const getAdminUserAudit = (userId, params) => apiRequest({ url: `/admin/users/${encodeURIComponent(userId)}/audit`, method: 'get', params })
export const syncAdminUsage = () => apiRequest({ url: '/admin/usage/sync', method: 'post' })
```

- [ ] **Step 5: Verify GREEN and commit**

Run: `node --test backend/src/routes/admin.routes.test.js backend/src/services/provider-usage-sync.service.test.js backend/src/services/admin-users-list.test.js backend/src/services/admin-overview.service.test.js`

Expected: PASS.

```bash
git add backend/src/routes/admin.routes.js backend/src/routes/admin.routes.test.js backend/src/services/admin-usage.service.js backend/src/services/admin-operation-logs.js backend/src/services/admin-operation-logs.test.js src/api/admin.js
git commit -m "feat: expose admin usage read models"
```

### Task 7: Verify the usage snapshot plan

**Files:**
- Verify only.

**Interfaces:**
- Produces a verified backend contract for the frontend task-page plan.

- [ ] **Step 1: Run focused tests**

```bash
node --test \
  scripts/provider-usage-schema.test.mjs \
  backend/src/services/provider-usage-contract.test.js \
  backend/src/services/provider-usage-sync.service.test.js \
  backend/src/services/admin-usage-read-model.test.js \
  backend/src/services/admin-usage-view.test.js \
  backend/src/services/admin-users-list.test.js \
  backend/src/services/admin-overview.service.test.js \
  backend/src/routes/admin.routes.test.js
```

Expected: zero failures.

- [ ] **Step 2: Prove user and overview reads do not call 302**

Run:

```bash
rg -n "loadUserApiKeyBillingInventory|get302ApiKey|get302ApiKeys|get302ApiKeyUsageByKey" \
  backend/src/services/admin-users-list.js backend/src/services/admin-overview.service.js
```

Expected: no output.

- [ ] **Step 3: Run full gates**

Run: `npm run check`

Expected: exit 0.

Run: `npm run build`

Expected: exit 0 with completed Vite output.

Run: `git diff --check`

Expected: no output.

- [ ] **Step 4: Confirm worktree scope**

Run: `git status --short`

Expected: only files named in this plan are modified or untracked; the user's `docs/PROJECT_HANDOFF_AND_DEPLOYMENT.md` remains untouched.
