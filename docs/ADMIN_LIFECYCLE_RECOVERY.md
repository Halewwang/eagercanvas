# Admin lifecycle recovery

This runbook covers interrupted account suspension, archive, and service-access mutations, plus the mandatory non-rolling deployment sequence for the lifecycle schema. The recovery RPC is deliberately service-role-only. Run it from a controlled backend or SQL session that holds the Supabase service role, never from a browser client.

## Safety rules

- Identify the target user and current operator explicitly. The operator must still hold `super_admin` in `public.user_roles` when the recovery transaction runs.
- Read the persisted token immediately before recovery and pass that exact value as the expected token. Never copy a token from an old incident or retry blindly.
- Do not clear or overwrite an archive whose phase is `provider_revoking`, `provider_revoked`, or `projects_transferred`. `provider_revoking` means an upstream request may already have been applied even if its response was lost. Resume the normal archive request so it continues from the stored phase.
- Do not clear a suspension after `projects_transferred`. `provider_revoking` and `provider_revoked` are non-abortable because an upstream request may already have applied. Resume the normal suspension request with a currently authorized operator.
- There is no automatic stale-token takeover for service leases. Confirm that the worker which owns a lease has stopped before clearing it.

## Inspect the current state

```sql
select id, email, status, deleted_at,
       archive_previous_status, archive_started_at, archive_phase, archive_token,
       archive_event_id, archive_operator_user_id,
       archive_audit_metadata, archive_project_transfer,
       suspension_previous_status, suspension_started_at, suspension_phase, suspension_token,
       suspension_event_id, suspension_operator_user_id,
       suspension_audit_metadata, suspension_project_transfer,
       restore_event_id, restore_operator_user_id,
       service_mutation_started_at, service_mutation_token
from public.users
where id = '<target-user-uuid>';
```

Record the result in the incident. Check the operator's current database role too:

```sql
select exists (
  select 1
  from public.user_roles ur
  join public.roles r on r.id = ur.role_id
  where ur.user_id = '<operator-user-uuid>' and r.code = 'super_admin'
) as operator_is_super_admin;
```

## Abort a pre-provider archive

Use `abort_pre_provider_archive` only when all of these are true:

- `status = 'archiving'`
- `archive_phase = 'prepared'`
- no provider revocation request has been attempted
- `archive_token` equals the expected token captured during inspection

```sql
select public.admin_recover_account_mutation(
  '<target-user-uuid>',
  '<operator-user-uuid>',
  '<expected-archive-token>',
  'abort_pre_provider_archive'
);
```

The RPC locks the shared `super_admin` role row and the user row, rechecks the operator role, verifies the expected token and phase, then restores `archive_previous_status`. It refuses to roll back after provider revocation.

## Abort an untouched suspension reservation

Use `abort_pre_provider_suspension` only when `status = 'suspending'`, `suspension_phase = 'prepared'`, the project-transfer worker never started, and the captured token still matches. If project transfer may have run, resume instead of aborting.

```sql
select public.admin_recover_account_mutation(
  '<target-user-uuid>',
  '<operator-user-uuid>',
  '<expected-suspension-token>',
  'abort_pre_provider_suspension'
);
```

The RPC restores `suspension_previous_status` and clears only the matching fenced reservation. Token or phase mismatches stop recovery.

## Clear an abandoned service lease

Use `clear_service_lease` only after confirming the owning process is no longer running, the account is neither archiving nor deleted, and `service_mutation_token` equals the expected token.

```sql
select public.admin_recover_account_mutation(
  '<target-user-uuid>',
  '<operator-user-uuid>',
  '<expected-service-mutation-token>',
  'clear_service_lease'
);
```

Do not use this action to interrupt a live credential mutation. A token mismatch is a fencing failure and must be investigated rather than bypassed.

## Resume a post-provider archive

When `archive_phase` is `provider_revoking`, `provider_revoked`, or `projects_transferred`, call the normal authorized archive endpoint again. `admin_prepare_user_archive_atomic` issues a new fenced token while preserving the phase. A `provider_revoking` retry idempotently repeats provider disable because the earlier outcome is uncertain; later phases skip completed irreversible work and finalize the user as deleted.

Finalization is one PostgreSQL transaction: deleted status, session revocation, API-key assignment removal, and the `admin.user.delete` audit row commit or roll back together. `archive_event_id` is the stable idempotency key, so a lost RPC response or a retry of an already-deleted legacy row reconciles cleanup without duplicating the archive audit.

Do not call either recovery action for this state. In particular, never restore the user to active or suspended after the provider credential has been revoked.

## Resume a suspension

Call the normal authorized status endpoint again with `status = suspended` and the original reason. Preparation rotates the worker token but preserves the initiator, original audit context, stable event ID, and completed phase. A different authorized operator creates a secret-safe `admin.user.suspension.resume` audit row. `projects_transferred` resumes at provider revocation; `provider_revoking` repeats the idempotent provider-disable reconciliation; `provider_revoked` runs only the atomic finalizer.

The finalizer commits `status = suspended`, session revocation, and `admin.user.status.update` audit insertion in one PostgreSQL transaction. A response loss is retried from the durable marker without duplicating the audit.

## Mandatory schema rollout barrier

Do not use a rolling deployment for migration 016. Old processes do not understand `suspending`, suspension phases, or the new RPC signatures. The new server also defaults `ADMIN_LIFECYCLE_MUTATIONS_ENABLED` to disabled; that guard is defense in depth and does not make mixed-version traffic safe.

1. Set `ADMIN_LIFECYCLE_MUTATIONS_ENABLED=false` and take admin lifecycle mutation traffic offline at the load balancer or maintenance layer.
2. Verify no active lifecycle mutation exists and capture any recovery work:

   ```sql
   select id, status, archive_phase, suspension_phase, service_mutation_token
   from public.users
   where status in ('archiving', 'suspending') or service_mutation_token is not null;
   ```

3. Drain and terminate every old application worker. Prove the old revision has zero serving instances before applying schema.
4. Back up the database and record the current application revision. The rollback boundary is before migration 016: before schema application, restore traffic to the old revision; after schema application, do not send traffic to old code. Roll forward to the compatible revision or restore the database backup.
5. Apply all pending migrations, then run `scripts/verify-admin-lifecycle-pg16.sh`. Its exact-matrix, function-signature, transaction, restore-epoch, and saga checks must pass.
6. Deploy exactly one compatible revision with the guard still false. Verify health, revision identity, and that a lifecycle request returns `ADMIN_LIFECYCLE_MAINTENANCE`.
7. Set `ADMIN_LIFECYCLE_MUTATIONS_ENABLED=true` on that compatible revision, redeploy/restart it, and smoke-test one authorized activation plus audit correlation ID.
8. Re-enable admin mutation traffic. Scale out only the same compatible revision.

Proof to retain with the release record: drained old-worker count, migration output, verifier output, deployed commit, guard-disabled 503 response, guard-enabled smoke-test request ID, and the matching `admin_operation_logs` row.

## Verify recovery

Repeat the state query after the RPC or resumed archive:

- An aborted pre-provider archive has its previous status restored and all `archive_*` fields cleared.
- A cleared service lease has both `service_mutation_token` and `service_mutation_started_at` cleared.
- A completed archive has `status = 'deleted'`, a non-null `deleted_at`, and all archive phase/token fields cleared.
- A completed suspension has `status = 'suspended'`, null suspension phase/token fields, revoked sessions, and exactly one `admin.user.status.update` row for its event ID.

If the postcondition differs, stop and preserve the current rows and application logs for investigation. Do not issue a second recovery call with a different expected token.
