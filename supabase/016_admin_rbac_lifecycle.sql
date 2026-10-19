insert into public.permissions (code, name, description) values
  ('admin.user.delete', 'Archive user', 'Archive a user without deleting billing or audit history'),
  ('admin.user.restore', 'Restore archived user', 'Restore an archived user to suspended state'),
  ('admin.api_key.read', 'Read API key inventory', 'Read masked upstream credential inventory'),
  ('admin.access.read', 'Read role capabilities', 'Read fixed role and permission mappings')
on conflict (code) do update set
  name = excluded.name,
  description = excluded.description;

-- Converge these high-risk permissions exactly, including databases that
-- accumulated draft or manually-added mappings before this migration.
delete from public.role_permissions rp
using public.roles r, public.permissions p
where rp.role_id = r.id
  and rp.permission_id = p.id
  and p.code in ('admin.user.delete', 'admin.user.restore', 'admin.api_key.read', 'admin.access.read')
  and not (
    (p.code in ('admin.user.delete', 'admin.user.restore') and r.code = 'super_admin')
    or (p.code = 'admin.api_key.read' and r.code in ('super_admin', 'admin', 'ops'))
    or (p.code = 'admin.access.read' and r.code in ('super_admin', 'admin'))
  );

with approved(permission_code, role_code) as (values
  ('admin.user.delete', 'super_admin'),
  ('admin.user.restore', 'super_admin'),
  ('admin.api_key.read', 'super_admin'),
  ('admin.api_key.read', 'admin'),
  ('admin.api_key.read', 'ops'),
  ('admin.access.read', 'super_admin'),
  ('admin.access.read', 'admin')
)
insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from approved a
join public.roles r on r.code = a.role_code
join public.permissions p on p.code = a.permission_code
on conflict (role_id, permission_id) do nothing;

alter table public.users
  add column if not exists archive_previous_status text,
  add column if not exists archive_started_at timestamptz,
  add column if not exists archive_token uuid,
  add column if not exists archive_phase text,
  add column if not exists archive_event_id uuid,
  add column if not exists archive_operator_user_id uuid,
  add column if not exists archive_audit_metadata jsonb,
  add column if not exists archive_project_transfer jsonb,
  add column if not exists restore_event_id uuid,
  add column if not exists restore_operator_user_id uuid,
  add column if not exists restore_audit_metadata jsonb,
  add column if not exists role_event_id uuid,
  add column if not exists role_event_roles text[],
  add column if not exists role_event_operator_user_id uuid,
  add column if not exists role_audit_metadata jsonb,
  add column if not exists status_event_id uuid,
  add column if not exists status_event_status text,
  add column if not exists status_event_operator_user_id uuid,
  add column if not exists status_audit_metadata jsonb,
  add column if not exists suspension_previous_status text,
  add column if not exists suspension_started_at timestamptz,
  add column if not exists suspension_token uuid,
  add column if not exists suspension_phase text,
  add column if not exists suspension_event_id uuid,
  add column if not exists suspension_operator_user_id uuid,
  add column if not exists suspension_audit_metadata jsonb,
  add column if not exists suspension_project_transfer jsonb,
  add column if not exists service_mutation_started_at timestamptz,
  add column if not exists service_mutation_token uuid;

alter table public.admin_operation_logs
  add column if not exists operation_token uuid;
create unique index if not exists idx_admin_operation_logs_action_operation_token
  on public.admin_operation_logs(action, operation_token)
  where operation_token is not null;

create table if not exists public.admin_workspace_transfer_plans (
  event_id uuid not null,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  from_user_id uuid not null references public.users(id) on delete restrict,
  to_user_id uuid not null references public.users(id) on delete restrict,
  operator_user_id uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (event_id, project_id)
);
create index if not exists idx_admin_workspace_transfer_plans_event
  on public.admin_workspace_transfer_plans(event_id, workspace_id);
alter table public.admin_workspace_transfer_plans enable row level security;
revoke all on table public.admin_workspace_transfer_plans from public, anon, authenticated;
grant select on table public.admin_workspace_transfer_plans to service_role;

create table if not exists public.admin_workspace_transfer_events (
  event_id uuid primary key,
  from_user_id uuid not null,
  committed_at timestamptz not null default now()
);
alter table public.admin_workspace_transfer_events enable row level security;
revoke all on table public.admin_workspace_transfer_events from public, anon, authenticated, service_role;
grant select on table public.admin_workspace_transfer_events to service_role;

insert into public.admin_workspace_transfer_events(event_id, from_user_id, committed_at)
select event_id, min(from_user_id::text)::uuid, min(created_at)
from public.admin_workspace_transfer_plans
group by event_id
on conflict (event_id) do nothing;

create or replace function public.admin_reject_workspace_transfer_event_mutation()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  raise exception using errcode = 'P0001', message = 'WORKSPACE_TRANSFER_EVENT_IMMUTABLE';
end;
$$;
drop trigger if exists trg_admin_workspace_transfer_events_immutable on public.admin_workspace_transfer_events;
create trigger trg_admin_workspace_transfer_events_immutable
before update or delete on public.admin_workspace_transfer_events
for each row execute function public.admin_reject_workspace_transfer_event_mutation();
revoke execute on function public.admin_reject_workspace_transfer_event_mutation() from public, anon, authenticated;

create or replace function public.admin_enforce_project_owner_eligibility()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_status text;
  v_deleted_at timestamptz;
  v_archive_token uuid;
  v_archive_phase text;
  v_archive_started_at timestamptz;
  v_suspension_token uuid;
  v_suspension_phase text;
  v_suspension_started_at timestamptz;
begin
  if tg_op = 'UPDATE' and new.user_id is not distinct from old.user_id then
    return new;
  end if;

  select coalesce(status, 'active'), deleted_at,
         archive_token, archive_phase, archive_started_at,
         suspension_token, suspension_phase, suspension_started_at
  into v_status, v_deleted_at,
       v_archive_token, v_archive_phase, v_archive_started_at,
       v_suspension_token, v_suspension_phase, v_suspension_started_at
  from public.users
  where id = new.user_id
  for update;

  if not found
    or v_status <> 'active'
    or v_deleted_at is not null
    or v_archive_token is not null
    or v_archive_phase is not null
    or v_archive_started_at is not null
    or v_suspension_token is not null
    or v_suspension_phase is not null
    or v_suspension_started_at is not null then
    raise exception using errcode = 'P0001', message = 'PROJECT_OWNER_INELIGIBLE';
  end if;
  return new;
end;
$$;
drop trigger if exists trg_projects_owner_eligibility on public.projects;
create trigger trg_projects_owner_eligibility
before insert or update of user_id on public.projects
for each row execute function public.admin_enforce_project_owner_eligibility();
revoke execute on function public.admin_enforce_project_owner_eligibility() from public, anon, authenticated;

create or replace function public.admin_enforce_project_member_owner_integrity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_project_owner_id uuid;
  v_access_mode text;
begin
  select user_id, access_mode
  into v_project_owner_id, v_access_mode
  from public.projects
  where id = new.project_id
  for share;

  if not found then
    if new.role = 'owner' then
      raise exception using errcode = 'P0001', message = 'PROJECT_OWNER_MEMBERSHIP_MISMATCH';
    end if;
    return new;
  end if;
  if new.role = 'owner' and (
    v_access_mode is distinct from 'team'
    or new.user_id is distinct from v_project_owner_id
  ) then
    raise exception using errcode = 'P0001', message = 'PROJECT_OWNER_MEMBERSHIP_MISMATCH';
  end if;
  if v_access_mode = 'team'
    and new.user_id = v_project_owner_id
    and new.role is distinct from 'owner' then
    raise exception using errcode = 'P0001', message = 'PROJECT_OWNER_MEMBERSHIP_MISMATCH';
  end if;
  return new;
end;
$$;
drop trigger if exists trg_project_members_owner_integrity on public.project_members;
create trigger trg_project_members_owner_integrity
before insert or update on public.project_members
for each row execute function public.admin_enforce_project_member_owner_integrity();
revoke execute on function public.admin_enforce_project_member_owner_integrity() from public, anon, authenticated;

-- Converge rows created by older application revisions before making the
-- project row the only owner source of truth for future writes.
delete from public.project_members member
using public.projects project
where member.project_id = project.id
  and member.role = 'owner'
  and (
    project.access_mode is distinct from 'team'
    or member.user_id is distinct from project.user_id
  );

insert into public.project_members(project_id, user_id, role, granted_by)
select id, user_id, 'owner', user_id
from public.projects
where access_mode = 'team'
on conflict (project_id, user_id) do update
set role = 'owner'
where public.project_members.role is distinct from 'owner';

create or replace function public.admin_sync_project_owner_membership()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'UPDATE' and new.user_id is not distinct from old.user_id then
    return new;
  end if;

  delete from public.project_members
  where project_id = new.id
    and role = 'owner'
    and (
      new.access_mode is distinct from 'team'
      or user_id is distinct from new.user_id
    );

  if new.access_mode = 'team' then
    insert into public.project_members(project_id, user_id, role, granted_by)
    values (new.id, new.user_id, 'owner', new.user_id)
    on conflict (project_id, user_id) do update
    set role = 'owner'
    where public.project_members.role is distinct from 'owner';
  end if;
  return new;
end;
$$;
drop trigger if exists trg_projects_sync_owner_membership on public.projects;
create trigger trg_projects_sync_owner_membership
after insert or update of user_id on public.projects
for each row execute function public.admin_sync_project_owner_membership();
revoke execute on function public.admin_sync_project_owner_membership() from public, anon, authenticated;

alter table public.users drop constraint if exists users_status_check;
alter table public.users
  add constraint users_status_check check (status in ('active', 'suspended', 'suspending', 'archiving', 'deleted'));
alter table public.users drop constraint if exists users_archive_phase_check;
alter table public.users
  add constraint users_archive_phase_check check (
    archive_phase is null or archive_phase in ('prepared', 'provider_revoking', 'provider_revoked', 'projects_transferred')
  );
alter table public.users drop constraint if exists users_suspension_phase_check;
alter table public.users
  add constraint users_suspension_phase_check check (
    suspension_phase is null or suspension_phase in ('prepared', 'projects_transferred', 'provider_revoking', 'provider_revoked')
  );

create or replace function public.admin_sanitize_audit_text(
  p_value text,
  p_max_length integer
)
returns text
language plpgsql
immutable
set search_path = public
as $$
declare
  v_value text := btrim(coalesce(p_value, ''));
begin
  v_value := regexp_replace(
    v_value,
    '\mbearer[[:space:]]+[^[:space:],;]+',
    'Bearer [redacted]',
    'gi'
  );
  v_value := regexp_replace(
    v_value,
    '\m(password|secret|token|api[_-]?key)[[:space:]]*[:=][[:space:]]*("[^"]*"|''[^'']*''|[^[:space:],;&]+)',
    '\1=[redacted]',
    'gi'
  );
  v_value := regexp_replace(
    v_value,
    '\m(sk|pk|rk|api[_-]?key|key)[_-][[:alnum:]][[:alnum:]._-]{5,}\M',
    '[redacted]',
    'gi'
  );
  return left(v_value, greatest(coalesce(p_max_length, 0), 0));
end;
$$;

create or replace function public.admin_sanitize_audit_context(p_metadata jsonb)
returns jsonb
language plpgsql
immutable
set search_path = public
as $$
declare
  v_metadata jsonb := case
    when jsonb_typeof(p_metadata) = 'object' then p_metadata
    else '{}'::jsonb
  end;
begin
  return jsonb_build_object(
    'reason', public.admin_sanitize_audit_text(v_metadata->>'reason', 500),
    'ip', public.admin_sanitize_audit_text(v_metadata->>'ip', 128),
    'userAgent', public.admin_sanitize_audit_text(v_metadata->>'userAgent', 512),
    'requestId', public.admin_sanitize_audit_text(v_metadata->>'requestId', 128)
  );
end;
$$;

-- Remove draft signatures that did not receive the operator identity. Leaving
-- them installed would preserve an authorization bypass on databases where an
-- earlier version of this migration was evaluated manually.
drop function if exists public.admin_update_user_status_atomic(uuid, text, timestamptz, text);
drop function if exists public.admin_prepare_user_archive_atomic(uuid);
drop function if exists public.admin_prepare_user_archive_atomic(uuid, uuid);
drop function if exists public.admin_prepare_user_archive_atomic(uuid, uuid, uuid);
drop function if exists public.admin_archive_user_atomic(uuid, uuid, timestamptz);
drop function if exists public.admin_archive_user_atomic(uuid, uuid, timestamptz, uuid);
drop function if exists public.admin_mark_archive_projects_transferred(uuid, uuid, uuid);
drop function if exists public.admin_abort_user_archive_atomic(uuid);
drop function if exists public.admin_abort_user_archive_atomic(uuid, uuid);
drop function if exists public.admin_restore_user_atomic(uuid, uuid, uuid);
drop function if exists public.admin_replace_user_roles_atomic(uuid, text[], uuid);
drop function if exists public.admin_update_user_status_atomic(uuid, text, timestamptz, text, uuid);

create or replace function public.admin_replace_user_roles_atomic(
  p_target_user_id uuid,
  p_role_codes text[],
  p_operator_user_id uuid,
  p_operation_token uuid,
  p_audit_metadata jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_super_admin_role_id uuid;
  v_target_status text;
  v_target_deleted_at timestamptz;
  v_target_is_super_admin boolean;
  v_operator_is_super_admin boolean;
  v_next_is_super_admin boolean;
  v_active_super_admin_count bigint;
  v_valid_role_count bigint;
  v_before_roles text[];
  v_next_roles text[];
  v_existing_event_id uuid;
  v_safe_audit_metadata jsonb;
begin
  if p_operation_token is null then
    raise exception using errcode = 'P0001', message = 'INVALID_OPERATION_TOKEN';
  end if;
  v_safe_audit_metadata := public.admin_sanitize_audit_context(p_audit_metadata);

  select id into v_super_admin_role_id
  from public.roles
  where code = 'super_admin'
  for update;

  if v_super_admin_role_id is null then
    raise exception using errcode = 'P0001', message = 'SUPER_ADMIN_ROLE_MISSING';
  end if;

  select coalesce(status, 'active'), deleted_at, role_event_id
  into v_target_status, v_target_deleted_at, v_existing_event_id
  from public.users
  where id = p_target_user_id
  for update;

  if not found then
    raise exception using errcode = 'P0001', message = 'TARGET_USER_NOT_FOUND';
  end if;
  if v_target_status in ('archiving', 'suspending') then
    raise exception using errcode = 'P0001', message = 'ACCOUNT_MUTATION_IN_PROGRESS';
  end if;

  if p_role_codes is null or cardinality(p_role_codes) = 0 then
    raise exception using errcode = 'P0001', message = 'INVALID_ROLE_CODES';
  end if;

  select count(distinct code), array_agg(distinct code order by code)
  into v_valid_role_count, v_next_roles
  from public.roles
  where code = any(p_role_codes);

  if v_valid_role_count <> cardinality(p_role_codes) then
    raise exception using errcode = 'P0001', message = 'INVALID_ROLE_CODES';
  end if;

  select coalesce(array_agg(distinct r.code order by r.code), '{}'::text[])
  into v_before_roles
  from public.user_roles ur
  join public.roles r on r.id = ur.role_id
  where ur.user_id = p_target_user_id;

  select exists (
    select 1 from public.user_roles
    where user_id = p_target_user_id and role_id = v_super_admin_role_id
  ) into v_target_is_super_admin;
  select exists (
    select 1 from public.user_roles
    where user_id = p_operator_user_id and role_id = v_super_admin_role_id
  ) into v_operator_is_super_admin;
  v_next_is_super_admin := 'super_admin' = any(p_role_codes);

  if v_target_is_super_admin and not v_operator_is_super_admin then
    raise exception using errcode = 'P0001', message = 'FORBIDDEN_SUPER_ADMIN_EDIT';
  end if;
  if v_next_is_super_admin and not v_operator_is_super_admin then
    raise exception using errcode = 'P0001', message = 'FORBIDDEN_SUPER_ADMIN_GRANT';
  end if;

  if v_target_is_super_admin
    and v_target_status = 'active'
    and v_target_deleted_at is null
    and not v_next_is_super_admin then
    select count(distinct ur.user_id)
    into v_active_super_admin_count
    from public.user_roles ur
    join public.users u on u.id = ur.user_id
    where ur.role_id = v_super_admin_role_id
      and coalesce(u.status, 'active') = 'active'
      and u.deleted_at is null;

    if v_active_super_admin_count <= 1 then
      raise exception using errcode = 'P0001', message = 'LAST_SUPER_ADMIN_REQUIRED';
    end if;
  end if;

  if v_before_roles is distinct from v_next_roles then
    delete from public.user_roles where user_id = p_target_user_id;
    insert into public.user_roles (user_id, role_id, created_by)
    select p_target_user_id, id, p_operator_user_id
    from public.roles
    where code = any(v_next_roles);
    v_existing_event_id := p_operation_token;
    update public.users
    set role_event_id = v_existing_event_id,
        role_event_roles = v_next_roles,
        role_event_operator_user_id = p_operator_user_id,
        role_audit_metadata = v_safe_audit_metadata
    where id = p_target_user_id;
  elsif v_existing_event_id is null then
    v_existing_event_id := p_operation_token;
    update public.users
    set role_event_id = v_existing_event_id,
        role_event_roles = v_next_roles,
        role_event_operator_user_id = p_operator_user_id,
        role_audit_metadata = v_safe_audit_metadata
    where id = p_target_user_id;
  end if;

  insert into public.admin_operation_logs (
    operator_user_id, target_user_id, action, metadata, operation_token
  ) values (
    p_operator_user_id,
    p_target_user_id,
    'admin.user.role.update',
    jsonb_build_object(
      'beforeRoles', to_jsonb(v_before_roles),
      'afterRoles', to_jsonb(v_next_roles),
      'reason', coalesce(v_safe_audit_metadata->>'reason', ''),
      'ip', coalesce(v_safe_audit_metadata->>'ip', ''),
      'userAgent', coalesce(v_safe_audit_metadata->>'userAgent', ''),
      'requestId', coalesce(v_safe_audit_metadata->>'requestId', '')
    ),
    v_existing_event_id
  )
  on conflict (action, operation_token) where operation_token is not null do nothing;
end;
$$;

create or replace function public.admin_update_user_status_atomic(
  p_target_user_id uuid,
  p_status text,
  p_suspended_at timestamptz,
  p_suspended_reason text,
  p_operator_user_id uuid,
  p_operation_token uuid,
  p_audit_metadata jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_super_admin_role_id uuid;
  v_target_status text;
  v_target_deleted_at timestamptz;
  v_target_is_super_admin boolean;
  v_operator_is_super_admin boolean;
  v_active_super_admin_count bigint;
  v_safe_audit_metadata jsonb;
  v_existing_event_id uuid;
  v_result jsonb;
begin
  if p_status <> 'active' then
    raise exception using errcode = 'P0001', message = 'INVALID_STATUS';
  end if;
  if p_operation_token is null then
    raise exception using errcode = 'P0001', message = 'INVALID_OPERATION_TOKEN';
  end if;
  v_safe_audit_metadata := public.admin_sanitize_audit_context(p_audit_metadata);

  select id into v_super_admin_role_id
  from public.roles
  where code = 'super_admin'
  for update;

  if v_super_admin_role_id is null then
    raise exception using errcode = 'P0001', message = 'SUPER_ADMIN_ROLE_MISSING';
  end if;

  select coalesce(status, 'active'), deleted_at, status_event_id
  into v_target_status, v_target_deleted_at, v_existing_event_id
  from public.users
  where id = p_target_user_id
  for update;

  if not found then
    raise exception using errcode = 'P0001', message = 'TARGET_USER_NOT_FOUND';
  end if;
  if v_target_status in ('archiving', 'suspending') then
    raise exception using errcode = 'P0001', message = 'ACCOUNT_MUTATION_IN_PROGRESS';
  end if;
  if v_target_status = 'deleted' or v_target_deleted_at is not null then
    raise exception using errcode = 'P0001', message = 'ACCOUNT_ALREADY_DELETED';
  end if;
  select exists (
    select 1 from public.user_roles
    where user_id = p_target_user_id and role_id = v_super_admin_role_id
  ) into v_target_is_super_admin;
  select exists (
    select 1 from public.user_roles
    where user_id = p_operator_user_id and role_id = v_super_admin_role_id
  ) into v_operator_is_super_admin;

  if v_target_is_super_admin and not v_operator_is_super_admin then
    raise exception using errcode = 'P0001', message = 'FORBIDDEN_SUPER_ADMIN_EDIT';
  end if;

  if v_target_is_super_admin and v_target_status = 'active' and p_status <> 'active' then
    select count(distinct ur.user_id)
    into v_active_super_admin_count
    from public.user_roles ur
    join public.users u on u.id = ur.user_id
    where ur.role_id = v_super_admin_role_id
      and coalesce(u.status, 'active') = 'active'
      and u.deleted_at is null;

    if v_active_super_admin_count <= 1 then
      raise exception using errcode = 'P0001', message = 'LAST_SUPER_ADMIN_REQUIRED';
    end if;
  end if;

  if v_target_status <> 'active' or v_existing_event_id is null then
    v_existing_event_id := p_operation_token;
  end if;

  update public.users
  set status = 'active',
      suspended_at = null,
      suspended_reason = null,
      status_event_id = v_existing_event_id,
      status_event_status = 'active',
      status_event_operator_user_id = p_operator_user_id,
      status_audit_metadata = v_safe_audit_metadata,
      restore_event_id = null,
      restore_operator_user_id = null,
      restore_audit_metadata = null,
      suspension_previous_status = null,
      suspension_started_at = null,
      suspension_token = null,
      suspension_phase = null,
      suspension_event_id = null,
      suspension_operator_user_id = null,
      suspension_audit_metadata = null,
      suspension_project_transfer = null
  where id = p_target_user_id;

  insert into public.admin_operation_logs (
    operator_user_id, target_user_id, action, metadata, operation_token
  ) values (
    p_operator_user_id,
    p_target_user_id,
    'admin.user.status.update',
    jsonb_build_object(
      'beforeStatus', v_target_status,
      'afterStatus', 'active',
      'reason', coalesce(v_safe_audit_metadata->>'reason', ''),
      'ip', coalesce(v_safe_audit_metadata->>'ip', ''),
      'userAgent', coalesce(v_safe_audit_metadata->>'userAgent', ''),
      'requestId', coalesce(v_safe_audit_metadata->>'requestId', '')
    ),
    v_existing_event_id
  )
  on conflict (action, operation_token) where operation_token is not null do nothing;

  select jsonb_build_object(
    'id', id, 'email', email, 'status', status,
    'suspended_at', suspended_at, 'suspended_reason', suspended_reason
  ) into v_result from public.users where id = p_target_user_id;
  return v_result;
end;
$$;

create or replace function public.admin_prepare_user_suspension_atomic(
  p_target_user_id uuid,
  p_operator_user_id uuid,
  p_suspension_token uuid,
  p_audit_metadata jsonb
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_super_admin_role_id uuid;
  v_target_status text;
  v_target_deleted_at timestamptz;
  v_target_is_super_admin boolean;
  v_operator_is_super_admin boolean;
  v_active_super_admin_count bigint;
  v_existing_phase text;
  v_existing_operator uuid;
  v_service_token uuid;
  v_restore_event_id uuid;
  v_suspension_event_id uuid;
  v_safe_audit_metadata jsonb;
begin
  if p_suspension_token is null then
    raise exception using errcode = 'P0001', message = 'INVALID_SUSPENSION_TOKEN';
  end if;
  v_safe_audit_metadata := public.admin_sanitize_audit_context(p_audit_metadata);

  select id into v_super_admin_role_id from public.roles where code = 'super_admin' for update;
  if v_super_admin_role_id is null then
    raise exception using errcode = 'P0001', message = 'SUPER_ADMIN_ROLE_MISSING';
  end if;

  select coalesce(status, 'active'), deleted_at, suspension_phase,
         suspension_operator_user_id, service_mutation_token, restore_event_id, suspension_event_id
  into v_target_status, v_target_deleted_at, v_existing_phase,
       v_existing_operator, v_service_token, v_restore_event_id, v_suspension_event_id
  from public.users where id = p_target_user_id for update;
  if not found then
    raise exception using errcode = 'P0001', message = 'TARGET_USER_NOT_FOUND';
  end if;

  select exists (select 1 from public.user_roles where user_id = p_target_user_id and role_id = v_super_admin_role_id)
  into v_target_is_super_admin;
  select exists (select 1 from public.user_roles where user_id = p_operator_user_id and role_id = v_super_admin_role_id)
  into v_operator_is_super_admin;
  if v_target_is_super_admin and not v_operator_is_super_admin then
    raise exception using errcode = 'P0001', message = 'FORBIDDEN_SUPER_ADMIN_EDIT';
  end if;

  if v_target_status = 'suspending' then
    if v_existing_phase not in ('prepared', 'projects_transferred', 'provider_revoking', 'provider_revoked') then
      raise exception using errcode = 'P0001', message = 'INVALID_SUSPENSION_PHASE';
    end if;
    if v_existing_operator is distinct from p_operator_user_id then
      insert into public.admin_operation_logs (
        operator_user_id, target_user_id, action, metadata, operation_token
      ) values (
        p_operator_user_id, p_target_user_id, 'admin.user.suspension.resume',
        jsonb_build_object(
          'phase', v_existing_phase,
          'initiatorUserId', v_existing_operator,
          'reason', coalesce(v_safe_audit_metadata->>'reason', ''),
          'requestId', coalesce(v_safe_audit_metadata->>'requestId', ''),
          'ip', coalesce(v_safe_audit_metadata->>'ip', ''),
          'userAgent', coalesce(v_safe_audit_metadata->>'userAgent', '')
        ),
        p_suspension_token
      ) on conflict (action, operation_token) where operation_token is not null do nothing;
    end if;
    update public.users
    set suspension_token = p_suspension_token,
        suspension_started_at = now()
    where id = p_target_user_id;
    return v_existing_phase;
  end if;

  if v_target_status = 'suspended' and v_suspension_event_id is not null and v_restore_event_id is null then
    return 'completed';
  end if;
  if v_target_status in ('archiving', 'deleted') or v_target_deleted_at is not null then
    raise exception using errcode = 'P0001', message = 'ACCOUNT_MUTATION_IN_PROGRESS';
  end if;
  if v_service_token is not null then
    raise exception using errcode = 'P0001', message = 'ACCOUNT_MUTATION_IN_PROGRESS';
  end if;

  if v_target_is_super_admin and v_target_status = 'active' then
    select count(distinct ur.user_id) into v_active_super_admin_count
    from public.user_roles ur join public.users u on u.id = ur.user_id
    where ur.role_id = v_super_admin_role_id
      and coalesce(u.status, 'active') = 'active' and u.deleted_at is null;
    if v_active_super_admin_count <= 1 then
      raise exception using errcode = 'P0001', message = 'LAST_SUPER_ADMIN_REQUIRED';
    end if;
  end if;

  update public.users
  set status = 'suspending',
      suspension_previous_status = v_target_status,
      suspension_started_at = now(),
      suspension_token = p_suspension_token,
      suspension_phase = 'prepared',
      suspension_event_id = p_suspension_token,
      suspension_operator_user_id = p_operator_user_id,
      suspension_audit_metadata = v_safe_audit_metadata,
      suspension_project_transfer = null,
      restore_event_id = null,
      restore_operator_user_id = null,
      restore_audit_metadata = null,
      status_event_id = null,
      status_event_status = null,
      status_event_operator_user_id = null,
      status_audit_metadata = null
  where id = p_target_user_id;
  return 'prepared';
end;
$$;

create or replace function public.admin_mark_suspension_projects_transferred(
  p_target_user_id uuid, p_suspension_token uuid, p_project_transfer jsonb
)
returns void language plpgsql security definer set search_path = public as $$
begin
  update public.users
  set suspension_phase = 'projects_transferred',
      suspension_project_transfer = coalesce(p_project_transfer, '{}'::jsonb)
  where id = p_target_user_id and status = 'suspending'
    and suspension_token = p_suspension_token and suspension_phase = 'prepared';
  if not found then
    if exists (select 1 from public.users where id = p_target_user_id and status = 'suspending'
      and suspension_token = p_suspension_token and suspension_phase in ('projects_transferred', 'provider_revoking', 'provider_revoked')) then
      return;
    end if;
    raise exception using errcode = 'P0001', message = 'SUSPENSION_TOKEN_MISMATCH';
  end if;
end;
$$;

create or replace function public.admin_mark_suspension_provider_revoking(
  p_target_user_id uuid, p_suspension_token uuid
)
returns void language plpgsql security definer set search_path = public as $$
begin
  update public.users set suspension_phase = 'provider_revoking'
  where id = p_target_user_id and status = 'suspending'
    and suspension_token = p_suspension_token and suspension_phase = 'projects_transferred';
  if not found then
    if exists (select 1 from public.users where id = p_target_user_id and status = 'suspending'
      and suspension_token = p_suspension_token and suspension_phase in ('provider_revoking', 'provider_revoked')) then return; end if;
    raise exception using errcode = 'P0001', message = 'SUSPENSION_TOKEN_MISMATCH';
  end if;
end;
$$;

create or replace function public.admin_mark_suspension_provider_revoked(
  p_target_user_id uuid, p_suspension_token uuid
)
returns void language plpgsql security definer set search_path = public as $$
begin
  update public.users set suspension_phase = 'provider_revoked'
  where id = p_target_user_id and status = 'suspending'
    and suspension_token = p_suspension_token and suspension_phase = 'provider_revoking';
  if not found then
    if exists (select 1 from public.users where id = p_target_user_id and status = 'suspending'
      and suspension_token = p_suspension_token and suspension_phase = 'provider_revoked') then return; end if;
    raise exception using errcode = 'P0001', message = 'SUSPENSION_TOKEN_MISMATCH';
  end if;
end;
$$;

create or replace function public.admin_suspend_user_atomic(
  p_target_user_id uuid, p_operator_user_id uuid, p_suspension_token uuid
)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_event_id uuid;
  v_initiator uuid;
  v_metadata jsonb;
  v_previous_status text;
  v_project_transfer jsonb;
  v_result jsonb;
begin
  select suspension_event_id, suspension_operator_user_id, suspension_audit_metadata,
         suspension_previous_status, suspension_project_transfer
  into v_event_id, v_initiator, v_metadata, v_previous_status, v_project_transfer
  from public.users
  where id = p_target_user_id and status = 'suspending'
    and suspension_token = p_suspension_token and suspension_phase = 'provider_revoked'
  for update;
  if not found then
    raise exception using errcode = 'P0001', message = 'SUSPENSION_TOKEN_MISMATCH';
  end if;

  update public.sessions set revoked = true, revoked_at = coalesce(revoked_at, now())
  where user_id = p_target_user_id and revoked = false;

  update public.users
  set status = 'suspended',
      suspended_at = now(),
      suspended_reason = nullif(v_metadata->>'reason', ''),
      suspension_previous_status = null,
      suspension_started_at = null,
      suspension_token = null,
      suspension_phase = null,
      suspension_operator_user_id = v_initiator,
      suspension_audit_metadata = v_metadata,
      suspension_project_transfer = v_project_transfer
  where id = p_target_user_id;

  insert into public.admin_operation_logs (
    operator_user_id, target_user_id, action, metadata, operation_token
  ) values (
    v_initiator, p_target_user_id, 'admin.user.status.update',
    jsonb_build_object(
      'beforeStatus', v_previous_status,
      'afterStatus', 'suspended',
      'reason', coalesce(v_metadata->>'reason', ''),
      'projectOwnershipTransfer', v_project_transfer,
      'ip', coalesce(v_metadata->>'ip', ''),
      'userAgent', coalesce(v_metadata->>'userAgent', ''),
      'requestId', coalesce(v_metadata->>'requestId', '')
    ), v_event_id
  ) on conflict (action, operation_token) where operation_token is not null do nothing;

  select jsonb_build_object(
    'id', id, 'email', email, 'status', status,
    'suspended_at', suspended_at, 'suspended_reason', suspended_reason
  ) into v_result from public.users where id = p_target_user_id;
  return v_result;
end;
$$;

create or replace function public.admin_begin_service_mutation(
  p_target_user_id uuid,
  p_mutation_token uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_target_status text;
  v_target_deleted_at timestamptz;
  v_existing_token uuid;
begin
  if p_mutation_token is null then
    raise exception using errcode = 'P0001', message = 'INVALID_MUTATION_TOKEN';
  end if;

  select coalesce(status, 'active'), deleted_at, service_mutation_token
  into v_target_status, v_target_deleted_at, v_existing_token
  from public.users
  where id = p_target_user_id
  for update;

  if not found then
    raise exception using errcode = 'P0001', message = 'TARGET_USER_NOT_FOUND';
  end if;
  if v_target_status in ('archiving', 'suspending', 'deleted') or v_target_deleted_at is not null then
    raise exception using errcode = 'P0001', message = 'ARCHIVED_ACCOUNT_IMMUTABLE';
  end if;

  if v_existing_token = p_mutation_token then
    return;
  end if;
  if v_existing_token is not null then
    raise exception using errcode = 'P0001', message = 'ACCOUNT_MUTATION_IN_PROGRESS';
  end if;

  update public.users
  set service_mutation_token = p_mutation_token,
      service_mutation_started_at = now()
  where id = p_target_user_id;
end;
$$;

create or replace function public.admin_end_service_mutation(
  p_target_user_id uuid,
  p_mutation_token uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.users
  set service_mutation_token = null,
      service_mutation_started_at = null
  where id = p_target_user_id
    and service_mutation_token = p_mutation_token;
end;
$$;

create or replace function public.admin_prepare_user_archive_atomic(
  p_target_user_id uuid,
  p_operator_user_id uuid,
  p_archive_token uuid,
  p_audit_metadata jsonb
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_super_admin_role_id uuid;
  v_target_status text;
  v_target_deleted_at timestamptz;
  v_target_is_super_admin boolean;
  v_operator_is_super_admin boolean;
  v_active_super_admin_count bigint;
  v_existing_archive_phase text;
  v_existing_archive_operator_user_id uuid;
  v_service_mutation_token uuid;
  v_safe_audit_metadata jsonb;
begin
  if p_archive_token is null then
    raise exception using errcode = 'P0001', message = 'INVALID_ARCHIVE_TOKEN';
  end if;
  v_safe_audit_metadata := public.admin_sanitize_audit_context(p_audit_metadata);

  select id into v_super_admin_role_id
  from public.roles
  where code = 'super_admin'
  for update;

  if v_super_admin_role_id is null then
    raise exception using errcode = 'P0001', message = 'SUPER_ADMIN_ROLE_MISSING';
  end if;

  select coalesce(status, 'active'), deleted_at, archive_phase, service_mutation_token, archive_operator_user_id
  into v_target_status, v_target_deleted_at, v_existing_archive_phase, v_service_mutation_token, v_existing_archive_operator_user_id
  from public.users
  where id = p_target_user_id
  for update;

  if not found then
    raise exception using errcode = 'P0001', message = 'TARGET_USER_NOT_FOUND';
  end if;
  if v_target_status = 'deleted' or v_target_deleted_at is not null then
    raise exception using errcode = 'P0001', message = 'ACCOUNT_ALREADY_DELETED';
  end if;
  if v_target_status = 'suspending' then
    raise exception using errcode = 'P0001', message = 'ACCOUNT_MUTATION_IN_PROGRESS';
  end if;

  select exists (
    select 1 from public.user_roles
    where user_id = p_operator_user_id and role_id = v_super_admin_role_id
  ) into v_operator_is_super_admin;
  if not v_operator_is_super_admin then
    raise exception using errcode = 'P0001', message = 'FORBIDDEN_USER_ARCHIVE';
  end if;

  if v_service_mutation_token is not null then
    raise exception using errcode = 'P0001', message = 'ACCOUNT_MUTATION_IN_PROGRESS';
  end if;

  if v_target_status = 'archiving' then
    if v_existing_archive_phase not in ('prepared', 'provider_revoking', 'provider_revoked', 'projects_transferred') then
      raise exception using errcode = 'P0001', message = 'INVALID_ARCHIVE_PHASE';
    end if;
    if v_existing_archive_operator_user_id is distinct from p_operator_user_id then
      insert into public.admin_operation_logs (
        operator_user_id, target_user_id, action, metadata, operation_token
      ) values (
        p_operator_user_id, p_target_user_id, 'admin.user.archive.resume',
        jsonb_build_object(
          'phase', v_existing_archive_phase,
          'initiatorUserId', v_existing_archive_operator_user_id,
          'reason', coalesce(v_safe_audit_metadata->>'reason', ''),
          'requestId', coalesce(v_safe_audit_metadata->>'requestId', ''),
          'ip', coalesce(v_safe_audit_metadata->>'ip', ''),
          'userAgent', coalesce(v_safe_audit_metadata->>'userAgent', '')
        ), p_archive_token
      ) on conflict (action, operation_token) where operation_token is not null do nothing;
    end if;
    update public.users
    set archive_token = p_archive_token,
        archive_started_at = now(),
        archive_event_id = coalesce(archive_event_id, p_archive_token),
        archive_operator_user_id = coalesce(archive_operator_user_id, p_operator_user_id),
        archive_audit_metadata = public.admin_sanitize_audit_context(
          coalesce(archive_audit_metadata, v_safe_audit_metadata)
        ),
        restore_event_id = null,
        restore_operator_user_id = null,
        restore_audit_metadata = null
    where id = p_target_user_id;
    return v_existing_archive_phase;
  end if;

  select exists (
    select 1 from public.user_roles
    where user_id = p_target_user_id and role_id = v_super_admin_role_id
  ) into v_target_is_super_admin;

  if v_target_is_super_admin and v_target_status = 'active' then
    select count(distinct ur.user_id)
    into v_active_super_admin_count
    from public.user_roles ur
    join public.users u on u.id = ur.user_id
    where ur.role_id = v_super_admin_role_id
      and coalesce(u.status, 'active') = 'active'
      and u.deleted_at is null;

    if v_active_super_admin_count <= 1 then
      raise exception using errcode = 'P0001', message = 'LAST_SUPER_ADMIN_REQUIRED';
    end if;
  end if;

  update public.users
  set archive_previous_status = v_target_status,
      archive_started_at = now(),
      archive_token = p_archive_token,
      archive_phase = 'prepared',
      archive_event_id = p_archive_token,
      archive_operator_user_id = p_operator_user_id,
      archive_audit_metadata = v_safe_audit_metadata,
      archive_project_transfer = null,
      restore_event_id = null,
      restore_operator_user_id = null,
      restore_audit_metadata = null,
      suspension_previous_status = null,
      suspension_started_at = null,
      suspension_token = null,
      suspension_phase = null,
      suspension_event_id = null,
      suspension_operator_user_id = null,
      suspension_audit_metadata = null,
      suspension_project_transfer = null,
      status_event_id = null,
      status_event_status = null,
      status_event_operator_user_id = null,
      status_audit_metadata = null,
      service_mutation_token = null,
      service_mutation_started_at = null,
      status = 'archiving'
  where id = p_target_user_id;

  return 'prepared';
end;
$$;

create or replace function public.admin_mark_archive_provider_revoking(
  p_target_user_id uuid,
  p_operator_user_id uuid,
  p_archive_token uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_super_admin_role_id uuid;
  v_target_status text;
  v_existing_archive_token uuid;
  v_archive_phase text;
  v_suspension_token uuid;
  v_suspension_phase text;
  v_operator_is_super_admin boolean;
begin
  select id into v_super_admin_role_id from public.roles where code = 'super_admin' for update;
  if v_super_admin_role_id is null then
    raise exception using errcode = 'P0001', message = 'SUPER_ADMIN_ROLE_MISSING';
  end if;

  select coalesce(status, 'active'), archive_token, archive_phase
  into v_target_status, v_existing_archive_token, v_archive_phase
  from public.users where id = p_target_user_id for update;
  if not found then
    raise exception using errcode = 'P0001', message = 'TARGET_USER_NOT_FOUND';
  end if;

  select exists (
    select 1 from public.user_roles
    where user_id = p_operator_user_id and role_id = v_super_admin_role_id
  ) into v_operator_is_super_admin;
  if not v_operator_is_super_admin then
    raise exception using errcode = 'P0001', message = 'FORBIDDEN_USER_ARCHIVE';
  end if;
  if v_target_status <> 'archiving' then
    raise exception using errcode = 'P0001', message = 'ARCHIVE_NOT_PREPARED';
  end if;
  if v_existing_archive_token is distinct from p_archive_token then
    raise exception using errcode = 'P0001', message = 'ARCHIVE_TOKEN_MISMATCH';
  end if;
  if v_archive_phase in ('provider_revoking', 'provider_revoked', 'projects_transferred') then
    return;
  end if;
  if v_archive_phase <> 'prepared' then
    raise exception using errcode = 'P0001', message = 'INVALID_ARCHIVE_PHASE';
  end if;

  update public.users set archive_phase = 'provider_revoking' where id = p_target_user_id;
end;
$$;

create or replace function public.admin_mark_archive_provider_revoked(
  p_target_user_id uuid,
  p_operator_user_id uuid,
  p_archive_token uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_super_admin_role_id uuid;
  v_target_status text;
  v_existing_archive_token uuid;
  v_archive_phase text;
  v_operator_is_super_admin boolean;
begin
  select id into v_super_admin_role_id from public.roles where code = 'super_admin' for update;
  if v_super_admin_role_id is null then
    raise exception using errcode = 'P0001', message = 'SUPER_ADMIN_ROLE_MISSING';
  end if;

  select coalesce(status, 'active'), archive_token, archive_phase
  into v_target_status, v_existing_archive_token, v_archive_phase
  from public.users where id = p_target_user_id for update;
  if not found then
    raise exception using errcode = 'P0001', message = 'TARGET_USER_NOT_FOUND';
  end if;

  select exists (
    select 1 from public.user_roles
    where user_id = p_operator_user_id and role_id = v_super_admin_role_id
  ) into v_operator_is_super_admin;
  if not v_operator_is_super_admin then
    raise exception using errcode = 'P0001', message = 'FORBIDDEN_USER_ARCHIVE';
  end if;
  if v_target_status <> 'archiving' then
    raise exception using errcode = 'P0001', message = 'ARCHIVE_NOT_PREPARED';
  end if;
  if v_existing_archive_token is distinct from p_archive_token then
    raise exception using errcode = 'P0001', message = 'ARCHIVE_TOKEN_MISMATCH';
  end if;
  if v_archive_phase in ('provider_revoked', 'projects_transferred') then
    return;
  end if;
  if v_archive_phase <> 'provider_revoking' then
    raise exception using errcode = 'P0001', message = 'INVALID_ARCHIVE_PHASE';
  end if;

  update public.users set archive_phase = 'provider_revoked' where id = p_target_user_id;
end;
$$;

create or replace function public.admin_mark_archive_projects_transferred(
  p_target_user_id uuid,
  p_operator_user_id uuid,
  p_archive_token uuid,
  p_project_transfer jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_super_admin_role_id uuid;
  v_target_status text;
  v_existing_archive_token uuid;
  v_archive_phase text;
  v_operator_is_super_admin boolean;
begin
  select id into v_super_admin_role_id from public.roles where code = 'super_admin' for update;
  if v_super_admin_role_id is null then
    raise exception using errcode = 'P0001', message = 'SUPER_ADMIN_ROLE_MISSING';
  end if;

  select coalesce(status, 'active'), archive_token, archive_phase
  into v_target_status, v_existing_archive_token, v_archive_phase
  from public.users where id = p_target_user_id for update;
  if not found then
    raise exception using errcode = 'P0001', message = 'TARGET_USER_NOT_FOUND';
  end if;

  select exists (
    select 1 from public.user_roles
    where user_id = p_operator_user_id and role_id = v_super_admin_role_id
  ) into v_operator_is_super_admin;
  if not v_operator_is_super_admin then
    raise exception using errcode = 'P0001', message = 'FORBIDDEN_USER_ARCHIVE';
  end if;
  if v_target_status <> 'archiving' then
    raise exception using errcode = 'P0001', message = 'ARCHIVE_NOT_PREPARED';
  end if;
  if v_existing_archive_token is distinct from p_archive_token then
    raise exception using errcode = 'P0001', message = 'ARCHIVE_TOKEN_MISMATCH';
  end if;
  if v_archive_phase = 'projects_transferred' then
    return;
  end if;
  if v_archive_phase <> 'provider_revoked' then
    raise exception using errcode = 'P0001', message = 'ARCHIVE_PROVIDER_NOT_REVOKED';
  end if;

  update public.users
  set archive_phase = 'projects_transferred',
      archive_project_transfer = coalesce(p_project_transfer, '{}'::jsonb)
  where id = p_target_user_id;
end;
$$;

create or replace function public.admin_archive_user_atomic(
  p_target_user_id uuid,
  p_operator_user_id uuid,
  p_archived_at timestamptz,
  p_archive_token uuid,
  p_audit_metadata jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_super_admin_role_id uuid;
  v_target_status text;
  v_target_deleted_at timestamptz;
  v_existing_archive_token uuid;
  v_archive_phase text;
  v_operator_is_super_admin boolean;
  v_archive_previous_status text;
  v_archive_event_id uuid;
  v_archive_operator_user_id uuid;
  v_archive_audit_metadata jsonb;
  v_archive_project_transfer jsonb;
  v_effective_event_id uuid;
  v_effective_operator_user_id uuid;
  v_effective_audit_metadata jsonb;
  v_is_legacy_deleted boolean;
  v_existing_audit_id uuid;
  v_existing_audit_token uuid;
begin
  select id into v_super_admin_role_id from public.roles where code = 'super_admin' for update;
  if v_super_admin_role_id is null then
    raise exception using errcode = 'P0001', message = 'SUPER_ADMIN_ROLE_MISSING';
  end if;

  select coalesce(status, 'active'), deleted_at, archive_token, archive_phase,
         archive_previous_status, archive_event_id, archive_operator_user_id,
         archive_audit_metadata, archive_project_transfer
  into v_target_status, v_target_deleted_at, v_existing_archive_token, v_archive_phase,
       v_archive_previous_status, v_archive_event_id, v_archive_operator_user_id,
       v_archive_audit_metadata, v_archive_project_transfer
  from public.users where id = p_target_user_id for update;
  if not found then
    raise exception using errcode = 'P0001', message = 'TARGET_USER_NOT_FOUND';
  end if;
  select exists (
    select 1 from public.user_roles
    where user_id = p_operator_user_id and role_id = v_super_admin_role_id
  ) into v_operator_is_super_admin;
  if not v_operator_is_super_admin then
    raise exception using errcode = 'P0001', message = 'FORBIDDEN_USER_ARCHIVE';
  end if;

  v_is_legacy_deleted := v_target_status = 'deleted' or v_target_deleted_at is not null;
  v_effective_event_id := coalesce(v_archive_event_id, p_archive_token);
  v_effective_operator_user_id := coalesce(v_archive_operator_user_id, p_operator_user_id);
  v_effective_audit_metadata := public.admin_sanitize_audit_context(
    coalesce(v_archive_audit_metadata, p_audit_metadata)
  );

  if v_is_legacy_deleted and v_archive_event_id is null then
    select id, operation_token
    into v_existing_audit_id, v_existing_audit_token
    from public.admin_operation_logs
    where target_user_id = p_target_user_id and action = 'admin.user.delete'
    order by created_at desc, id desc
    limit 1;

    if v_existing_audit_id is not null and v_existing_audit_token is not null then
      v_effective_event_id := v_existing_audit_token;
    end if;
  end if;

  if v_effective_event_id is null then
    raise exception using errcode = 'P0001', message = 'INVALID_ARCHIVE_TOKEN';
  end if;

  if v_is_legacy_deleted then
    update public.users
    set archive_event_id = coalesce(archive_event_id, v_effective_event_id),
        restore_event_id = null,
        restore_operator_user_id = null,
        restore_audit_metadata = null,
        suspension_previous_status = null,
        suspension_started_at = null,
        suspension_token = null,
        suspension_phase = null,
        suspension_event_id = null,
        suspension_operator_user_id = null,
        suspension_audit_metadata = null,
        suspension_project_transfer = null,
        status_event_id = null,
        status_event_status = null,
        status_event_operator_user_id = null,
        status_audit_metadata = null
    where id = p_target_user_id;

    if v_existing_audit_id is not null and v_existing_audit_token is null then
      update public.admin_operation_logs
      set operation_token = v_effective_event_id
      where id = v_existing_audit_id and operation_token is null;
    end if;

    update public.sessions
    set revoked = true,
        revoked_at = coalesce(revoked_at, p_archived_at, v_target_deleted_at, now())
    where user_id = p_target_user_id and revoked = false;

    delete from public.user_api_key_assignments
    where user_id = p_target_user_id;

    insert into public.admin_operation_logs (
      operator_user_id, target_user_id, action, metadata, operation_token
    ) values (
      v_effective_operator_user_id,
      p_target_user_id,
      'admin.user.delete',
      jsonb_build_object(
        'beforeStatus', coalesce(v_archive_previous_status, 'unknown'),
        'projectOwnershipTransfer', v_archive_project_transfer,
        'reason', coalesce(v_effective_audit_metadata->>'reason', ''),
        'ip', coalesce(v_effective_audit_metadata->>'ip', ''),
        'userAgent', coalesce(v_effective_audit_metadata->>'userAgent', ''),
        'requestId', coalesce(v_effective_audit_metadata->>'requestId', '')
      ),
      v_effective_event_id
    )
    on conflict (action, operation_token) where operation_token is not null do nothing;
    return;
  end if;

  if v_target_status <> 'archiving' then
    raise exception using errcode = 'P0001', message = 'ARCHIVE_NOT_PREPARED';
  end if;
  if v_existing_archive_token is distinct from p_archive_token then
    raise exception using errcode = 'P0001', message = 'ARCHIVE_TOKEN_MISMATCH';
  end if;
  if v_archive_phase <> 'projects_transferred' then
    raise exception using errcode = 'P0001', message = 'ARCHIVE_PROJECTS_NOT_TRANSFERRED';
  end if;

  update public.users
  set status = 'deleted',
      deleted_at = coalesce(p_archived_at, now()),
      deleted_by = v_effective_operator_user_id,
      suspended_at = coalesce(p_archived_at, now()),
      suspended_reason = 'Deleted by admin',
      archive_previous_status = null,
      archive_started_at = null,
      archive_token = null,
      archive_phase = null,
      archive_event_id = v_effective_event_id,
      archive_operator_user_id = null,
      archive_audit_metadata = null,
      archive_project_transfer = null,
      restore_event_id = null,
      restore_operator_user_id = null,
      restore_audit_metadata = null,
      suspension_previous_status = null,
      suspension_started_at = null,
      suspension_token = null,
      suspension_phase = null,
      suspension_event_id = null,
      suspension_operator_user_id = null,
      suspension_audit_metadata = null,
      suspension_project_transfer = null,
      status_event_id = null,
      status_event_status = null,
      status_event_operator_user_id = null,
      status_audit_metadata = null
  where id = p_target_user_id;

  update public.sessions
  set revoked = true,
      revoked_at = coalesce(revoked_at, p_archived_at, now())
  where user_id = p_target_user_id and revoked = false;

  delete from public.user_api_key_assignments
  where user_id = p_target_user_id;

  insert into public.admin_operation_logs (
    operator_user_id, target_user_id, action, metadata, operation_token
  ) values (
    v_effective_operator_user_id,
    p_target_user_id,
    'admin.user.delete',
    jsonb_build_object(
      'beforeStatus', coalesce(v_archive_previous_status, 'unknown'),
      'projectOwnershipTransfer', v_archive_project_transfer,
      'reason', coalesce(v_effective_audit_metadata->>'reason', ''),
      'ip', coalesce(v_effective_audit_metadata->>'ip', ''),
      'userAgent', coalesce(v_effective_audit_metadata->>'userAgent', ''),
      'requestId', coalesce(v_effective_audit_metadata->>'requestId', '')
    ),
    v_effective_event_id
  )
  on conflict (action, operation_token) where operation_token is not null do nothing;
end;
$$;

create or replace function public.admin_restore_user_atomic(
  p_target_user_id uuid,
  p_operator_user_id uuid,
  p_restore_token uuid,
  p_audit_metadata jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_super_admin_role_id uuid;
  v_authorized_operator_id uuid;
  v_target_status text;
  v_target_deleted_at timestamptz;
  v_existing_restore_event_id uuid;
  v_existing_restore_operator_user_id uuid;
  v_existing_restore_audit_metadata jsonb;
  v_effective_restore_event_id uuid;
  v_effective_operator_user_id uuid;
  v_effective_audit_metadata jsonb;
  v_is_deleted boolean;
  v_is_already_restored boolean;
  v_restored_at timestamptz;
  v_result jsonb;
begin
  if p_restore_token is null then
    raise exception using errcode = 'P0001', message = 'INVALID_RESTORE_TOKEN';
  end if;

  select id into v_super_admin_role_id
  from public.roles
  where code = 'super_admin'
  for update;
  if v_super_admin_role_id is null then
    raise exception using errcode = 'P0001', message = 'SUPER_ADMIN_ROLE_MISSING';
  end if;

  select coalesce(status, 'active'), deleted_at, restore_event_id,
         restore_operator_user_id, restore_audit_metadata
  into v_target_status, v_target_deleted_at, v_existing_restore_event_id,
       v_existing_restore_operator_user_id, v_existing_restore_audit_metadata
  from public.users
  where id = p_target_user_id
  for update;
  if not found then
    raise exception using errcode = 'P0001', message = 'TARGET_USER_NOT_FOUND';
  end if;

  select ur.user_id into v_authorized_operator_id
  from public.user_roles ur
  where ur.user_id = p_operator_user_id
    and ur.role_id = v_super_admin_role_id
  limit 1
  for key share;
  if v_authorized_operator_id is null then
    raise exception using errcode = 'P0001', message = 'FORBIDDEN_USER_RESTORE';
  end if;

  v_is_deleted := v_target_status = 'deleted' or v_target_deleted_at is not null;
  v_is_already_restored := v_target_status = 'suspended'
    and v_target_deleted_at is null
    and v_existing_restore_event_id is not null;

  if not v_is_deleted and not v_is_already_restored then
    raise exception using errcode = 'P0001', message = 'ACCOUNT_NOT_ARCHIVED';
  end if;

  v_effective_restore_event_id := case
    when v_is_already_restored then v_existing_restore_event_id
    else p_restore_token
  end;
  v_effective_operator_user_id := case
    when v_is_already_restored then coalesce(v_existing_restore_operator_user_id, p_operator_user_id)
    else p_operator_user_id
  end;
  v_effective_audit_metadata := public.admin_sanitize_audit_context(
    case
      when v_is_already_restored then coalesce(v_existing_restore_audit_metadata, p_audit_metadata)
      else p_audit_metadata
    end
  );

  if v_is_deleted then
    v_restored_at := now();
    update public.users
    set status = 'suspended',
        deleted_at = null,
        deleted_by = null,
        suspended_at = v_restored_at,
        suspended_reason = nullif(v_effective_audit_metadata->>'reason', ''),
        archive_previous_status = null,
        archive_started_at = null,
        archive_token = null,
        archive_phase = null,
        archive_event_id = null,
        archive_operator_user_id = null,
        archive_audit_metadata = null,
        archive_project_transfer = null,
        suspension_previous_status = null,
        suspension_started_at = null,
        suspension_token = null,
        suspension_phase = null,
        suspension_event_id = null,
        suspension_operator_user_id = null,
        suspension_audit_metadata = null,
        suspension_project_transfer = null,
        status_event_id = null,
        status_event_status = null,
        status_event_operator_user_id = null,
        status_audit_metadata = null,
        restore_event_id = v_effective_restore_event_id,
        restore_operator_user_id = v_effective_operator_user_id,
        restore_audit_metadata = v_effective_audit_metadata
    where id = p_target_user_id;
  else
    update public.users
    set restore_operator_user_id = v_effective_operator_user_id,
        restore_audit_metadata = v_effective_audit_metadata
    where id = p_target_user_id;
  end if;

  insert into public.admin_operation_logs (
    operator_user_id, target_user_id, action, metadata, operation_token
  ) values (
    v_effective_operator_user_id,
    p_target_user_id,
    'admin.user.restore',
    jsonb_build_object(
      'beforeStatus', 'deleted',
      'afterStatus', 'suspended',
      'reason', coalesce(v_effective_audit_metadata->>'reason', ''),
      'ip', coalesce(v_effective_audit_metadata->>'ip', ''),
      'userAgent', coalesce(v_effective_audit_metadata->>'userAgent', ''),
      'requestId', coalesce(v_effective_audit_metadata->>'requestId', '')
    ),
    v_effective_restore_event_id
  )
  on conflict (action, operation_token) where operation_token is not null do nothing;

  select jsonb_build_object(
    'id', id,
    'email', email,
    'status', status,
    'suspended_at', suspended_at,
    'suspended_reason', suspended_reason,
    'deleted_at', deleted_at,
    'already_restored', v_is_already_restored
  )
  into v_result
  from public.users
  where id = p_target_user_id;

  return v_result;
end;
$$;

create or replace function public.admin_abort_user_archive_atomic(
  p_target_user_id uuid,
  p_operator_user_id uuid,
  p_archive_token uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_super_admin_role_id uuid;
  v_target_status text;
  v_target_deleted_at timestamptz;
  v_existing_archive_token uuid;
  v_archive_phase text;
  v_archive_event_id uuid;
  v_operator_is_super_admin boolean;
begin
  select id into v_super_admin_role_id from public.roles where code = 'super_admin' for update;
  if v_super_admin_role_id is null then
    raise exception using errcode = 'P0001', message = 'SUPER_ADMIN_ROLE_MISSING';
  end if;

  select coalesce(status, 'active'), deleted_at, archive_token, archive_phase, archive_event_id
  into v_target_status, v_target_deleted_at, v_existing_archive_token, v_archive_phase, v_archive_event_id
  from public.users where id = p_target_user_id for update;
  if not found then
    raise exception using errcode = 'P0001', message = 'TARGET_USER_NOT_FOUND';
  end if;
  if v_target_status = 'deleted' or v_target_deleted_at is not null or v_target_status <> 'archiving' then
    return;
  end if;

  select exists (
    select 1 from public.user_roles
    where user_id = p_operator_user_id and role_id = v_super_admin_role_id
  ) into v_operator_is_super_admin;
  if not v_operator_is_super_admin then
    raise exception using errcode = 'P0001', message = 'FORBIDDEN_USER_ARCHIVE';
  end if;
  if v_existing_archive_token is distinct from p_archive_token then
    raise exception using errcode = 'P0001', message = 'ARCHIVE_TOKEN_MISMATCH';
  end if;
  if v_archive_phase <> 'prepared' then
    raise exception using errcode = 'P0001', message = 'ARCHIVE_PROVIDER_ALREADY_REVOKED';
  end if;
  if exists (
    select 1 from public.admin_workspace_transfer_events
    where event_id = v_archive_event_id
  ) then
    raise exception using errcode = 'P0001', message = 'WORKSPACE_TRANSFER_ALREADY_COMMITTED';
  end if;

  update public.users
  set status = coalesce(archive_previous_status, 'suspended'),
      archive_previous_status = null,
      archive_started_at = null,
      archive_token = null,
      archive_phase = null,
      archive_event_id = null,
      archive_operator_user_id = null,
      archive_audit_metadata = null,
      archive_project_transfer = null
  where id = p_target_user_id;
end;
$$;

create or replace function public.admin_recover_account_mutation(
  p_target_user_id uuid,
  p_operator_user_id uuid,
  p_expected_token uuid,
  p_action text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_super_admin_role_id uuid;
  v_target_status text;
  v_target_deleted_at timestamptz;
  v_archive_token uuid;
  v_archive_phase text;
  v_archive_event_id uuid;
  v_service_mutation_token uuid;
  v_suspension_token uuid;
  v_suspension_phase text;
  v_suspension_event_id uuid;
  v_operator_is_super_admin boolean;
begin
  if p_expected_token is null then
    raise exception using errcode = 'P0001', message = 'EXPECTED_TOKEN_REQUIRED';
  end if;

  select id into v_super_admin_role_id from public.roles where code = 'super_admin' for update;
  if v_super_admin_role_id is null then
    raise exception using errcode = 'P0001', message = 'SUPER_ADMIN_ROLE_MISSING';
  end if;

  select coalesce(status, 'active'), deleted_at, archive_token, archive_phase, archive_event_id,
         service_mutation_token, suspension_token, suspension_phase, suspension_event_id
  into v_target_status, v_target_deleted_at, v_archive_token, v_archive_phase, v_archive_event_id,
       v_service_mutation_token, v_suspension_token, v_suspension_phase, v_suspension_event_id
  from public.users where id = p_target_user_id for update;
  if not found then
    raise exception using errcode = 'P0001', message = 'TARGET_USER_NOT_FOUND';
  end if;

  select exists (
    select 1 from public.user_roles
    where user_id = p_operator_user_id and role_id = v_super_admin_role_id
  ) into v_operator_is_super_admin;
  if not v_operator_is_super_admin then
    raise exception using errcode = 'P0001', message = 'FORBIDDEN_USER_ARCHIVE';
  end if;

  if p_action = 'abort_pre_provider_archive' then
    if v_target_status <> 'archiving' or v_archive_phase <> 'prepared' then
      raise exception using errcode = 'P0001', message = 'RECOVERY_PRECONDITION_FAILED';
    end if;
    if v_archive_token is distinct from p_expected_token then
      raise exception using errcode = 'P0001', message = 'ARCHIVE_TOKEN_MISMATCH';
    end if;
    if exists (
      select 1 from public.admin_workspace_transfer_events
      where event_id = v_archive_event_id
    ) then
      raise exception using errcode = 'P0001', message = 'WORKSPACE_TRANSFER_ALREADY_COMMITTED';
    end if;
    update public.users
    set status = coalesce(archive_previous_status, 'suspended'),
        archive_previous_status = null,
        archive_started_at = null,
        archive_token = null,
        archive_phase = null,
        archive_event_id = null,
        archive_operator_user_id = null,
        archive_audit_metadata = null,
        archive_project_transfer = null
    where id = p_target_user_id;
    return;
  end if;

  if p_action = 'abort_pre_provider_suspension' then
    if v_target_status <> 'suspending' or v_suspension_phase <> 'prepared' then
      raise exception using errcode = 'P0001', message = 'RECOVERY_PRECONDITION_FAILED';
    end if;
    if v_suspension_token is distinct from p_expected_token then
      raise exception using errcode = 'P0001', message = 'SUSPENSION_TOKEN_MISMATCH';
    end if;
    if exists (
      select 1 from public.admin_workspace_transfer_events
      where event_id = v_suspension_event_id
    ) then
      raise exception using errcode = 'P0001', message = 'WORKSPACE_TRANSFER_ALREADY_COMMITTED';
    end if;
    update public.users
    set status = coalesce(suspension_previous_status, 'suspended'),
        suspension_previous_status = null,
        suspension_started_at = null,
        suspension_token = null,
        suspension_phase = null,
        suspension_event_id = null,
        suspension_operator_user_id = null,
        suspension_audit_metadata = null,
        suspension_project_transfer = null
    where id = p_target_user_id;
    return;
  end if;

  if p_action = 'clear_service_lease' then
    if v_target_status in ('archiving', 'suspending', 'deleted') or v_target_deleted_at is not null then
      raise exception using errcode = 'P0001', message = 'RECOVERY_PRECONDITION_FAILED';
    end if;
    if v_service_mutation_token is distinct from p_expected_token then
      raise exception using errcode = 'P0001', message = 'SERVICE_MUTATION_TOKEN_MISMATCH';
    end if;
    update public.users
    set service_mutation_token = null,
        service_mutation_started_at = null
    where id = p_target_user_id;
    return;
  end if;

  raise exception using errcode = 'P0001', message = 'INVALID_RECOVERY_ACTION';
end;
$$;

create or replace function public.admin_transfer_workspace_projects_atomic(
  p_event_id uuid,
  p_workspace_id uuid,
  p_project_ids uuid[],
  p_from_user_id uuid,
  p_to_user_id uuid,
  p_operator_user_id uuid default null
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_project_count integer;
  v_existing_plan_count integer;
  v_exact_plan_count integer;
  v_source_status text;
  v_source_deleted_at timestamptz;
  v_source_archive_event_id uuid;
  v_source_suspension_event_id uuid;
  v_recipient_status text;
  v_recipient_deleted_at timestamptz;
  v_recipient_archive_token uuid;
  v_recipient_archive_phase text;
  v_recipient_archive_started_at timestamptz;
  v_recipient_suspension_token uuid;
  v_recipient_suspension_phase text;
  v_recipient_suspension_started_at timestamptz;
begin
  if p_event_id is null or p_workspace_id is null or p_from_user_id is null or p_to_user_id is null then
    raise exception using errcode = 'P0001', message = 'INVALID_WORKSPACE_TRANSFER_PLAN';
  end if;
  if p_from_user_id = p_to_user_id then
    raise exception using errcode = 'P0001', message = 'INVALID_WORKSPACE_TRANSFER_TARGET';
  end if;
  select count(distinct project_id) into v_project_count from unnest(coalesce(p_project_ids, '{}'::uuid[])) project_id;
  if v_project_count = 0 or v_project_count <> cardinality(coalesce(p_project_ids, '{}'::uuid[])) then
    raise exception using errcode = 'P0001', message = 'INVALID_WORKSPACE_TRANSFER_PROJECTS';
  end if;

  perform 1 from public.workspaces where id = p_workspace_id for update;
  if not found then raise exception using errcode = 'P0001', message = 'WORKSPACE_NOT_FOUND'; end if;
  perform 1 from public.users where id in (p_from_user_id, p_to_user_id) order by id for update;
  if (select count(*) from public.users where id in (p_from_user_id, p_to_user_id)) <> 2 then
    raise exception using errcode = 'P0001', message = 'WORKSPACE_TRANSFER_USER_NOT_FOUND';
  end if;

  select count(*), count(*) filter (
    where project_id = any(p_project_ids)
      and from_user_id = p_from_user_id
      and to_user_id = p_to_user_id
  )
  into v_existing_plan_count, v_exact_plan_count
  from public.admin_workspace_transfer_plans
  where event_id = p_event_id and workspace_id = p_workspace_id;
  if v_existing_plan_count > 0 then
    if v_existing_plan_count = v_project_count and v_exact_plan_count = v_project_count then
      return v_project_count;
    end if;
    raise exception using errcode = 'P0001', message = 'WORKSPACE_TRANSFER_PLAN_CONFLICT';
  end if;

  select coalesce(status, 'active'), deleted_at, archive_event_id, suspension_event_id
  into v_source_status, v_source_deleted_at, v_source_archive_event_id, v_source_suspension_event_id
  from public.users where id = p_from_user_id;
  if v_source_deleted_at is not null or v_source_status not in ('archiving', 'suspending') then
    raise exception using errcode = 'P0001', message = 'WORKSPACE_TRANSFER_SOURCE_LIFECYCLE_INVALID';
  end if;
  if (v_source_status = 'archiving' and v_source_archive_event_id is distinct from p_event_id)
    or (v_source_status = 'suspending' and v_source_suspension_event_id is distinct from p_event_id) then
    raise exception using errcode = 'P0001', message = 'WORKSPACE_TRANSFER_EVENT_MISMATCH';
  end if;

  select coalesce(status, 'active'), deleted_at,
         archive_token, archive_phase, archive_started_at,
         suspension_token, suspension_phase, suspension_started_at
  into v_recipient_status, v_recipient_deleted_at,
       v_recipient_archive_token, v_recipient_archive_phase, v_recipient_archive_started_at,
       v_recipient_suspension_token, v_recipient_suspension_phase, v_recipient_suspension_started_at
  from public.users where id = p_to_user_id;
  if v_recipient_status <> 'active'
    or v_recipient_deleted_at is not null
    or v_recipient_archive_token is not null
    or v_recipient_archive_phase is not null
    or v_recipient_archive_started_at is not null
    or v_recipient_suspension_token is not null
    or v_recipient_suspension_phase is not null
    or v_recipient_suspension_started_at is not null then
    raise exception using errcode = 'P0001', message = 'WORKSPACE_TRANSFER_RECIPIENT_INELIGIBLE';
  end if;

  insert into public.admin_workspace_transfer_events(event_id, from_user_id)
  values (p_event_id, p_from_user_id)
  on conflict (event_id) do nothing;
  if not exists (
    select 1 from public.admin_workspace_transfer_events
    where event_id = p_event_id and from_user_id = p_from_user_id
  ) then
    raise exception using errcode = 'P0001', message = 'WORKSPACE_TRANSFER_EVENT_CONFLICT';
  end if;

  if exists (
    select 1 from public.admin_workspace_transfer_plans plan
    where plan.event_id = p_event_id and plan.project_id = any(p_project_ids)
      and (plan.workspace_id, plan.from_user_id, plan.to_user_id) is distinct from
          (p_workspace_id, p_from_user_id, p_to_user_id)
  ) then
    raise exception using errcode = 'P0001', message = 'WORKSPACE_TRANSFER_PLAN_CONFLICT';
  end if;

  perform 1 from public.projects
  where id = any(p_project_ids)
  order by id
  for update;
  if (
    select count(*) from public.projects
    where id = any(p_project_ids)
      and workspace_id = p_workspace_id
      and access_mode = 'team'
      and user_id in (p_from_user_id, p_to_user_id)
  ) <> v_project_count then
    raise exception using errcode = 'P0001', message = 'WORKSPACE_TRANSFER_PROJECT_MISMATCH';
  end if;

  insert into public.admin_workspace_transfer_plans(
    event_id, workspace_id, project_id, from_user_id, to_user_id, operator_user_id
  )
  select p_event_id, p_workspace_id, project_id, p_from_user_id, p_to_user_id, p_operator_user_id
  from unnest(p_project_ids) project_id
  on conflict (event_id, project_id) do nothing;

  insert into public.workspace_members(workspace_id, user_id, role)
  values (p_workspace_id, p_to_user_id, 'owner')
  on conflict (workspace_id, user_id) do update set role = 'owner';

  update public.projects
  set user_id = p_to_user_id
  where id = any(p_project_ids) and user_id = p_from_user_id;
  return v_project_count;
end;
$$;

revoke execute on function public.admin_transfer_workspace_projects_atomic(uuid, uuid, uuid[], uuid, uuid, uuid) from public, anon, authenticated;
grant execute on function public.admin_transfer_workspace_projects_atomic(uuid, uuid, uuid[], uuid, uuid, uuid) to service_role;

revoke execute on function public.admin_replace_user_roles_atomic(uuid, text[], uuid, uuid, jsonb) from public, anon, authenticated;
revoke execute on function public.admin_update_user_status_atomic(uuid, text, timestamptz, text, uuid, uuid, jsonb) from public, anon, authenticated;
revoke execute on function public.admin_prepare_user_suspension_atomic(uuid, uuid, uuid, jsonb) from public, anon, authenticated;
revoke execute on function public.admin_mark_suspension_projects_transferred(uuid, uuid, jsonb) from public, anon, authenticated;
revoke execute on function public.admin_mark_suspension_provider_revoking(uuid, uuid) from public, anon, authenticated;
revoke execute on function public.admin_mark_suspension_provider_revoked(uuid, uuid) from public, anon, authenticated;
revoke execute on function public.admin_suspend_user_atomic(uuid, uuid, uuid) from public, anon, authenticated;
revoke execute on function public.admin_begin_service_mutation(uuid, uuid) from public, anon, authenticated;
revoke execute on function public.admin_end_service_mutation(uuid, uuid) from public, anon, authenticated;
revoke execute on function public.admin_prepare_user_archive_atomic(uuid, uuid, uuid, jsonb) from public, anon, authenticated;
revoke execute on function public.admin_mark_archive_provider_revoking(uuid, uuid, uuid) from public, anon, authenticated;
revoke execute on function public.admin_mark_archive_provider_revoked(uuid, uuid, uuid) from public, anon, authenticated;
revoke execute on function public.admin_mark_archive_projects_transferred(uuid, uuid, uuid, jsonb) from public, anon, authenticated;
revoke execute on function public.admin_archive_user_atomic(uuid, uuid, timestamptz, uuid, jsonb) from public, anon, authenticated;
revoke execute on function public.admin_restore_user_atomic(uuid, uuid, uuid, jsonb) from public, anon, authenticated;
revoke execute on function public.admin_abort_user_archive_atomic(uuid, uuid, uuid) from public, anon, authenticated;
revoke execute on function public.admin_recover_account_mutation(uuid, uuid, uuid, text) from public, anon, authenticated;
revoke execute on function public.admin_sanitize_audit_text(text, integer) from public, anon, authenticated;
revoke execute on function public.admin_sanitize_audit_context(jsonb) from public, anon, authenticated;

grant execute on function public.admin_replace_user_roles_atomic(uuid, text[], uuid, uuid, jsonb) to service_role;
grant execute on function public.admin_update_user_status_atomic(uuid, text, timestamptz, text, uuid, uuid, jsonb) to service_role;
grant execute on function public.admin_prepare_user_suspension_atomic(uuid, uuid, uuid, jsonb) to service_role;
grant execute on function public.admin_mark_suspension_projects_transferred(uuid, uuid, jsonb) to service_role;
grant execute on function public.admin_mark_suspension_provider_revoking(uuid, uuid) to service_role;
grant execute on function public.admin_mark_suspension_provider_revoked(uuid, uuid) to service_role;
grant execute on function public.admin_suspend_user_atomic(uuid, uuid, uuid) to service_role;
grant execute on function public.admin_begin_service_mutation(uuid, uuid) to service_role;
grant execute on function public.admin_end_service_mutation(uuid, uuid) to service_role;
grant execute on function public.admin_prepare_user_archive_atomic(uuid, uuid, uuid, jsonb) to service_role;
grant execute on function public.admin_mark_archive_provider_revoking(uuid, uuid, uuid) to service_role;
grant execute on function public.admin_mark_archive_provider_revoked(uuid, uuid, uuid) to service_role;
grant execute on function public.admin_mark_archive_projects_transferred(uuid, uuid, uuid, jsonb) to service_role;
grant execute on function public.admin_archive_user_atomic(uuid, uuid, timestamptz, uuid, jsonb) to service_role;
grant execute on function public.admin_restore_user_atomic(uuid, uuid, uuid, jsonb) to service_role;
grant execute on function public.admin_abort_user_archive_atomic(uuid, uuid, uuid) to service_role;
grant execute on function public.admin_recover_account_mutation(uuid, uuid, uuid, text) to service_role;
grant execute on function public.admin_sanitize_audit_text(text, integer) to service_role;
grant execute on function public.admin_sanitize_audit_context(jsonb) to service_role;
