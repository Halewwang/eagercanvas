# Admin Dashboard Consolidation Roadmap

The approved design is implemented through three ordered plans. Complete and verify each plan before starting the next.

1. [`2026-07-11-admin-rbac-account-lifecycle.md`](./2026-07-11-admin-rbac-account-lifecycle.md)
   - Add the refined permission matrix.
   - Enforce self-operation, hierarchy, and last-super-admin invariants.
   - Add recoverable user restoration.
   - Provide secret-safe RBAC credential-management parity.

2. [`2026-07-11-302-usage-snapshots-read-models.md`](./2026-07-11-302-usage-snapshots-read-models.md)
   - Store official 302 cumulative snapshots and synchronization runs.
   - Separate official totals from local model attribution.
   - Add currency-safe reconciliation states and snapshot-derived trends.
   - Replace live per-user dashboard enrichment with local read models.

3. [`2026-07-11-admin-task-pages-legacy-consolidation.md`](./2026-07-11-admin-task-pages-legacy-consolidation.md)
   - Replace the long scrolling admin page with seven independent task routes.
   - Add the aligned grid, notification popover, user detail, and structured dialogs.
   - Move `/usage-admin` credential workflows into RBAC pages.
   - Remove the legacy Admin Token frontend and backend after parity verification.

## Program Gates

- Do not remove `/api/v1/usage-admin/*` until Plan 3 proves balance, credential inventory, credential creation/update/deletion, assignment/unassignment, user visibility, and provider record lookup through RBAC routes.
- Do not switch user/overview consumption UI to the new contract until Plan 2 has stored a successful baseline snapshot and the fallback state is explicitly `unavailable`, never numeric zero.
- Do not expose archival or restoration UI until Plan 1 server invariants and permission tests pass.
- Run `npm run check`, `npm run build`, `git diff --check`, migration validation, and browser smoke tests at the end of every plan.

## Final Outcome

After all three plans, the normal authenticated RBAC session is the only admin authentication model, the admin routes own independent tasks, 302 usage-log is the authoritative cumulative total, local billing records are clearly labeled attribution evidence, and high-risk actions are server-guarded and auditable.
