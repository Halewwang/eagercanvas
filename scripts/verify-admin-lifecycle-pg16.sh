#!/usr/bin/env bash
set -euo pipefail

# Reusable PostgreSQL 16 release verification for migration rerun, exact
# permission matrix, atomic audit rollback/response loss, restore epoch,
# suspension saga, and role/status/archive concurrency contracts.

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PG_BIN="${PG_BIN:-/opt/homebrew/opt/postgresql@16/bin}"
PGPORT="${PGPORT:-$((56000 + $$ % 3000))}"
WORK_DIR="$(mktemp -d "/tmp/eager-admin-pg16.XXXXXX")"
DATA_DIR="$WORK_DIR/data"
SOCKET_DIR="$WORK_DIR/socket"
DB_NAME="eager_admin_lifecycle_verify"

cleanup() {
  "$PG_BIN/pg_ctl" -D "$DATA_DIR" stop -m fast >/dev/null 2>&1 || true
  rm -rf "$WORK_DIR"
}
trap cleanup EXIT INT TERM

if [[ ! -x "$PG_BIN/postgres" ]]; then
  echo "PostgreSQL 16 binaries not found at $PG_BIN" >&2
  exit 1
fi
if [[ "$("$PG_BIN/postgres" --version)" != *" 16."* ]]; then
  echo "PostgreSQL 16 is required: $("$PG_BIN/postgres" --version)" >&2
  exit 1
fi

mkdir -p "$SOCKET_DIR"
"$PG_BIN/initdb" -D "$DATA_DIR" -A trust -U postgres >/dev/null
if ! "$PG_BIN/pg_ctl" -D "$DATA_DIR" -l "$WORK_DIR/postgres.log" -o "-k $SOCKET_DIR -p $PGPORT -F" -w start >/dev/null; then
  sed -n '1,160p' "$WORK_DIR/postgres.log" >&2
  exit 1
fi
"$PG_BIN/createdb" -h "$SOCKET_DIR" -p "$PGPORT" -U postgres "$DB_NAME"

PSQL=("$PG_BIN/psql" -X -v ON_ERROR_STOP=1 -h "$SOCKET_DIR" -p "$PGPORT" -U postgres -d "$DB_NAME")
"${PSQL[@]}" <<'SQL'
create role anon;
create role authenticated;
create role service_role;
create schema auth;
create or replace function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;
SQL

for migration in \
  "$ROOT_DIR/supabase/001_init.sql" \
  "$ROOT_DIR/supabase/002_auth_registration.sql" \
  "$ROOT_DIR/supabase/003_usage_admin_key_assignments.sql" \
  "$ROOT_DIR/supabase/004_rbac_admin_system.sql" \
  "$ROOT_DIR/supabase/005_user_account_status.sql" \
  "$ROOT_DIR/supabase/009_workspace_shared_templates.sql" \
  "$ROOT_DIR/supabase/010_service_access_billing.sql" \
  "$ROOT_DIR/supabase/013_team_workspaces.sql" \
  "$ROOT_DIR/supabase/016_admin_rbac_lifecycle.sql"; do
  "${PSQL[@]}" -f "$migration" >/dev/null
done

# Seed permission-matrix drift, rerun migration 016 twice, then assert exact convergence.
"${PSQL[@]}" <<'SQL'
insert into public.role_permissions(role_id, permission_id)
select r.id, p.id from public.roles r cross join public.permissions p
where p.code in ('admin.user.delete','admin.user.restore','admin.api_key.read','admin.access.read')
on conflict do nothing;
SQL
"${PSQL[@]}" -f "$ROOT_DIR/supabase/016_admin_rbac_lifecycle.sql" >/dev/null
"${PSQL[@]}" -f "$ROOT_DIR/supabase/016_admin_rbac_lifecycle.sql" >/dev/null
"${PSQL[@]}" <<'SQL'
do $$
declare actual jsonb;
begin
  select jsonb_object_agg(code, roles order by code) into actual
  from (
    select p.code, jsonb_agg(r.code order by r.code) roles
    from public.permissions p
    join public.role_permissions rp on rp.permission_id = p.id
    join public.roles r on r.id = rp.role_id
    where p.code in ('admin.user.delete','admin.user.restore','admin.api_key.read','admin.access.read')
    group by p.code
  ) m;
  if actual <> '{"admin.access.read":["admin","super_admin"],"admin.api_key.read":["admin","ops","super_admin"],"admin.user.delete":["super_admin"],"admin.user.restore":["super_admin"]}'::jsonb then
    raise exception 'permission matrix mismatch: %', actual;
  end if;
  if to_regprocedure('public.admin_replace_user_roles_atomic(uuid,text[],uuid,uuid,jsonb)') is null
    or to_regprocedure('public.admin_update_user_status_atomic(uuid,text,timestamp with time zone,text,uuid,uuid,jsonb)') is null
    or to_regprocedure('public.admin_prepare_user_suspension_atomic(uuid,uuid,uuid,jsonb)') is null
    or to_regprocedure('public.admin_suspend_user_atomic(uuid,uuid,uuid)') is null
    or to_regprocedure('public.admin_transfer_workspace_projects_atomic(uuid,uuid,uuid[],uuid,uuid,uuid)') is null
    or to_regprocedure('public.admin_enforce_project_owner_eligibility()') is null
    or to_regprocedure('public.admin_sync_project_owner_membership()') is null
    or to_regprocedure('public.admin_enforce_project_member_owner_integrity()') is null
    or to_regclass('public.admin_workspace_transfer_events') is null then
    raise exception 'required RPC signature missing';
  end if;
  if not has_function_privilege('service_role', 'public.admin_replace_user_roles_atomic(uuid,text[],uuid,uuid,jsonb)', 'EXECUTE')
    or has_function_privilege('anon', 'public.admin_replace_user_roles_atomic(uuid,text[],uuid,uuid,jsonb)', 'EXECUTE')
    or has_function_privilege('authenticated', 'public.admin_replace_user_roles_atomic(uuid,text[],uuid,uuid,jsonb)', 'EXECUTE')
    or not has_function_privilege('service_role', 'public.admin_transfer_workspace_projects_atomic(uuid,uuid,uuid[],uuid,uuid,uuid)', 'EXECUTE')
    or has_function_privilege('anon', 'public.admin_transfer_workspace_projects_atomic(uuid,uuid,uuid[],uuid,uuid,uuid)', 'EXECUTE') then
    raise exception 'RPC grant boundary mismatch';
  end if;
  if not (select relrowsecurity from pg_class where oid='public.admin_workspace_transfer_events'::regclass)
    or not has_table_privilege('service_role', 'public.admin_workspace_transfer_events', 'SELECT')
    or has_table_privilege('service_role', 'public.admin_workspace_transfer_events', 'INSERT')
    or has_table_privilege('service_role', 'public.admin_workspace_transfer_events', 'UPDATE')
    or has_table_privilege('service_role', 'public.admin_workspace_transfer_events', 'DELETE')
    or has_table_privilege('anon', 'public.admin_workspace_transfer_events', 'SELECT')
    or has_table_privilege('authenticated', 'public.admin_workspace_transfer_events', 'SELECT') then
    raise exception 'workspace transfer event evidence RLS or grants mismatch';
  end if;
  if (select count(*) from pg_trigger where tgrelid='public.projects'::regclass and tgname='trg_projects_owner_eligibility' and not tgisinternal) <> 1 then
    raise exception 'project owner eligibility trigger missing or duplicated';
  end if;
  if (select count(*) from pg_trigger where tgrelid='public.projects'::regclass and tgname='trg_projects_sync_owner_membership' and not tgisinternal) <> 1
    or (select count(*) from pg_trigger where tgrelid='public.project_members'::regclass and tgname='trg_project_members_owner_integrity' and not tgisinternal) <> 1 then
    raise exception 'project owner membership trigger missing or duplicated';
  end if;
end $$;
SQL
echo "PASS permission matrix, migration rerun, RPC signatures, and grants"

"${PSQL[@]}" <<'SQL'
insert into public.users(id,email,status) values
 ('00000000-0000-0000-0000-000000000001','operator@example.com','active'),
 ('00000000-0000-0000-0000-000000000002','target@example.com','active'),
 ('00000000-0000-0000-0000-000000000003','peer@example.com','active')
on conflict (id) do nothing;
insert into public.user_roles(user_id,role_id)
select u.id,r.id from public.users u cross join public.roles r
where u.id = any(array['00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000003']::uuid[])
  and r.code='super_admin'
on conflict do nothing;
insert into public.user_roles(user_id,role_id)
select '00000000-0000-0000-0000-000000000002',id from public.roles where code='user'
on conflict do nothing;

-- response loss: discard the first successful response, retry same role set with a new token.
select public.admin_replace_user_roles_atomic(
 '00000000-0000-0000-0000-000000000002', array['admin','user'],
 '00000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001',
 '{"requestId":"response-loss-1"}'::jsonb
);
select public.admin_replace_user_roles_atomic(
 '00000000-0000-0000-0000-000000000002', array['admin','user'],
 '00000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000002',
 '{"requestId":"response-loss-2"}'::jsonb
);
do $$ begin
  if (select count(*) from public.admin_operation_logs where action='admin.user.role.update' and target_user_id='00000000-0000-0000-0000-000000000002') <> 1 then
    raise exception 'response loss retry duplicated audit';
  end if;
end $$;

-- atomic audit rollback: audit failure must roll back the role replacement.
create or replace function public.verify_reject_role_audit() returns trigger language plpgsql as $$
begin if new.action='admin.user.role.update' then raise exception 'VERIFY_AUDIT_FAILURE'; end if; return new; end $$;
create trigger verify_reject_role_audit before insert on public.admin_operation_logs
for each row execute function public.verify_reject_role_audit();
do $$ begin
  begin
    perform public.admin_replace_user_roles_atomic(
      '00000000-0000-0000-0000-000000000002', array['user'],
      '00000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000003', '{}'::jsonb);
    raise exception 'expected audit failure';
  exception when others then
    if sqlerrm='expected audit failure' then raise; end if;
  end;
  if (select array_agg(r.code order by r.code) from public.user_roles ur join public.roles r on r.id=ur.role_id where ur.user_id='00000000-0000-0000-0000-000000000002') <> array['admin','user'] then
    raise exception 'atomic audit rollback failed';
  end if;
end $$;
drop trigger verify_reject_role_audit on public.admin_operation_logs;
drop function public.verify_reject_role_audit();
SQL
echo "PASS atomic audit rollback and response loss"

"${PSQL[@]}" <<'SQL'
insert into public.workspaces(id,slug,name,kind,created_by) values
 ('30000000-0000-0000-0000-000000000001','transfer-test','Transfer Test','team','00000000-0000-0000-0000-000000000003');
insert into public.projects(id,user_id,name,workspace_id,access_mode) values
 ('31000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000002','team-owned','30000000-0000-0000-0000-000000000001','team'),
 ('31000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000002','personal-owned',null,'private'),
 ('31000000-0000-0000-0000-000000000003','00000000-0000-0000-0000-000000000001','unrelated-team','30000000-0000-0000-0000-000000000001','team'),
 ('31000000-0000-0000-0000-000000000004','00000000-0000-0000-0000-000000000002','archive-team-owned','30000000-0000-0000-0000-000000000001','team');
select public.admin_prepare_user_suspension_atomic(
 '00000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000001',
 '32000000-0000-0000-0000-000000000001','{"reason":"transfer response loss"}'::jsonb);

-- The trigger fires after the plan, workspace membership, and owner update statements.
-- A failure here must roll all earlier statements back with the RPC transaction.
create or replace function public.verify_reject_transfer_member() returns trigger language plpgsql as $$
begin raise exception 'VERIFY_TRANSFER_MEMBER_FAILURE'; end $$;
create trigger verify_reject_transfer_member before insert or update on public.project_members
for each row execute function public.verify_reject_transfer_member();
do $$ begin
  begin
    perform public.admin_transfer_workspace_projects_atomic(
      '32000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000001',
      array['31000000-0000-0000-0000-000000000001']::uuid[],
      '00000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000003',
      '00000000-0000-0000-0000-000000000001');
    raise exception 'expected transfer failure';
  exception when others then
    if sqlerrm='expected transfer failure' then raise; end if;
  end;
  if exists (select 1 from public.admin_workspace_transfer_plans where event_id='32000000-0000-0000-0000-000000000001')
    or exists (select 1 from public.admin_workspace_transfer_events where event_id='32000000-0000-0000-0000-000000000001')
    or (select user_id from public.projects where id='31000000-0000-0000-0000-000000000001') <> '00000000-0000-0000-0000-000000000002'
    or exists (select 1 from public.workspace_members where workspace_id='30000000-0000-0000-0000-000000000001' and user_id='00000000-0000-0000-0000-000000000003')
    or not exists (select 1 from public.project_members where project_id='31000000-0000-0000-0000-000000000001' and user_id='00000000-0000-0000-0000-000000000002') then
    raise exception 'atomic workspace transfer rollback failed';
  end if;
end $$;
drop trigger verify_reject_transfer_member on public.project_members;
drop function public.verify_reject_transfer_member();

-- Treat the first success response as lost, then replay the exact event and plan.
select public.admin_transfer_workspace_projects_atomic(
 '32000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000001',
 array['31000000-0000-0000-0000-000000000001']::uuid[],
 '00000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000003',
 '00000000-0000-0000-0000-000000000001');
do $$ begin
  begin
    perform public.admin_recover_account_mutation(
      '00000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000001',
      '32000000-0000-0000-0000-000000000001','abort_pre_provider_suspension');
    raise exception 'expected committed suspension transfer abort rejection';
  exception when others then
    if sqlerrm='expected committed suspension transfer abort rejection' then raise; end if;
    if sqlerrm not like '%WORKSPACE_TRANSFER_ALREADY_COMMITTED%' then raise; end if;
  end;
end $$;
select public.admin_prepare_user_suspension_atomic(
 '00000000-0000-0000-0000-000000000003','00000000-0000-0000-0000-000000000001',
 '32000000-0000-0000-0000-000000000003','{"reason":"recipient changed after committed transfer"}'::jsonb);
select public.admin_transfer_workspace_projects_atomic(
 '32000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000001',
 array['31000000-0000-0000-0000-000000000001']::uuid[],
 '00000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000003',
 '00000000-0000-0000-0000-000000000001');
select public.admin_recover_account_mutation(
 '00000000-0000-0000-0000-000000000003','00000000-0000-0000-0000-000000000001',
 '32000000-0000-0000-0000-000000000003','abort_pre_provider_suspension');
do $$ begin
  if (select count(*) from public.admin_workspace_transfer_plans where event_id='32000000-0000-0000-0000-000000000001') <> 1
    or (select user_id from public.projects where id='31000000-0000-0000-0000-000000000001') <> '00000000-0000-0000-0000-000000000003'
    or not exists (select 1 from public.project_members where project_id='31000000-0000-0000-0000-000000000001' and user_id='00000000-0000-0000-0000-000000000003' and role='owner')
    or exists (select 1 from public.project_members where project_id='31000000-0000-0000-0000-000000000001' and user_id='00000000-0000-0000-0000-000000000002')
    or (select user_id from public.projects where id='31000000-0000-0000-0000-000000000002') <> '00000000-0000-0000-0000-000000000002'
    or (select user_id from public.projects where id='31000000-0000-0000-0000-000000000003') <> '00000000-0000-0000-0000-000000000001' then
    raise exception 'workspace transfer response-loss or scope invariant failed';
  end if;
end $$;

select public.admin_mark_suspension_projects_transferred(
 '00000000-0000-0000-0000-000000000002','32000000-0000-0000-0000-000000000001',
 '{"transferredProjectCount":1}'::jsonb);
select public.admin_mark_suspension_provider_revoking(
 '00000000-0000-0000-0000-000000000002','32000000-0000-0000-0000-000000000001');
select public.admin_mark_suspension_provider_revoked(
 '00000000-0000-0000-0000-000000000002','32000000-0000-0000-0000-000000000001');
select public.admin_suspend_user_atomic(
 '00000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000001',
 '32000000-0000-0000-0000-000000000001');

select public.admin_prepare_user_archive_atomic(
 '00000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000001',
 '32100000-0000-0000-0000-000000000001','{"reason":"archive transfer response loss"}'::jsonb);
select public.admin_transfer_workspace_projects_atomic(
 '32100000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000001',
 array['31000000-0000-0000-0000-000000000004']::uuid[],
 '00000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000003',
 '00000000-0000-0000-0000-000000000001');
do $$ begin
  begin
    perform public.admin_recover_account_mutation(
      '00000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000001',
      '32100000-0000-0000-0000-000000000001','abort_pre_provider_archive');
    raise exception 'expected committed archive transfer abort rejection';
  exception when others then
    if sqlerrm='expected committed archive transfer abort rejection' then raise; end if;
    if sqlerrm not like '%WORKSPACE_TRANSFER_ALREADY_COMMITTED%' then raise; end if;
  end;
end $$;
select public.admin_transfer_workspace_projects_atomic(
 '32100000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000001',
 array['31000000-0000-0000-0000-000000000004']::uuid[],
 '00000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000003',
 '00000000-0000-0000-0000-000000000001');
select public.admin_mark_archive_provider_revoking(
 '00000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000001','32100000-0000-0000-0000-000000000001');
select public.admin_mark_archive_provider_revoked(
 '00000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000001','32100000-0000-0000-0000-000000000001');
select public.admin_mark_archive_projects_transferred(
 '00000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000001','32100000-0000-0000-0000-000000000001',
 '{"transferredProjectCount":1}'::jsonb);
select public.admin_archive_user_atomic(
 '00000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000001',now(),
 '32100000-0000-0000-0000-000000000001','{"reason":"archive transfer response loss"}'::jsonb);
SQL
echo "PASS atomic workspace transfer rollback, response loss, abort fencing, and scope isolation"

"${PSQL[@]}" <<'SQL'
-- restore epoch: restore -> activate -> suspend -> restore must reject.
update public.users set status='deleted',deleted_at=now(),deleted_by='00000000-0000-0000-0000-000000000001' where id='00000000-0000-0000-0000-000000000002';
select public.admin_restore_user_atomic(
 '00000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000001',
 '20000000-0000-0000-0000-000000000001','{"reason":"restore","requestId":"epoch-restore"}'::jsonb);
select public.admin_update_user_status_atomic(
 '00000000-0000-0000-0000-000000000002','active',null,null,
 '00000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000002',
 '{"requestId":"epoch-activate"}'::jsonb);
select public.admin_update_user_status_atomic(
 '00000000-0000-0000-0000-000000000002','active',null,null,
 '00000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000005',
 '{"requestId":"epoch-activate-retry"}'::jsonb);
do $$ begin
  if (select count(*) from public.admin_operation_logs where target_user_id='00000000-0000-0000-0000-000000000002' and action='admin.user.status.update' and metadata->>'afterStatus'='active') <> 1 then
    raise exception 'activation response loss retry duplicated audit';
  end if;
end $$;
select public.admin_prepare_user_suspension_atomic(
 '00000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000001',
 '20000000-0000-0000-0000-000000000003','{"reason":"suspend","requestId":"epoch-suspend"}'::jsonb);
select public.admin_mark_suspension_projects_transferred('00000000-0000-0000-0000-000000000002','20000000-0000-0000-0000-000000000003','{}');
select public.admin_mark_suspension_provider_revoking('00000000-0000-0000-0000-000000000002','20000000-0000-0000-0000-000000000003');
select public.admin_mark_suspension_provider_revoked('00000000-0000-0000-0000-000000000002','20000000-0000-0000-0000-000000000003');
select public.admin_suspend_user_atomic('00000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000003');
do $$ begin
  if public.admin_prepare_user_suspension_atomic(
    '00000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000001',
    '20000000-0000-0000-0000-000000000006','{"reason":"suspend retry"}'::jsonb) <> 'completed' then
    raise exception 'suspension response loss retry did not converge';
  end if;
  if (select count(*) from public.admin_operation_logs where target_user_id='00000000-0000-0000-0000-000000000002' and action='admin.user.status.update' and metadata->>'afterStatus'='suspended' and metadata->>'requestId'='epoch-suspend') <> 1 then
    raise exception 'suspension response loss retry duplicated audit';
  end if;
  begin
    perform public.admin_restore_user_atomic(
      '00000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000001',
      '20000000-0000-0000-0000-000000000004','{}');
    raise exception 'restore epoch accepted stale restore';
  exception when others then
    if sqlerrm not like '%ACCOUNT_NOT_ARCHIVED%' then raise; end if;
  end;
  if (select status from public.users where id='00000000-0000-0000-0000-000000000002') <> 'suspended' then
    raise exception 'suspension saga final state mismatch';
  end if;
end $$;

-- A different super_admin may resume while the original initiator remains authoritative.
select public.admin_prepare_user_archive_atomic(
  '00000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000001',
  '20000000-0000-0000-0000-000000000007','{"reason":"archive resume","requestId":"resume-1"}'::jsonb);
select public.admin_prepare_user_archive_atomic(
  '00000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000003',
  '20000000-0000-0000-0000-000000000008','{"reason":"archive resume","requestId":"resume-2"}'::jsonb);
do $$ begin
  if (select archive_operator_user_id from public.users where id='00000000-0000-0000-0000-000000000002') <> '00000000-0000-0000-0000-000000000001' then
    raise exception 'archive initiator was overwritten';
  end if;
  if not exists (select 1 from public.admin_operation_logs where target_user_id='00000000-0000-0000-0000-000000000002' and operator_user_id='00000000-0000-0000-0000-000000000003' and action='admin.user.archive.resume') then
    raise exception 'archive resumer audit missing';
  end if;
end $$;
select public.admin_recover_account_mutation(
  '00000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000001',
  '20000000-0000-0000-0000-000000000008','abort_pre_provider_archive');
SQL
echo "PASS restore epoch, response loss, suspension saga, and resumer audit"

"${PSQL[@]}" <<'SQL'
insert into public.users(id,email,status,deleted_at,archive_event_id) values
 ('00000000-0000-0000-0000-000000000010','transfer-source@example.com','active',null,null),
 ('00000000-0000-0000-0000-000000000011','transfer-recipient@example.com','active',null,null),
 ('00000000-0000-0000-0000-000000000012','transfer-suspended@example.com','suspended',null,null),
 ('00000000-0000-0000-0000-000000000013','transfer-archiving@example.com','archiving',null,'33100000-0000-0000-0000-000000000013'),
 ('00000000-0000-0000-0000-000000000014','transfer-deleted@example.com','deleted',now(),null),
 ('00000000-0000-0000-0000-000000000015','transfer-inactive-source@example.com','active',null,null);
insert into public.workspaces(id,slug,name,kind,created_by) values
 ('33000000-0000-0000-0000-000000000001','transfer-eligibility','Transfer Eligibility','team','00000000-0000-0000-0000-000000000011');
insert into public.projects(id,user_id,name,workspace_id,access_mode) values
 ('33000000-0000-0000-0000-000000000011','00000000-0000-0000-0000-000000000010','eligibility-source','33000000-0000-0000-0000-000000000001','team'),
 ('33000000-0000-0000-0000-000000000012','00000000-0000-0000-0000-000000000015','inactive-source','33000000-0000-0000-0000-000000000001','team');
select public.admin_prepare_user_suspension_atomic(
 '00000000-0000-0000-0000-000000000010','00000000-0000-0000-0000-000000000001',
 '33000000-0000-0000-0000-000000000010','{"reason":"eligibility checks"}'::jsonb);
do $$
declare recipient uuid;
begin
  foreach recipient in array array[
    '00000000-0000-0000-0000-000000000012'::uuid,
    '00000000-0000-0000-0000-000000000013'::uuid,
    '00000000-0000-0000-0000-000000000014'::uuid
  ] loop
    begin
      perform public.admin_transfer_workspace_projects_atomic(
        '33000000-0000-0000-0000-000000000010','33000000-0000-0000-0000-000000000001',
        array['33000000-0000-0000-0000-000000000011']::uuid[],
        '00000000-0000-0000-0000-000000000010',recipient,'00000000-0000-0000-0000-000000000001');
      raise exception 'expected ineligible recipient rejection';
    exception when others then
      if sqlerrm='expected ineligible recipient rejection' then raise; end if;
      if sqlerrm not like '%WORKSPACE_TRANSFER_RECIPIENT_INELIGIBLE%' then raise; end if;
    end;
  end loop;
  begin
    perform public.admin_transfer_workspace_projects_atomic(
      '33000000-0000-0000-0000-000000000099','33000000-0000-0000-0000-000000000001',
      array['33000000-0000-0000-0000-000000000011']::uuid[],
      '00000000-0000-0000-0000-000000000010','00000000-0000-0000-0000-000000000011',
      '00000000-0000-0000-0000-000000000001');
    raise exception 'expected transfer event mismatch rejection';
  exception when others then
    if sqlerrm='expected transfer event mismatch rejection' then raise; end if;
    if sqlerrm not like '%WORKSPACE_TRANSFER_EVENT_MISMATCH%' then raise; end if;
  end;
  begin
    perform public.admin_transfer_workspace_projects_atomic(
      '33000000-0000-0000-0000-000000000015','33000000-0000-0000-0000-000000000001',
      array['33000000-0000-0000-0000-000000000012']::uuid[],
      '00000000-0000-0000-0000-000000000015','00000000-0000-0000-0000-000000000011',
      '00000000-0000-0000-0000-000000000001');
    raise exception 'expected inactive source lifecycle rejection';
  exception when others then
    if sqlerrm='expected inactive source lifecycle rejection' then raise; end if;
    if sqlerrm not like '%WORKSPACE_TRANSFER_SOURCE_LIFECYCLE_INVALID%' then raise; end if;
  end;
end $$;
SQL
echo "PASS workspace transfer event binding and recipient eligibility negatives"

# Recipient lifecycle wins the row lock before transfer. The waiting transfer must
# inspect the committed post-lock status and reject rather than transfer ownership.
"${PSQL[@]}" >"$WORK_DIR/transfer-recipient-session-1.log" 2>&1 <<'SQL' &
begin;
select public.admin_prepare_user_suspension_atomic(
 '00000000-0000-0000-0000-000000000011','00000000-0000-0000-0000-000000000001',
 '33000000-0000-0000-0000-000000000011','{"reason":"recipient race"}'::jsonb);
select pg_sleep(1);
commit;
SQL
transfer_recipient_pid=$!
sleep 0.2
if "${PSQL[@]}" -c "select public.admin_transfer_workspace_projects_atomic('33000000-0000-0000-0000-000000000010','33000000-0000-0000-0000-000000000001',array['33000000-0000-0000-0000-000000000011']::uuid[],'00000000-0000-0000-0000-000000000010','00000000-0000-0000-0000-000000000011','00000000-0000-0000-0000-000000000001');" >"$WORK_DIR/transfer-recipient-session-2.log" 2>&1; then
  echo "recipient lifecycle race transfer unexpectedly succeeded" >&2; exit 1
fi
wait "$transfer_recipient_pid"
grep -q 'WORKSPACE_TRANSFER_RECIPIENT_INELIGIBLE' "$WORK_DIR/transfer-recipient-session-2.log"
echo "PASS recipient lifecycle race rejects transfer after lock wait"

"${PSQL[@]}" <<'SQL'
insert into public.users(id,email,status) values
 ('00000000-0000-0000-0000-000000000020','cascade-source-suspension@example.com','active'),
 ('00000000-0000-0000-0000-000000000021','cascade-recipient-suspension@example.com','active'),
 ('00000000-0000-0000-0000-000000000022','cascade-source-archive@example.com','active'),
 ('00000000-0000-0000-0000-000000000023','cascade-recipient-archive@example.com','active');
insert into public.workspaces(id,slug,name,kind,created_by) values
 ('34000000-0000-0000-0000-000000000001','cascade-project','Cascade Project','team','00000000-0000-0000-0000-000000000021'),
 ('34000000-0000-0000-0000-000000000002','cascade-workspace','Cascade Workspace','team','00000000-0000-0000-0000-000000000023');
insert into public.projects(id,user_id,name,workspace_id,access_mode) values
 ('34100000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000020','delete-project-after-transfer','34000000-0000-0000-0000-000000000001','team'),
 ('34100000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000022','delete-workspace-after-transfer','34000000-0000-0000-0000-000000000002','team');

select public.admin_prepare_user_suspension_atomic(
 '00000000-0000-0000-0000-000000000020','00000000-0000-0000-0000-000000000001',
 '34200000-0000-0000-0000-000000000020','{"reason":"project deleted after transfer"}'::jsonb);
select public.admin_transfer_workspace_projects_atomic(
 '34200000-0000-0000-0000-000000000020','34000000-0000-0000-0000-000000000001',
 array['34100000-0000-0000-0000-000000000001']::uuid[],
 '00000000-0000-0000-0000-000000000020','00000000-0000-0000-0000-000000000021',
 '00000000-0000-0000-0000-000000000001');
delete from public.projects where id='34100000-0000-0000-0000-000000000001';
do $$ begin
  if exists (select 1 from public.admin_workspace_transfer_plans where event_id='34200000-0000-0000-0000-000000000020')
    or not exists (select 1 from public.admin_workspace_transfer_events where event_id='34200000-0000-0000-0000-000000000020' and from_user_id='00000000-0000-0000-0000-000000000020') then
    raise exception 'project cascade did not preserve event evidence';
  end if;
  begin
    perform public.admin_recover_account_mutation(
      '00000000-0000-0000-0000-000000000020','00000000-0000-0000-0000-000000000001',
      '34200000-0000-0000-0000-000000000020','abort_pre_provider_suspension');
    raise exception 'expected project-cascade suspension abort rejection';
  exception when others then
    if sqlerrm='expected project-cascade suspension abort rejection' then raise; end if;
    if sqlerrm not like '%WORKSPACE_TRANSFER_ALREADY_COMMITTED%' then raise; end if;
  end;
  begin
    delete from public.admin_workspace_transfer_events where event_id='34200000-0000-0000-0000-000000000020';
    raise exception 'expected immutable event evidence rejection';
  exception when others then
    if sqlerrm='expected immutable event evidence rejection' then raise; end if;
    if sqlerrm not like '%WORKSPACE_TRANSFER_EVENT_IMMUTABLE%' then raise; end if;
  end;
end $$;
select public.admin_prepare_user_suspension_atomic(
 '00000000-0000-0000-0000-000000000020','00000000-0000-0000-0000-000000000001',
 '34300000-0000-0000-0000-000000000020','{"reason":"resume after project delete"}'::jsonb);
select public.admin_mark_suspension_projects_transferred(
 '00000000-0000-0000-0000-000000000020','34300000-0000-0000-0000-000000000020','{"resourceDeleted":true}'::jsonb);
select public.admin_mark_suspension_provider_revoking('00000000-0000-0000-0000-000000000020','34300000-0000-0000-0000-000000000020');
select public.admin_mark_suspension_provider_revoked('00000000-0000-0000-0000-000000000020','34300000-0000-0000-0000-000000000020');
select public.admin_suspend_user_atomic(
 '00000000-0000-0000-0000-000000000020','00000000-0000-0000-0000-000000000001','34300000-0000-0000-0000-000000000020');

select public.admin_prepare_user_archive_atomic(
 '00000000-0000-0000-0000-000000000022','00000000-0000-0000-0000-000000000001',
 '34200000-0000-0000-0000-000000000022','{"reason":"workspace deleted after transfer"}'::jsonb);
select public.admin_transfer_workspace_projects_atomic(
 '34200000-0000-0000-0000-000000000022','34000000-0000-0000-0000-000000000002',
 array['34100000-0000-0000-0000-000000000002']::uuid[],
 '00000000-0000-0000-0000-000000000022','00000000-0000-0000-0000-000000000023',
 '00000000-0000-0000-0000-000000000001');
delete from public.workspaces where id='34000000-0000-0000-0000-000000000002';
do $$ begin
  if exists (select 1 from public.admin_workspace_transfer_plans where event_id='34200000-0000-0000-0000-000000000022')
    or not exists (select 1 from public.admin_workspace_transfer_events where event_id='34200000-0000-0000-0000-000000000022' and from_user_id='00000000-0000-0000-0000-000000000022') then
    raise exception 'workspace cascade did not preserve event evidence';
  end if;
  begin
    perform public.admin_recover_account_mutation(
      '00000000-0000-0000-0000-000000000022','00000000-0000-0000-0000-000000000001',
      '34200000-0000-0000-0000-000000000022','abort_pre_provider_archive');
    raise exception 'expected workspace-cascade archive abort rejection';
  exception when others then
    if sqlerrm='expected workspace-cascade archive abort rejection' then raise; end if;
    if sqlerrm not like '%WORKSPACE_TRANSFER_ALREADY_COMMITTED%' then raise; end if;
  end;
end $$;
select public.admin_prepare_user_archive_atomic(
 '00000000-0000-0000-0000-000000000022','00000000-0000-0000-0000-000000000001',
 '34300000-0000-0000-0000-000000000022','{"reason":"resume after workspace delete"}'::jsonb);
select public.admin_mark_archive_provider_revoking(
 '00000000-0000-0000-0000-000000000022','00000000-0000-0000-0000-000000000001','34300000-0000-0000-0000-000000000022');
select public.admin_mark_archive_provider_revoked(
 '00000000-0000-0000-0000-000000000022','00000000-0000-0000-0000-000000000001','34300000-0000-0000-0000-000000000022');
select public.admin_mark_archive_projects_transferred(
 '00000000-0000-0000-0000-000000000022','00000000-0000-0000-0000-000000000001','34300000-0000-0000-0000-000000000022','{"resourceDeleted":true}'::jsonb);
select public.admin_archive_user_atomic(
 '00000000-0000-0000-0000-000000000022','00000000-0000-0000-0000-000000000001',now(),
 '34300000-0000-0000-0000-000000000022','{"reason":"resume after workspace delete"}'::jsonb);
do $$ begin
  if (select status from public.users where id='00000000-0000-0000-0000-000000000020') <> 'suspended'
    or (select status from public.users where id='00000000-0000-0000-0000-000000000022') <> 'deleted' then
    raise exception 'resource deletion lifecycle retries did not finalize';
  end if;
end $$;
SQL
echo "PASS durable transfer event evidence survives project and workspace cascades"

"${PSQL[@]}" <<'SQL'
insert into public.users(id,email,status) values
 ('00000000-0000-0000-0000-000000000030','project-first-source@example.com','active'),
 ('00000000-0000-0000-0000-000000000031','project-first-recipient@example.com','active'),
 ('00000000-0000-0000-0000-000000000032','lifecycle-first-source@example.com','active'),
 ('00000000-0000-0000-0000-000000000033','active-project-owner-a@example.com','active'),
 ('00000000-0000-0000-0000-000000000034','active-project-owner-b@example.com','active'),
 ('00000000-0000-0000-0000-000000000035','assign-back-source@example.com','active'),
 ('00000000-0000-0000-0000-000000000036','assign-back-recipient@example.com','active'),
 ('00000000-0000-0000-0000-000000000037','create-after-prepare@example.com','active');
insert into public.workspaces(id,slug,name,kind,created_by) values
 ('35000000-0000-0000-0000-000000000001','project-first-race','Project First Race','team','00000000-0000-0000-0000-000000000031'),
 ('35000000-0000-0000-0000-000000000002','lifecycle-first-race','Lifecycle First Race','team','00000000-0000-0000-0000-000000000031'),
 ('35000000-0000-0000-0000-000000000003','assign-back-race','Assign Back Race','team','00000000-0000-0000-0000-000000000036'),
 ('35000000-0000-0000-0000-000000000004','active-owner-success','Active Owner Success','team','00000000-0000-0000-0000-000000000034');

-- Ordinary active-owner INSERT and actual owner-changing UPDATE remain valid.
insert into public.projects(id,user_id,name,workspace_id,access_mode) values
 ('35100000-0000-0000-0000-000000000033','00000000-0000-0000-0000-000000000033','active-owner-success','35000000-0000-0000-0000-000000000004','team'),
 ('35100000-0000-0000-0000-000000000035','00000000-0000-0000-0000-000000000035','assign-back-negative','35000000-0000-0000-0000-000000000003','team');
update public.projects set user_id='00000000-0000-0000-0000-000000000034' where id='35100000-0000-0000-0000-000000000033';

select public.admin_prepare_user_suspension_atomic(
 '00000000-0000-0000-0000-000000000035','00000000-0000-0000-0000-000000000001',
 '35200000-0000-0000-0000-000000000035','{"reason":"assign back negative"}'::jsonb);
select public.admin_transfer_workspace_projects_atomic(
 '35200000-0000-0000-0000-000000000035','35000000-0000-0000-0000-000000000003',
 array['35100000-0000-0000-0000-000000000035']::uuid[],
 '00000000-0000-0000-0000-000000000035','00000000-0000-0000-0000-000000000036',
 '00000000-0000-0000-0000-000000000001');
do $$ begin
  begin
    update public.projects set user_id='00000000-0000-0000-0000-000000000035' where id='35100000-0000-0000-0000-000000000035';
    raise exception 'expected assign-back owner rejection';
  exception when others then
    if sqlerrm='expected assign-back owner rejection' then raise; end if;
    if sqlerrm not like '%PROJECT_OWNER_INELIGIBLE%' then raise; end if;
  end;
end $$;

select public.admin_prepare_user_suspension_atomic(
 '00000000-0000-0000-0000-000000000037','00000000-0000-0000-0000-000000000001',
 '35200000-0000-0000-0000-000000000037','{"reason":"create after prepare negative"}'::jsonb);
do $$ begin
  begin
    insert into public.projects(id,user_id,name,workspace_id,access_mode) values
      ('35100000-0000-0000-0000-000000000037','00000000-0000-0000-0000-000000000037','create-after-prepare','35000000-0000-0000-0000-000000000002','team');
    raise exception 'expected create-after-prepare owner rejection';
  exception when others then
    if sqlerrm='expected create-after-prepare owner rejection' then raise; end if;
    if sqlerrm not like '%PROJECT_OWNER_INELIGIBLE%' then raise; end if;
  end;
end $$;
SQL
echo "PASS project owner trigger active success and transient-owner negatives"

"${PSQL[@]}" <<'SQL'
insert into public.users(id,email,status) values
 ('00000000-0000-0000-0000-000000000038','membership-flow-owner-a@example.com','active'),
 ('00000000-0000-0000-0000-000000000039','membership-flow-owner-b@example.com','active'),
 ('00000000-0000-0000-0000-000000000040','membership-flow-editor@example.com','active'),
 ('00000000-0000-0000-0000-000000000041','membership-gap-source@example.com','active'),
 ('00000000-0000-0000-0000-000000000042','membership-gap-intermediate@example.com','active'),
 ('00000000-0000-0000-0000-000000000043','membership-gap-recipient@example.com','active'),
 ('00000000-0000-0000-0000-000000000044','membership-lifecycle-current@example.com','active'),
 ('00000000-0000-0000-0000-000000000045','membership-lifecycle-target@example.com','active');
insert into public.workspaces(id,slug,name,kind,created_by) values
 ('35000000-0000-0000-0000-000000000005','membership-flows','Membership Flows','team','00000000-0000-0000-0000-000000000039'),
 ('35000000-0000-0000-0000-000000000006','membership-gap','Membership Gap','team','00000000-0000-0000-0000-000000000043'),
 ('35000000-0000-0000-0000-000000000007','membership-lifecycle-first','Membership Lifecycle First','team','00000000-0000-0000-0000-000000000044');

-- Team create/copy paths synthesize one owner row. Personal create does not.
insert into public.projects(id,user_id,name,workspace_id,access_mode) values
 ('35100000-0000-0000-0000-000000000038','00000000-0000-0000-0000-000000000038','create-flow','35000000-0000-0000-0000-000000000005','team'),
 ('35100000-0000-0000-0000-000000000039','00000000-0000-0000-0000-000000000038','copy-flow','35000000-0000-0000-0000-000000000005','team'),
 ('35100000-0000-0000-0000-000000000040','00000000-0000-0000-0000-000000000038','personal-flow',null,'private'),
 ('35100000-0000-0000-0000-000000000041','00000000-0000-0000-0000-000000000041','former-app-gap','35000000-0000-0000-0000-000000000006','team'),
 ('35100000-0000-0000-0000-000000000044','00000000-0000-0000-0000-000000000044','lifecycle-first-membership','35000000-0000-0000-0000-000000000007','team');
insert into public.project_members(project_id,user_id,role,granted_by) values
 ('35100000-0000-0000-0000-000000000038','00000000-0000-0000-0000-000000000040','editor','00000000-0000-0000-0000-000000000038'),
 ('35100000-0000-0000-0000-000000000040','00000000-0000-0000-0000-000000000040','editor','00000000-0000-0000-0000-000000000038'),
 ('35100000-0000-0000-0000-000000000041','00000000-0000-0000-0000-000000000040','editor','00000000-0000-0000-0000-000000000041'),
 ('35100000-0000-0000-0000-000000000044','00000000-0000-0000-0000-000000000040','editor','00000000-0000-0000-0000-000000000044');

-- Permission and workspace-leave owner changes rely only on projects.user_id.
update public.projects set user_id='00000000-0000-0000-0000-000000000039' where id='35100000-0000-0000-0000-000000000038';
update public.projects set user_id='00000000-0000-0000-0000-000000000039' where id='35100000-0000-0000-0000-000000000039';
do $$ begin
  if exists (
    select 1 from public.projects p
    where p.id in ('35100000-0000-0000-0000-000000000038','35100000-0000-0000-0000-000000000039')
      and (
        (select count(*) from public.project_members pm where pm.project_id=p.id and pm.role='owner') <> 1
        or not exists (select 1 from public.project_members pm where pm.project_id=p.id and pm.user_id=p.user_id and pm.role='owner')
      )
  ) then raise exception 'create/copy/permission/workspace-leave owner membership mismatch'; end if;
  if not exists (
    select 1 from public.project_members
    where project_id='35100000-0000-0000-0000-000000000038'
      and user_id='00000000-0000-0000-0000-000000000040' and role='editor'
  ) then raise exception 'unrelated editor was removed'; end if;
  if exists (
    select 1 from public.project_members
    where project_id='35100000-0000-0000-0000-000000000040' and role='owner'
  ) then raise exception 'personal project gained owner membership'; end if;
end $$;

do $$ begin
  begin
    insert into public.project_members(project_id,user_id,role,granted_by) values
      ('35100000-0000-0000-0000-000000000038','00000000-0000-0000-0000-000000000038','owner','00000000-0000-0000-0000-000000000038');
    raise exception 'expected stale owner membership rejection';
  exception when others then
    if sqlerrm='expected stale owner membership rejection' then raise; end if;
    if sqlerrm not like '%PROJECT_OWNER_MEMBERSHIP_MISMATCH%' then raise; end if;
  end;
  begin
    update public.project_members set role='owner'
    where project_id='35100000-0000-0000-0000-000000000038'
      and user_id='00000000-0000-0000-0000-000000000040';
    raise exception 'expected editor promotion mismatch rejection';
  exception when others then
    if sqlerrm='expected editor promotion mismatch rejection' then raise; end if;
    if sqlerrm not like '%PROJECT_OWNER_MEMBERSHIP_MISMATCH%' then raise; end if;
  end;
  begin
    update public.project_members set role='editor'
    where project_id='35100000-0000-0000-0000-000000000038'
      and user_id='00000000-0000-0000-0000-000000000039';
    raise exception 'expected current owner demotion rejection';
  exception when others then
    if sqlerrm='expected current owner demotion rejection' then raise; end if;
    if sqlerrm not like '%PROJECT_OWNER_MEMBERSHIP_MISMATCH%' then raise; end if;
  end;
  begin
    insert into public.project_members(project_id,user_id,role,granted_by) values
      ('35100000-0000-0000-0000-000000000040','00000000-0000-0000-0000-000000000038','owner','00000000-0000-0000-0000-000000000038');
    raise exception 'expected personal owner membership rejection';
  exception when others then
    if sqlerrm='expected personal owner membership rejection' then raise; end if;
    if sqlerrm not like '%PROJECT_OWNER_MEMBERSHIP_MISMATCH%' then raise; end if;
  end;
end $$;
SQL
echo "PASS project owner membership create copy permission leave and integrity invariants"

# Former app boundary: project owner update commits, then pauses before its old
# separate owner-member upsert. Lifecycle transfer wins the gap; the stale write
# must read the new project owner and reject instead of resurrecting an owner.
"${PSQL[@]}" >"$WORK_DIR/project-member-gap-session-1.log" 2>&1 <<'SQL' &
update public.projects set user_id='00000000-0000-0000-0000-000000000042'
where id='35100000-0000-0000-0000-000000000041';
select pg_sleep(1);
insert into public.project_members(project_id,user_id,role,granted_by) values
 ('35100000-0000-0000-0000-000000000041','00000000-0000-0000-0000-000000000042','owner','00000000-0000-0000-0000-000000000041')
on conflict (project_id,user_id) do update set role='owner',granted_by=excluded.granted_by;
SQL
project_member_gap_pid=$!
sleep 0.2
"${PSQL[@]}" <<'SQL' >/dev/null
select public.admin_prepare_user_suspension_atomic(
 '00000000-0000-0000-0000-000000000042','00000000-0000-0000-0000-000000000001',
 '35400000-0000-0000-0000-000000000042','{"reason":"former app membership gap"}'::jsonb);
select public.admin_transfer_workspace_projects_atomic(
 '35400000-0000-0000-0000-000000000042','35000000-0000-0000-0000-000000000006',
 array['35100000-0000-0000-0000-000000000041']::uuid[],
 '00000000-0000-0000-0000-000000000042','00000000-0000-0000-0000-000000000043',
 '00000000-0000-0000-0000-000000000001');
SQL
if wait "$project_member_gap_pid"; then
  echo "stale owner membership upsert unexpectedly succeeded" >&2; exit 1
fi
grep -q 'PROJECT_OWNER_MEMBERSHIP_MISMATCH' "$WORK_DIR/project-member-gap-session-1.log"
"${PSQL[@]}" <<'SQL'
do $$ begin
  if (select user_id from public.projects where id='35100000-0000-0000-0000-000000000041') <> '00000000-0000-0000-0000-000000000043'
    or (select count(*) from public.project_members where project_id='35100000-0000-0000-0000-000000000041' and role='owner') <> 1
    or not exists (select 1 from public.project_members where project_id='35100000-0000-0000-0000-000000000041' and user_id='00000000-0000-0000-0000-000000000043' and role='owner')
    or exists (select 1 from public.project_members where project_id='35100000-0000-0000-0000-000000000041' and user_id in ('00000000-0000-0000-0000-000000000041','00000000-0000-0000-0000-000000000042') and role='owner')
    or not exists (select 1 from public.project_members where project_id='35100000-0000-0000-0000-000000000041' and user_id='00000000-0000-0000-0000-000000000040' and role='editor') then
    raise exception 'project-first membership gap invariant failed';
  end if;
end $$;
SQL
echo "PASS project-first stale owner membership write rejects after lifecycle transfer"

# Lifecycle prepare obtains the prospective owner lock first. The later project
# owner update waits, rejects, and leaves both the current owner and editor rows.
"${PSQL[@]}" >"$WORK_DIR/project-member-lifecycle-session-1.log" 2>&1 <<'SQL' &
begin;
select public.admin_prepare_user_suspension_atomic(
 '00000000-0000-0000-0000-000000000045','00000000-0000-0000-0000-000000000001',
 '35400000-0000-0000-0000-000000000045','{"reason":"membership lifecycle first"}'::jsonb);
select pg_sleep(1);
commit;
SQL
project_member_lifecycle_pid=$!
sleep 0.2
if "${PSQL[@]}" -c "update public.projects set user_id='00000000-0000-0000-0000-000000000045' where id='35100000-0000-0000-0000-000000000044';" >"$WORK_DIR/project-member-lifecycle-session-2.log" 2>&1; then
  echo "lifecycle-first membership owner update unexpectedly succeeded" >&2; exit 1
fi
wait "$project_member_lifecycle_pid"
grep -q 'PROJECT_OWNER_INELIGIBLE' "$WORK_DIR/project-member-lifecycle-session-2.log"
"${PSQL[@]}" <<'SQL'
do $$ begin
  if (select user_id from public.projects where id='35100000-0000-0000-0000-000000000044') <> '00000000-0000-0000-0000-000000000044'
    or (select count(*) from public.project_members where project_id='35100000-0000-0000-0000-000000000044' and role='owner') <> 1
    or not exists (select 1 from public.project_members where project_id='35100000-0000-0000-0000-000000000044' and user_id='00000000-0000-0000-0000-000000000044' and role='owner')
    or not exists (select 1 from public.project_members where project_id='35100000-0000-0000-0000-000000000044' and user_id='00000000-0000-0000-0000-000000000040' and role='editor') then
    raise exception 'lifecycle-first membership invariant failed';
  end if;
end $$;
SQL
echo "PASS lifecycle-first project owner rejection preserves membership invariants"

# Project ownership write gets the user lock first. Lifecycle prepare must wait,
# so the committed project is visible to the transfer snapshot.
"${PSQL[@]}" >"$WORK_DIR/project-owner-session-1.log" 2>&1 <<'SQL' &
begin;
insert into public.projects(id,user_id,name,workspace_id,access_mode) values
 ('35100000-0000-0000-0000-000000000030','00000000-0000-0000-0000-000000000030','project-first-race','35000000-0000-0000-0000-000000000001','team');
select pg_sleep(1);
do $$ begin
  if (select status from public.users where id='00000000-0000-0000-0000-000000000030') <> 'active' then
    raise exception 'PROJECT_WRITE_DID_NOT_SERIALIZE';
  end if;
end $$;
commit;
SQL
project_owner_pid=$!
sleep 0.2
"${PSQL[@]}" -c "select public.admin_prepare_user_suspension_atomic('00000000-0000-0000-0000-000000000030','00000000-0000-0000-0000-000000000001','35300000-0000-0000-0000-000000000030','{\"reason\":\"project first race\"}');" >"$WORK_DIR/project-owner-session-2.log" 2>&1
wait "$project_owner_pid"
"${PSQL[@]}" -c "select public.admin_transfer_workspace_projects_atomic('35300000-0000-0000-0000-000000000030','35000000-0000-0000-0000-000000000001',array['35100000-0000-0000-0000-000000000030']::uuid[],'00000000-0000-0000-0000-000000000030','00000000-0000-0000-0000-000000000031','00000000-0000-0000-0000-000000000001');" >/dev/null
echo "PASS project-write-first race serializes lifecycle prepare and transfer snapshot"

# Lifecycle prepare gets the same user lock first. A later project INSERT waits,
# reads the committed transient state, and fails with the stable DB error.
"${PSQL[@]}" >"$WORK_DIR/project-lifecycle-session-1.log" 2>&1 <<'SQL' &
begin;
select public.admin_prepare_user_suspension_atomic(
 '00000000-0000-0000-0000-000000000032','00000000-0000-0000-0000-000000000001',
 '35300000-0000-0000-0000-000000000032','{"reason":"lifecycle first race"}'::jsonb);
select pg_sleep(1);
commit;
SQL
project_lifecycle_pid=$!
sleep 0.2
if "${PSQL[@]}" -c "insert into public.projects(id,user_id,name,workspace_id,access_mode) values ('35100000-0000-0000-0000-000000000032','00000000-0000-0000-0000-000000000032','lifecycle-first-race','35000000-0000-0000-0000-000000000002','team');" >"$WORK_DIR/project-lifecycle-session-2.log" 2>&1; then
  echo "lifecycle-first project insert unexpectedly succeeded" >&2; exit 1
fi
wait "$project_lifecycle_pid"
grep -q 'PROJECT_OWNER_INELIGIBLE' "$WORK_DIR/project-lifecycle-session-2.log"
echo "PASS lifecycle-first race rejects later project ownership write"

"${PSQL[@]}" <<'SQL'
-- Live per-row state proof for all-credential reconciliation after partial success.
insert into public.user_service_credentials(id,user_id,internal_name,provider_api_name,status,last_error) values
 ('40000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000002','verify-active','verify-active','active',null),
 ('40000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000002','verify-error','verify-error','disabled','uncertain provider response'),
 ('40000000-0000-0000-0000-000000000003','00000000-0000-0000-0000-000000000002','verify-clean','verify-clean','disabled',null);
update public.user_service_credentials set status='disabled',disabled_at=now(),last_error=null where id='40000000-0000-0000-0000-000000000001';
do $$ begin
  if (select count(*) from public.user_service_credentials where user_id='00000000-0000-0000-0000-000000000002' and btrim(provider_api_name)<>'' and (status<>'disabled' or btrim(coalesce(last_error,''))<>'')) <> 1 then
    raise exception 'partial credential reconciliation state mismatch';
  end if;
end $$;
update public.user_service_credentials set disabled_at=now(),last_error=null where id='40000000-0000-0000-0000-000000000002';
do $$ begin
  if exists (select 1 from public.user_service_credentials where user_id='00000000-0000-0000-0000-000000000002' and btrim(provider_api_name)<>'' and (status<>'disabled' or btrim(coalesce(last_error,''))<>'')) then
    raise exception 'all-credential reconciliation did not converge';
  end if;
end $$;
SQL
echo "PASS all-credential reconciliation durable row state"

# Real two-session role concurrency: A removes B while B concurrently tries to
# remove A. Session 2 must wait for the shared role-row lock and then reject.
"${PSQL[@]}" <<'SQL'
delete from public.user_roles where user_id in ('00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000003');
insert into public.user_roles(user_id,role_id)
select u.id,r.id from public.users u cross join public.roles r
where u.id=any(array['00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000003']::uuid[]) and r.code='super_admin';
update public.users set status='active',deleted_at=null,deleted_by=null where id in ('00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000003');
SQL
"${PSQL[@]}" >"$WORK_DIR/role-session-1.log" 2>&1 <<'SQL' &
begin;
select public.admin_replace_user_roles_atomic('00000000-0000-0000-0000-000000000003',array['user'],'00000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000001','{}');
select pg_sleep(1);
commit;
SQL
role_pid=$!
sleep 0.2
if "${PSQL[@]}" -c "select public.admin_replace_user_roles_atomic('00000000-0000-0000-0000-000000000001',array['user'],'00000000-0000-0000-0000-000000000003','30000000-0000-0000-0000-000000000002','{}');" >"$WORK_DIR/role-session-2.log" 2>&1; then
  echo "role concurrency unexpectedly succeeded" >&2; exit 1
fi
wait "$role_pid"
grep -Eq 'FORBIDDEN_SUPER_ADMIN_EDIT|LAST_SUPER_ADMIN_REQUIRED' "$WORK_DIR/role-session-2.log"
echo "PASS role concurrency"

# Real two-session status concurrency using the durable suspension prepare RPC.
"${PSQL[@]}" <<'SQL'
delete from public.user_roles where user_id in ('00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000003');
insert into public.user_roles(user_id,role_id)
select u.id,r.id from public.users u cross join public.roles r
where u.id=any(array['00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000003']::uuid[]) and r.code='super_admin';
update public.users set status='active',deleted_at=null,deleted_by=null,
 suspension_previous_status=null,suspension_started_at=null,suspension_token=null,suspension_phase=null,
 suspension_event_id=null,suspension_operator_user_id=null,suspension_audit_metadata=null,suspension_project_transfer=null
where id in ('00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000003');
SQL
"${PSQL[@]}" >"$WORK_DIR/status-session-1.log" 2>&1 <<'SQL' &
begin;
select public.admin_prepare_user_suspension_atomic('00000000-0000-0000-0000-000000000003','00000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000003','{"reason":"concurrency"}');
select pg_sleep(1);
commit;
SQL
status_pid=$!
sleep 0.2
if "${PSQL[@]}" -c "select public.admin_prepare_user_suspension_atomic('00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000003','30000000-0000-0000-0000-000000000004','{\"reason\":\"concurrency\"}');" >"$WORK_DIR/status-session-2.log" 2>&1; then
  echo "status concurrency unexpectedly succeeded" >&2; exit 1
fi
wait "$status_pid"
grep -q 'LAST_SUPER_ADMIN_REQUIRED' "$WORK_DIR/status-session-2.log"
echo "PASS status concurrency"

# Real two-session archive concurrency follows the same shared invariant lock.
"${PSQL[@]}" <<'SQL'
update public.users set status='active',deleted_at=null,deleted_by=null,
 archive_previous_status=null,archive_started_at=null,archive_token=null,archive_phase=null,
 archive_event_id=null,archive_operator_user_id=null,archive_audit_metadata=null,archive_project_transfer=null,
 suspension_previous_status=null,suspension_started_at=null,suspension_token=null,suspension_phase=null,
 suspension_event_id=null,suspension_operator_user_id=null,suspension_audit_metadata=null,suspension_project_transfer=null
where id in ('00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000003');
SQL
"${PSQL[@]}" >"$WORK_DIR/archive-session-1.log" 2>&1 <<'SQL' &
begin;
select public.admin_prepare_user_archive_atomic('00000000-0000-0000-0000-000000000003','00000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000005','{"reason":"concurrency"}');
select pg_sleep(1);
commit;
SQL
archive_pid=$!
sleep 0.2
if "${PSQL[@]}" -c "select public.admin_prepare_user_archive_atomic('00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000003','30000000-0000-0000-0000-000000000006','{\"reason\":\"concurrency\"}');" >"$WORK_DIR/archive-session-2.log" 2>&1; then
  echo "archive concurrency unexpectedly succeeded" >&2; exit 1
fi
wait "$archive_pid"
grep -q 'LAST_SUPER_ADMIN_REQUIRED' "$WORK_DIR/archive-session-2.log"
echo "PASS archive concurrency"
echo "PASS PostgreSQL 16 admin lifecycle verification"
