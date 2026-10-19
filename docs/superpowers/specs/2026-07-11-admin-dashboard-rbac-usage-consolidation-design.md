# Admin Dashboard RBAC and 302 Usage Consolidation Design

## Summary

Eager Canvas currently has two administration surfaces:

1. `/admin/*`, authenticated through the normal user session and protected by RBAC permissions.
2. `/usage-admin`, authenticated through a separate username/password and `X-Admin-Token`, with broad access to 302 balance, API-key inventory, assignments, and users.

The RBAC dashboard is already decomposed into reusable Vue components, composables, and backend services, but it still behaves as one long page. Most routes render `AdminUsers.vue` and scroll to sections rather than owning independent tasks. User rows combine identity, service state, official consumption, role editing, status actions, service actions, and deletion in a dense table.

The consumption model also mixes evidence sources. A user's cumulative total can come from 302 usage-log data while call count and model breakdown come from local provider billing records. Overview trends use local aggregates. The UI can therefore present values with different source, currency, scope, or freshness as if they were one coherent official dataset.

The approved design consolidates both administration surfaces into one RBAC-protected, task-oriented dashboard. It keeps 302 usage-log as the authoritative cumulative total, treats local billing records as attribution evidence, introduces official usage snapshots for a real provider trend, hardens sensitive account operations on the server, and replaces the current long-page layout with seven independent task pages on a shared grid system.

## Goals

- Consolidate `/usage-admin` capabilities into the normal `/admin/*` RBAC surface in this implementation cycle.
- Remove the independent Admin Token login and management surface after feature parity is verified.
- Replace long-page section routing with independent task routes and scoped data loading.
- Preserve the existing fixed roles: `super_admin`, `admin`, `ops`, `support`, and `user`.
- Support multiple roles per user and derive effective permissions as their union.
- Add server-enforced protection for self-operation, super-admin hierarchy, and the last active super administrator.
- Split account status management from archival deletion and restoration permissions.
- Keep user deletion recoverable and non-destructive.
- Use 302 usage-log totals as the sole authoritative cumulative user consumption amount.
- Show model and request attribution from local billing records without presenting it as an official 302 breakdown.
- Expose coverage, difference, currency, freshness, and reconciliation state explicitly.
- Use a consistent 12-column desktop grid, clear information hierarchy, and aligned page/module boundaries.
- Replace native `prompt` and `confirm` interactions with structured, auditable forms and confirmation dialogs.
- Make desktop the complete management experience while safely degrading mobile to read and navigation tasks.

## Non-goals

- No custom-role builder or arbitrary permission editor.
- No replacement of the fixed role codes.
- No multi-provider billing abstraction in this cycle; the authoritative provider total remains 302-specific.
- No physical deletion of users, billing records, projects, usage events, credentials, or audit history.
- No change to end-user canvas, generation, workspace, project, or media-library workflows except where account archival already transfers workspace ownership.
- No automatic proportional allocation of an unexplained official difference across models.
- No display of complete API keys after their one-time creation response.
- No complete high-risk administration on mobile.

## Current Evidence and Structural Problems

### Two administration authentication models

`src/views/UsageAdmin.vue` uses a dedicated login card and `src/api/usageAdmin.js` stores a separate `USAGE_ADMIN_TOKEN`. The backend `usage-admin.routes.js` validates username/password environment variables, issues a `usage_admin` JWT, and protects all subsequent operations with `adminUsageRequired`.

The same capabilities already have RBAC equivalents under `/admin` for balance, records, API keys, assignment, users, and service access. Keeping both surfaces creates two permission models, two API clients, two component families, and a broad legacy token that cannot express least-privilege access.

### Routes do not own tasks

`/admin/dashboard`, `/admin/users`, `/admin/service`, `/admin/audit`, and `/admin/issues` all render `AdminUsers.vue`. Navigation updates the route and scrolls to a section. The overview always renders, users and service sections remain present when their permissions allow them, audit is conditionally route-specific, and issues remain visible whenever readable. This makes route ownership and loading behavior inconsistent.

### User actions are too dense

The current user table places role selection, status actions, deletion, service activation, manual binding, service disabling, reset, and limit editing inside table rows. Role selection is single-choice even though the backend and database support multiple roles. Native browser prompts and confirms provide little impact context and do not support structured validation.

### Permission gaps

The backend already prevents a non-super-admin from editing or deleting a super-admin account and prevents self-deletion. It does not fully enforce the approved invariants:

- role and status self-operation is mainly blocked by frontend controls;
- deletion reuses `admin.user.status.update` instead of a dedicated permission;
- there is no restore operation;
- there is no explicit last-active-super-admin invariant;
- the legacy usage-admin token bypasses the RBAC capability matrix.

### Consumption evidence is mixed

`buildAdminUserUsageView()` can replace the local billing-record total with normalized 302 key cost while retaining calls and `byModel` from billing records. The result is useful operationally but is not a single official record. Fields such as `totalCostUsd` can hold PTC amounts. The overview may use local `provider_billing_records` and `usage_daily_agg`, while user rows use live or cached 302 key totals.

### Admin user loading performs upstream enrichment

`listUsersForAdmin()` loads all users, profiles, assignments, usage events, credentials, billing records, and roles, then enriches credential totals through 302 inventory calls. Even with bounded concurrency and a short cache, this couples the user list to live upstream availability and creates work proportional to all credentials.

## Chosen Architecture

The implementation will consolidate within the existing Vue, Express, Supabase, and service/composable architecture. It will not create an Admin V2 application or a separate backend-for-frontend service.

The architecture has four boundaries:

1. **Task pages** own route-specific composition and data loading.
2. **RBAC and domain guards** own authorization and account invariants on the server.
3. **Admin read models** return explicit source, currency, scope, freshness, and state.
4. **302 synchronization** writes official snapshots; dashboard reads do not fan out to 302 for every user.

## Information Architecture and Routes

All pages use one `AdminShell`, sidebar, mobile navigation treatment, page header, notification entry, 12-column desktop content grid, and shared loading/error/empty-state components.

### `/admin/dashboard` — Overview

The overview supports decisions and routing, not editing.

It contains:

- a header with account context, role summary, data freshness, refresh, and a `待处理 N` notification trigger;
- user, service coverage, 302 official total, reconciliation coverage, and permission-health metrics;
- an official 302 delta trend derived from stored cumulative snapshots;
- queues for users requiring attention, reconciliation gaps, permission risk, and system/provider errors;
- links into the relevant task pages.

It must not load full audit logs, issue details, credential inventory, user rows, or live per-key usage.

### `/admin/users` and `/admin/users/:userId` — User Management

The list provides server-side search, status, service status, role, and reconciliation filters with server-side pagination. A compact row exposes identity, account state, official amount and attribution coverage, service summary, role summary, and recent activity.

Complex operations move to a deep-linkable user detail route. The detail is organized into summary, consumption, service credentials, roles and permissions, and audit tabs. A side panel may be used at desktop widths, but navigation must preserve `/admin/users/:userId` so the state is shareable and recoverable after refresh.

### `/admin/credentials` — Service and Credential Management

This page receives the authenticated capabilities from the old `/usage-admin` surface:

- 302 balance;
- provider API-key inventory;
- key creation, update, and deletion;
- user assignment and unassignment;
- limit and expiry presentation;
- masked key identity;
- explicit refresh and provider-error state.

Complete secrets are only returned in the one-time create response. Stored or later responses expose identity, suffix, status, limits, expiry, and assignment only.

### `/admin/usage` — Official Consumption and Reconciliation

This page owns:

- official 302 cumulative amount and snapshot-derived trend;
- attributed local amount, calls, models, tokens, images, and video seconds;
- coverage, difference, unmatched records, failed keys, and freshness;
- request and provider record search;
- manual reconciliation execution and previous run status.

The existing `/admin/service` frontend route becomes an authenticated redirect to `/admin/usage`.

### `/admin/access` — Roles and Permissions

This page shows the fixed role capability matrix and supports multi-role assignment. It does not allow role creation or direct editing of permission membership.

It must explain effective union permissions and the operator's grant boundary. An `admin` can assign `admin`, `ops`, `support`, and `user` subject to target hierarchy rules, but cannot grant or modify `super_admin`. Only `super_admin` can grant `super_admin`.

### `/admin/audit` — Audit Log

This becomes an independent page with action, operator, target, and date filters. Sensitive mutations include before state, after state, reason, request ID, IP, and User-Agent where available. Secrets are never included.

### `/admin/issues` — Issue Inbox

The existing issue grouping, detail, selection, export, email, notification, and status workflows remain intact. They move to the common page shell and retain their current individual permissions.

### Legacy route behavior

The old `/usage-admin` frontend path becomes an authenticated redirect to `/admin/credentials`; it no longer renders a separate login or application. The old `/api/v1/usage-admin/*` routes, `X-Admin-Token` client, usage-admin login/session flow, and related frontend token storage are removed after parity tests prove that every management capability is available through RBAC routes.

## Grid, Hierarchy, and Alignment Rules

- Desktop widths of 1280px and above use a 12-column content grid with 24px page gutters.
- Tablet widths from 768px to 1279px use an 8-column content grid with a collapsed navigation rail.
- Mobile widths below 768px use a 4-column grid and 16px page gutters.
- Spacing uses an 8px base rhythm.
- Page title, caption, freshness, and primary action share one header baseline.
- Status and notification entry precede metrics; metrics precede filters; filters precede business content; details and mutations follow selection.
- Metric cards in the same row have equal height and aligned label/value/note baselines.
- Toolbars align exactly with their table or panel boundary.
- A page exposes at most one primary action. Secondary actions live in contextual menus or detail pages. Destructive actions live in a dedicated danger zone.

## Notification Center

The approved UX replaces a persistent full-width status strip with a page-header notification trigger such as `待处理 5`.

On desktop, the trigger opens a non-blocking anchored popover. On mobile, it opens a full-width bottom sheet. Notifications are ordered by severity and include:

- a concise cause;
- affected item count;
- data time or last evaluation time;
- the target task page;
- a direct navigation action.

The first notification families are service-not-enabled users, reconciliation gaps, high-risk permission changes, and provider/system failures. These are derived operational states, not a second source of business truth. Read dismissal state may be stored separately from the underlying condition, but dismissing a notification must not change the condition itself.

## Fixed Role and Permission Model

Users may have multiple roles. Effective permissions are the union of role permissions. Domain guards can still deny an operation based on operator identity, target role, or system invariant even when the permission code is present.

### `super_admin`

- all dashboard, user, service, credential, usage, billing, access, audit, and issue capabilities;
- may grant and revoke `super_admin`, subject to self-operation and last-active-super-admin protection;
- exclusively owns user archival and restoration.

### `admin`

- full dashboard and user reads;
- role assignment excluding `super_admin` targets and grants;
- suspend and resume non-super-admin users;
- service activation, manual binding, disabling, reset, and limits;
- credential read, assign, create, update, and delete;
- official usage read and reconciliation;
- full audit and issue capabilities currently assigned to `admin`.

### `ops`

- dashboard, user, usage, reconciliation, and audit reads;
- reconciliation execution;
- credential inventory read without secret or mutation access;
- existing issue read/export/notify capabilities;
- no account status, role, service-access, key assignment, or key management mutation.

### `support`

- reduced dashboard;
- user read;
- issue read;
- no global usage, audit, role, status, service, credential, or billing mutation.

### `user`

- no admin dashboard access.

### New and refined permissions

The migration introduces or formalizes:

- `admin.user.delete` for archival;
- `admin.user.restore` for restoration;
- `admin.api_key.read` for masked credential inventory;
- `admin.access.read` for role/capability matrix access.

Existing permissions continue to cover dashboard read, user read, role update, status update, usage read, key assignment, key management, service access, billing reconciliation, audit, and issue operations.

### Account mutation routes

- `PATCH /admin/users/:userId/roles` accepts the complete non-empty `roleCodes` array and requires `admin.user.role.update`.
- `PATCH /admin/users/:userId/status` accepts `active` or `suspended` plus a reason and requires `admin.user.status.update`.
- `DELETE /admin/users/:userId` performs archival, requires a reason, and requires `admin.user.delete`.
- `POST /admin/users/:userId/restore` restores an archived account to suspended, requires a reason, and requires `admin.user.restore`.

The service layer applies identity, hierarchy, and last-active-super-admin invariants after the route permission check.

## Server-Enforced Account Invariants

Frontend controls communicate availability but are never the security boundary.

Every relevant backend mutation enforces:

1. An operator cannot modify their own roles.
2. An operator cannot suspend, archive, or restore their own account.
3. A non-super-admin cannot modify, suspend, archive, restore, or grant a `super_admin` role.
4. No role update, suspension, or archival operation may leave the system without at least one active, non-deleted `super_admin`.
5. An archived user cannot be activated or receive service/credential mutations until restored.
6. Restoration returns an account to `suspended`, not directly to active, and does not automatically reactivate service credentials.
7. Credential-management keys and reserved provider/system keys cannot be assigned as user runtime credentials.
8. Every mutation writes an audit record after the domain mutation succeeds.

## User Lifecycle

### Active

The user may authenticate and use an active service credential.

### Suspended

Suspension revokes sessions, transfers team-workspace ownership according to the existing workflow, and attempts to disable the active service credential. The account can be resumed by an authorized operator.

### Deleted

Archival sets the existing deleted fields, revokes sessions, transfers team-workspace ownership, removes assignments, disables service access, invalidates cached authorization, and retains all referential data.

### Restored

Only `super_admin` may restore. Restoration clears deletion metadata and returns the account to `suspended`. A separate resume action and, when needed, a separate service-activation action are required. This makes restoration explicit and avoids silently re-enabling billing access.

## Sensitive Interaction Design

Native browser prompts and confirms are removed from admin mutations.

Structured dialogs show:

- the target identity;
- the action and irreversible side effects;
- current and proposed state;
- affected sessions, credentials, assignments, and workspace ownership when relevant;
- a required reason for suspension, archival, restoration, credential reset, and limit changes;
- a typed target email or name confirmation for archival and destructive credential deletion.

Sensitive operations wait for the server response before changing local state. Successful operations refresh only affected page data and append the resulting audit state. Failures preserve the form and show the stable domain error.

## 302 Official Consumption Contract

### Official cumulative total

The authoritative cumulative amount is obtained through the existing 302 usage-log chain:

`runtime api_key -> /gpt/api/token_id -> /gpt/api/token/usage/{tokenId}`

The normalized value contains:

- provider: `302`;
- source: `302_usage_log`;
- amount;
- currency, expected to be `PTC` for the current integration;
- API name and credential identity;
- captured time;
- success, partial, or failure state.

Raw dashboard `current_cost` remains non-authoritative and must not be used as a fallback official amount.

### Official usage snapshots

A new `provider_usage_snapshots` table stores each synchronization result by provider API name and user. It contains:

- `id uuid primary key`;
- `sync_run_id uuid not null` referencing `provider_usage_sync_runs(id)`;
- `provider text not null`;
- `api_name text not null`;
- `user_id uuid null` referencing `users(id)`;
- `service_credential_id uuid null` referencing `user_service_credentials(id)`;
- `total_amount numeric(18,6) null`;
- `currency text null`;
- `snapshot_at timestamptz not null`;
- `status text not null` constrained to `success`, `unmatched`, or `failed`;
- `error_code text null` containing a safe normalized code only.

Each run has at most one row per provider/API name. Indexes cover `(user_id, snapshot_at desc)`, `(api_name, snapshot_at desc)`, and `(sync_run_id)`.

`provider_usage_sync_runs` contains:

- `id uuid primary key`;
- `provider text not null`;
- `status text not null` constrained to `running`, `completed`, `partial`, or `failed`;
- `requested_by uuid null` referencing `users(id)`;
- `started_at timestamptz not null`;
- `completed_at timestamptz null`;
- `total_keys`, `succeeded_keys`, `failed_keys`, `matched_users`, and `unmatched_keys` as non-negative integers;
- `error_summary jsonb null` containing counts and safe error codes without secrets.

The first successful snapshot is a baseline. It does not create historical usage. Later daily deltas are derived from adjacent comparable cumulative snapshots. Missing dates are gaps, not zeros. Negative deltas are marked as reset or anomaly and are not silently included in normal consumption.

### Local attribution

`provider_billing_records` remains the evidence for:

- attributed amount;
- local attributed call count;
- model breakdown;
- input/output tokens;
- image count;
- video seconds;
- provider request and task identity;
- reconciliation status.

The UI labels these values as local or attributed. It does not label the call count or model breakdown as official unless 302 provides that exact dimension.

### Coverage and difference

Coverage is computed only when official and attributed records have the same currency and compatible cumulative scope.

`difference = official cumulative amount - comparable attributed amount`

`coverage = comparable attributed amount / official cumulative amount`

The raw result is preserved. Values above 100% are not clamped; they indicate over-attribution or a scope problem. A zero official total with a non-zero attributed amount is an anomaly, not 100% coverage.

The unexplained difference remains unallocated. The system does not scale or distribute it across models.

### Reconciliation states

- `reconciled`: comparable evidence exists and the absolute difference is within `max(0.01 PTC, official cumulative amount × 0.001)`.
- `partial`: one or more keys or records failed, are unmatched, or produce insufficient coverage.
- `unavailable`: no current official value can be obtained; the UI shows unavailable rather than zero.
- `not_comparable`: currency or scope differs, so no difference or coverage is computed.
- `anomalous`: cumulative reset, negative delta, over-attribution, or invalid official baseline requires investigation.

The absolute tolerance is `0.01 PTC` and the relative tolerance is `0.001` (0.1%). Both are named constants covered by tests, not formatting side effects.

### Currency-safe naming

New admin read models use `amount` and `currency`. PTC values are not stored or returned through fields named `totalCostUsd`. During migration, only the existing `admin-usage-view.js` compatibility export may map the new value into the legacy field for untouched callers. That mapping is removed before the legacy `/usage-admin` surface is deleted and before acceptance testing.

## Admin Read Models and Loading Boundaries

### Overview read model

`GET /admin/overview` returns locally aggregated metrics, notification counts, freshness, reconciliation health, and permission health. It does not request live 302 data.

### User list read model

`GET /admin/users` accepts page, limit, search, account status, service status, role, and reconciliation state. It returns paginated summaries based on local tables and latest snapshots. It does not load every usage event, billing record, or upstream key detail for all users.

### User detail read model

`GET /admin/users/:userId` returns the selected user's identity, lifecycle, roles, service state, current official snapshot, attribution summary, assignments, and reconciliation state.

`GET /admin/users/:userId/usage` returns model/request attribution and comparable official snapshots for the consumption tab. `GET /admin/users/:userId/audit` returns the selected user's paginated audit timeline. The summary route does not embed full billing or audit history.

### Credential read model

The RBAC `/admin/302/*` endpoints remain the provider-management boundary. A new read permission distinguishes masked inventory from mutation access. Responses remove complete runtime keys from list/detail payloads before returning to the browser.

### Usage and reconciliation read model

The usage summary and timeseries endpoints use snapshots and billing records. Manual reconciliation records run metadata and returns success, partial, or failure results without rewriting unavailable amounts to zero.

## Data Synchronization and Performance

- User-list requests read the latest stored official snapshot rather than performing per-user upstream enrichment.
- Credential inventory is fetched only on the credentials page or during explicit synchronization.
- Overview reads local aggregates only.
- A synchronization run bounds upstream concurrency and isolates per-key failure.
- A failed key does not clear previous successful snapshots for other keys.
- The UI shows the last successful provider capture time separately from the current request time.
- Server-side user pagination replaces loading the entire user and usage history into the browser.

## Error and Partial-State Handling

- A route-level 403 explains the missing capability and offers navigation to the nearest allowed page.
- Module failures are isolated. A failed provider request does not hide identity, role, or locally available usage data.
- `unavailable`, `partial`, `not_comparable`, and `anomalous` are first-class response states.
- Empty state, unavailable state, and zero value have distinct presentations.
- Provider errors expose safe codes and retry guidance without API keys or upstream secret material.
- Loading states use skeletons that preserve final grid geometry.
- Every asynchronous page state reaches ready, empty, partial, forbidden, or error; indefinite loading is not allowed.

## Responsive and Mobile Safety

Desktop supports all authorized actions.

Tablet supports read workflows and low-risk edits where the full structured form fits without hiding impact information.

Mobile supports overview, navigation, search, filtering, user state, usage state, notification review, and issue reading. Role assignment, archival, restoration, credential creation/deletion, service reset, and limit changes are not executable on mobile. Their entry points explain that a desktop session is required.

## Component and Service Boundaries

### Frontend route pages

- a shared admin route layout owns shell, navigation, session context, and route outlet;
- overview, users, credentials, usage, access, audit, and issues each own their page composition;
- the current `AdminUsers.vue` becomes user-page composition rather than the entire admin application;
- existing focused components are reused where their responsibility still matches;
- `UsageAdmin*` components are either migrated into neutral credential components or removed after equivalent RBAC components exist;
- route metadata declares the permission required for navigation, but the server remains authoritative.

### Frontend state

- each task page owns its query and mutation state;
- reusable pure helpers own formatting, reconciliation presentation, pagination, and permission-derived visibility;
- notification state is derived from overview data and links to task routes;
- user list and user detail state are separate so a detail refresh does not reload the entire list.

### Backend routes and services

- `admin.routes.js` remains the authenticated RBAC router and is decomposed further if route size would otherwise grow materially;
- `admin-user-management.js` owns lifecycle and role invariants;
- credential management and assignment continue to use the existing 302 and assignment services behind refined permissions;
- official snapshot synchronization lives in a focused service separate from pure read-model aggregation;
- overview, user list, user detail, and usage read models have focused query/aggregation modules;
- `usage-admin.routes.js`, `admin-auth.js`, and the corresponding independent token flow are removed after parity.

## Audit Requirements

Every successful sensitive mutation records:

- operator user ID;
- target user, credential, or resource ID;
- stable action code;
- before and after state;
- required reason when applicable;
- request ID;
- IP and User-Agent where available;
- safe provider or reconciliation metadata.

Audit metadata must never contain complete API keys, passwords, bearer tokens, encrypted credential material, or raw provider responses that can include secrets.

## Migration and Release Sequence

This is one product consolidation but is implemented and verified in ordered steps:

1. Add permissions, snapshot storage, synchronization-run storage, indexes, and role mappings.
2. Add backend guards, restore behavior, currency-safe read models, snapshots, pagination, and RBAC credential parity.
3. Add the shared route layout and independent task pages behind the existing authenticated admin entry.
4. Migrate credential inventory, creation, deletion, and assignment UX from `/usage-admin`.
5. Verify parity for balance, key inventory, key creation/update/deletion, assignment/unassignment, user visibility, and provider record lookup.
6. Replace `/usage-admin` with an authenticated redirect to `/admin/credentials`.
7. Remove the independent login/session/token API, client token storage, obsolete components, and obsolete environment-variable requirements when no remaining consumer exists.
8. Run database, backend, frontend, responsive-browser, secret-exposure, and route-compatibility verification.

No step may remove the legacy management path before the replacement capability and its RBAC test are present.

## Testing Strategy

### RBAC and lifecycle

- route tests for every read and mutation permission;
- union-permission behavior for multi-role users;
- admin cannot grant or edit `super_admin`;
- self role update, suspension, archival, and restoration are rejected by the service;
- last active super admin cannot be demoted, suspended, or archived;
- archival revokes sessions, transfers workspace ownership, removes assignments, disables service, and preserves history;
- restoration returns the account to suspended and does not reactivate service;
- every successful sensitive action writes secret-safe audit metadata.

### Official usage and attribution

- list/detail runtime-key fallback still produces the normalized 302 usage total;
- raw `current_cost` is never used as official fallback;
- first snapshot creates a baseline without historical delta;
- adjacent comparable snapshots produce the expected positive delta;
- missing, negative, reset, or currency-mismatched snapshots produce explicit states;
- multiple valid keys aggregate correctly without duplicates;
- a failed key produces `partial` while retaining successful values;
- unavailable official data is not returned as zero;
- model amounts remain local attribution and are not scaled to the official total;
- coverage and difference handle zero, over-attribution, and non-comparable evidence.

### Admin read models and performance

- overview performs local reads only;
- paginated user list does not perform per-user 302 calls;
- filters and pagination return stable totals and ordering;
- user detail returns source, amount, currency, freshness, and state;
- credential inventory masks secrets for read-only and management roles;
- provider synchronization bounds concurrency and records run status.

### Frontend routes and UX

- every sidebar item maps to an independent route and required permission;
- unauthorized routes redirect or render a clear forbidden state without requesting protected data;
- page loaders are scoped to their task;
- notification popover groups actionable states and links to the correct route;
- user table remains scan-oriented and complex actions live in detail/dialog UI;
- structured dialogs validate reasons and typed confirmation;
- desktop, tablet, and mobile grids preserve alignment and information order;
- mobile blocks high-risk mutations while preserving read workflows;
- `/usage-admin` redirects after parity and no longer exposes a separate login.

### Verification gates

- focused red-green Node tests for every new behavior;
- full `npm run check`;
- `npm run build` with a fresh exit code and output review;
- `git diff --check`;
- migration syntax and schema checks;
- browser smoke tests for all seven routes, permission variants, partial provider failure, responsive breakpoints, structured dialogs, and legacy redirect;
- built-bundle and response inspection to confirm no complete API key or legacy Admin Token flow remains in the frontend.

## Acceptance Criteria

- The normal authenticated RBAC session is the only administration authentication model.
- All old `/usage-admin` management capabilities are available under `/admin/credentials` or `/admin/usage` before the legacy API is removed.
- Each admin route owns one task, one loader boundary, and a consistent grid-aligned page structure.
- Users can hold multiple fixed roles, and the UI explains effective permissions.
- Server-side guards prevent self-operation, unauthorized hierarchy changes, and removal of the last active super administrator.
- User archival is independently permissioned, recoverable, audited, and non-destructive.
- 302 usage-log is the sole official cumulative total, with amount, currency, source, and freshness visible.
- Model and request values are explicitly local attribution, with difference and coverage shown only when comparable.
- Unavailable provider data is visibly unavailable and is never silently represented as zero.
- The overview and user list no longer fan out to live 302 usage calls for every credential.
- Sensitive operations use structured dialogs and never expose complete credentials.
- Mobile retains useful read workflows while blocking high-risk mutations.
- Focused tests, full checks, build, migration validation, and browser smoke tests pass before completion is claimed.
