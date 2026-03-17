# 302.AI User-Key Assignment And Usage Tracking

## Context

Paperclip currently has three adjacent but separate capabilities:

- authenticated human users and company memberships
- agent API keys used for agent authentication
- company and agent cost reporting via `cost_events`

That is not enough for a 302.AI-backed admin panel where operators need to:

1. assign an already-created 302 API key to a registered human user
2. view spend and usage per registered user
3. query request logs and see the corresponding Paperclip user id on each request

Recent 302.AI public docs confirm the following platform capabilities:

- API key CRUD and API key list data, including `current_cost` and `current_date_cost`
- request-level billing lookup by `request-id`
- API log query via `GET /dashboard/api-record`

They do **not** document a first-class concept of "bind this 302 API key to this user in my app" and they do **not** document a guaranteed `user_id` field on API log query results.

So the missing layer belongs in Paperclip.

## Product Decision

Paperclip will own the user-to-key assignment model and the user-level billing ledger.

302.AI remains:

- the upstream inference provider / billing source
- a reconciliation source for API key totals and request-level costs

Paperclip remains:

- the source of truth for which registered user owns or may use which 302 API key
- the source of truth for user-level spend views inside the admin panel
- the source of truth for attaching Paperclip user identity to a 302 request

## Non-Goals

- exposing raw 302 API keys to the browser
- reusing `agent_api_keys` for human users
- depending on undocumented 302 log fields for user attribution

## Why Current Code Is Insufficient

### Agent keys are the wrong abstraction

`agent_api_keys` is an authentication primitive for agent actors.
It is not a provider credential inventory and it does not support `user_id`.

Reusing it for human users would collide with existing auth semantics and incorrectly treat a human user's provider key as an agent bearer token.

### Cost reporting has no human dimension

`cost_events` currently attributes spend to:

- company
- agent
- issue / project / goal
- heartbeat run
- provider / biller / model

It does not attribute spend to:

- authenticated human user
- assigned 302 key
- upstream request id

### UI has no user-key management surface

The repo already has membership and company-access primitives, but no board page that:

- lists all human users in scope
- shows their assigned 302 key
- lets an operator assign or revoke a 302 key
- shows per-user 302 usage and logs

## Architecture Decision

Use a server-side 302 proxy / gateway owned by Paperclip.

All user-triggered 302 requests must pass through the Paperclip server so the system can:

- resolve the assigned key for the current user
- attach internal attribution metadata
- persist a local request ledger
- reconcile the local ledger with 302 billing and log APIs

Do **not** let the browser call 302 directly with a raw provider key.

## Data Model

## 1. `company_provider_keys`

Purpose: company-scoped inventory of upstream provider credentials.

Suggested fields:

- `id` uuid pk
- `company_id` uuid fk not null
- `provider` text not null
- `name` text not null
- `external_key_id` text null
- `secret_ref` text not null
- `status` enum/text: `active | disabled | revoked`
- `allow_save_logs` boolean not null default false
- `allow_manage_key` boolean not null default false
- `limit_cost_cents` int null
- `limit_daily_cost_cents` int null
- `expires_at` timestamptz null
- `last_synced_at` timestamptz null
- `metadata_json` jsonb null

Notes:

- `secret_ref` should point to `company_secrets` / `company_secret_versions`, not inline plaintext.
- `external_key_id` stores the stable 302-side identifier when available.

## 2. `user_provider_key_assignments`

Purpose: bind a Paperclip user to a provider key.

Suggested fields:

- `id` uuid pk
- `company_id` uuid fk not null
- `user_id` text fk `user.id` not null
- `provider_key_id` uuid fk not null
- `assignment_mode` text: `exclusive | shared`
- `assigned_by_user_id` text fk `user.id` null
- `assigned_at` timestamptz not null
- `revoked_at` timestamptz null

Constraint:

- at most one active exclusive assignment per user per provider

## 3. `provider_request_logs`

Purpose: immutable request ledger for user-attributed provider traffic.

Suggested fields:

- `id` uuid pk
- `company_id` uuid fk not null
- `user_id` text fk `user.id` null
- `provider_key_id` uuid fk not null
- `provider` text not null
- `request_id` text not null
- `external_request_id` text null
- `model` text not null
- `status` text not null
- `request_started_at` timestamptz not null
- `request_finished_at` timestamptz null
- `input_tokens` int not null default 0
- `cached_input_tokens` int not null default 0
- `output_tokens` int not null default 0
- `cost_cents` int not null default 0
- `request_meta_json` jsonb null
- `response_meta_json` jsonb null
- `reconciled_at` timestamptz null
- `created_at` timestamptz not null default now()

This becomes the canonical per-request audit trail for the admin panel.

## 4. Extend `cost_events`

Add:

- `user_id` text fk `user.id` null
- `provider_key_id` uuid fk `company_provider_keys.id` null
- `external_request_id` text null

Rationale:

- `cost_events` stays the reporting ledger
- `provider_request_logs` stays the per-request operational ledger
- `cost_events` can be derived from or reconciled against `provider_request_logs`

## Backend Surfaces

## 1. Provider key inventory

Add routes:

- `GET /companies/:companyId/provider-keys`
- `POST /companies/:companyId/provider-keys`
- `PATCH /companies/:companyId/provider-keys/:keyId`
- `POST /companies/:companyId/provider-keys/:keyId/sync`
- `POST /companies/:companyId/provider-keys/:keyId/revoke`

Behavior:

- board-only
- company-scoped
- secrets stored via secret refs only
- sync action refreshes 302 metadata such as limits / expiry / observed totals when available

## 2. User assignment management

Add routes:

- `GET /companies/:companyId/user-key-assignments`
- `PUT /companies/:companyId/users/:userId/provider-key-assignment`
- `DELETE /companies/:companyId/users/:userId/provider-key-assignment`

Behavior:

- board-only
- requires existing company membership for target user
- writes activity log entries

## 3. User usage reporting

Add routes:

- `GET /companies/:companyId/costs/by-user`
- `GET /companies/:companyId/costs/by-user-model`
- `GET /companies/:companyId/provider-logs`
- `GET /companies/:companyId/provider-logs/:requestId`

Filters:

- `userId`
- `providerKeyId`
- `from`
- `to`
- `model`
- `status`

## 4. 302 proxy / gateway

Add a service layer:

- resolves current actor user
- finds active assignment
- resolves secret ref to actual 302 API key
- forwards request to 302
- records `provider_request_logs`
- emits / reconciles `cost_events`

This layer should generate a Paperclip-side request id for every request.

## User Attribution Strategy

There are three levels of attribution reliability.

## Level 1: direct upstream echo

If 302 supports custom metadata or a stable user field on the called endpoint, send:

- `paperclip_user_id`
- `paperclip_company_id`
- `paperclip_provider_key_id`
- `paperclip_request_id`

Use it, but treat it as an optimization, not a hard dependency.

## Level 2: request-id join

Persist the local request id and the upstream request id.
Use 302 `Record` lookup by `request-id` as the primary reconciliation path.

This is the target baseline.

## Level 3: key + time-window heuristic

Only use when request-id correlation is unavailable.
This is fallback-only and should not be treated as exact attribution.

## Admin UI

Add a new board surface rather than burying this inside agent pages.

## 1. Company Settings → Users / Keys

Page sections:

- registered users in current company
- assigned 302 key
- assignment mode
- current-day cost
- lifetime cost
- last request time
- actions: assign / replace / revoke / open usage

## 2. Costs → By user

Add a parallel tab beside existing provider / biller / agent reporting:

- total spend by user
- token usage by user
- model breakdown per user
- filters for date range and key

## 3. Provider logs

Add an operator log viewer:

- timestamp
- user
- assigned key
- model
- request id
- cost
- latency
- reconciliation status

## Sync And Reconciliation

Two jobs are needed.

## 1. Pull job

Periodic sync from 302:

- key list / key-level totals
- API log query pages for recent windows
- request-level record lookup on demand or for unresolved rows

## 2. Reconcile job

For each unresolved local request:

- fetch 302 record by `request-id` when available
- write final tokens / cost into `provider_request_logs`
- upsert or finalize the matching `cost_events` row

This must be idempotent.

## Security Rules

- never expose raw 302 key material to the browser
- redact provider secrets in logs and activity payloads
- enforce company scoping on every assignment and report route
- only board users can manage provider keys and assignments
- keep activity log entries for create / update / revoke / sync actions

## Recommended Rollout

## Phase 1

- add schema
- add provider key CRUD
- add user assignment CRUD
- add activity logging

## Phase 2

- add server-side 302 proxy
- add `provider_request_logs`
- add request-id reconciliation path

## Phase 3

- add admin UI for users / keys
- add cost views by user
- add log viewer

## Phase 4

- add background sync and reconciliation
- add alerts for unassigned users, exhausted keys, and reconciliation drift

## Implementation Notes For This Repo

This plan fits the current repo rules:

- company-scoped entities remain company-scoped
- secrets remain in `company_secrets`
- reporting continues to use `cost_events`
- mutating actions should be logged in `activity_log`
- UI changes belong in dedicated company-scoped board pages, not agent detail pages

## Open Questions

1. Should one user be allowed more than one active 302 key for the same company?
2. Should key assignment be exclusive by default?
3. Do we want "unassigned fallback key" behavior, or should requests fail closed?
4. Which 302 endpoints will be proxied first: chat only, or all compatible APIs?
5. Do we want key-level quotas enforced locally before calling 302, or only reconciled after the fact?

## Recommendation

Start with:

- one active 302 key per user per company
- exclusive assignment by default
- fail closed when no assignment exists
- chat / text APIs first
- local quota checks before dispatch and reconciliation after dispatch

That is the smallest implementation that satisfies all three requested admin capabilities without relying on undocumented 302 behavior.
