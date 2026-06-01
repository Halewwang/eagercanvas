-- Supabase advisor remediation:
-- - keep SECURITY DEFINER helpers off public RPC roles
-- - make private backend tables explicit service-role-only under RLS
-- - add missing foreign-key indexes
-- - reduce RLS policy per-row auth function evaluation
-- - remove duplicate permissive SELECT policies

do $$
begin
  if to_regprocedure('public.has_permission(uuid, text)') is not null then
    revoke execute on function public.has_permission(uuid, text) from public, anon, authenticated;
    grant execute on function public.has_permission(uuid, text) to service_role;
  end if;

  if to_regprocedure('public.has_role(uuid, text)') is not null then
    revoke execute on function public.has_role(uuid, text) from public, anon, authenticated;
    grant execute on function public.has_role(uuid, text) to service_role;
  end if;

  if to_regprocedure('public.rls_auto_enable()') is not null then
    revoke execute on function public.rls_auto_enable() from public, anon, authenticated;
    grant execute on function public.rls_auto_enable() to service_role;
  end if;
end $$;

revoke all on table public.auth_codes from anon, authenticated;
revoke all on table public.sessions from anon, authenticated;
revoke all on table public.workspaces from anon, authenticated;
revoke all on table public.workspace_members from anon, authenticated;
revoke all on table public.shared_project_templates from anon, authenticated;

alter table public.auth_codes enable row level security;
alter table public.sessions enable row level security;
alter table public.workspaces enable row level security;
alter table public.workspace_members enable row level security;
alter table public.shared_project_templates enable row level security;

drop policy if exists auth_codes_service_role_all on public.auth_codes;
create policy auth_codes_service_role_all
on public.auth_codes
for all
to service_role
using (true)
with check (true);

drop policy if exists sessions_service_role_all on public.sessions;
create policy sessions_service_role_all
on public.sessions
for all
to service_role
using (true)
with check (true);

drop policy if exists workspaces_service_role_all on public.workspaces;
create policy workspaces_service_role_all
on public.workspaces
for all
to service_role
using (true)
with check (true);

drop policy if exists workspace_members_service_role_all on public.workspace_members;
create policy workspace_members_service_role_all
on public.workspace_members
for all
to service_role
using (true)
with check (true);

drop policy if exists shared_project_templates_service_role_all on public.shared_project_templates;
create policy shared_project_templates_service_role_all
on public.shared_project_templates
for all
to service_role
using (true)
with check (true);

create index if not exists idx_provider_billing_records_run_id
  on public.provider_billing_records(run_id);
create index if not exists idx_provider_billing_records_usage_event_id
  on public.provider_billing_records(usage_event_id);
create index if not exists idx_shared_project_templates_owner_user_id
  on public.shared_project_templates(owner_user_id);
create index if not exists idx_shared_project_templates_source_project_id
  on public.shared_project_templates(source_project_id);
create index if not exists idx_usage_daily_agg_user_id
  on public.usage_daily_agg(user_id);
create index if not exists idx_usage_events_billing_record_id
  on public.usage_events(billing_record_id);
create index if not exists idx_usage_events_run_id
  on public.usage_events(run_id);
create index if not exists idx_user_roles_created_by
  on public.user_roles(created_by);
create index if not exists idx_user_service_credentials_created_by
  on public.user_service_credentials(created_by);
create index if not exists idx_users_deleted_by
  on public.users(deleted_by);
create index if not exists idx_workflow_runs_project_id
  on public.workflow_runs(project_id);

drop policy if exists project_owner_select on public.projects;
create policy project_owner_select
on public.projects
for select
using ((select auth.uid()) = user_id);

drop policy if exists project_owner_write on public.projects;
drop policy if exists project_owner_insert on public.projects;
drop policy if exists project_owner_update on public.projects;
drop policy if exists project_owner_delete on public.projects;
create policy project_owner_insert
on public.projects
for insert
with check ((select auth.uid()) = user_id);
create policy project_owner_update
on public.projects
for update
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);
create policy project_owner_delete
on public.projects
for delete
using ((select auth.uid()) = user_id);

drop policy if exists audit_log_owner_select on public.audit_logs;
create policy audit_log_owner_select
on public.audit_logs
for select
using ((select auth.uid()) = user_id);

drop policy if exists workflow_run_owner_select on public.workflow_runs;
create policy workflow_run_owner_select
on public.workflow_runs
for select
using ((select auth.uid()) = user_id);

drop policy if exists usage_event_owner_select on public.usage_events;
create policy usage_event_owner_select
on public.usage_events
for select
using ((select auth.uid()) = user_id);

drop policy if exists usage_daily_agg_owner_select on public.usage_daily_agg;
create policy usage_daily_agg_owner_select
on public.usage_daily_agg
for select
using ((select auth.uid()) = user_id);

drop policy if exists user_api_key_assignment_self_select on public.user_api_key_assignments;
drop policy if exists user_api_key_assignments_self_or_admin_read on public.user_api_key_assignments;
create policy user_api_key_assignments_self_or_admin_read
on public.user_api_key_assignments
for select
using (
  (select auth.uid()) = user_id
  or has_permission((select auth.uid()), 'admin.api_key.assign')
  or has_permission((select auth.uid()), 'admin.usage.read_all')
);

drop policy if exists user_api_key_assignments_admin_write on public.user_api_key_assignments;
create policy user_api_key_assignments_admin_insert
on public.user_api_key_assignments
for insert
with check (has_permission((select auth.uid()), 'admin.api_key.assign'));
create policy user_api_key_assignments_admin_update
on public.user_api_key_assignments
for update
using (has_permission((select auth.uid()), 'admin.api_key.assign'))
with check (has_permission((select auth.uid()), 'admin.api_key.assign'));
create policy user_api_key_assignments_admin_delete
on public.user_api_key_assignments
for delete
using (has_permission((select auth.uid()), 'admin.api_key.assign'));

drop policy if exists rbac_admin_logs_audit_read on public.admin_operation_logs;
create policy rbac_admin_logs_audit_read
on public.admin_operation_logs
for select
using (
  (select auth.uid()) is not null
  and has_permission((select auth.uid()), 'admin.audit.read')
);

drop policy if exists rbac_permissions_admin_read on public.permissions;
create policy rbac_permissions_admin_read
on public.permissions
for select
using (
  (select auth.uid()) is not null
  and (
    has_permission((select auth.uid()), 'admin.user.read')
    or has_permission((select auth.uid()), 'admin.user.role.update')
  )
);

drop policy if exists rbac_role_permissions_admin_read on public.role_permissions;
create policy rbac_role_permissions_admin_read
on public.role_permissions
for select
using (
  (select auth.uid()) is not null
  and (
    has_permission((select auth.uid()), 'admin.user.read')
    or has_permission((select auth.uid()), 'admin.user.role.update')
  )
);

drop policy if exists rbac_roles_admin_read on public.roles;
create policy rbac_roles_admin_read
on public.roles
for select
using (
  (select auth.uid()) is not null
  and (
    has_permission((select auth.uid()), 'admin.user.read')
    or has_permission((select auth.uid()), 'admin.user.role.update')
  )
);

drop policy if exists rbac_user_roles_self_or_admin_read on public.user_roles;
create policy rbac_user_roles_self_or_admin_read
on public.user_roles
for select
using (
  (select auth.uid()) = user_id
  or has_permission((select auth.uid()), 'admin.user.read')
  or has_permission((select auth.uid()), 'admin.user.role.update')
);

drop policy if exists rbac_user_roles_admin_write on public.user_roles;
create policy rbac_user_roles_admin_insert
on public.user_roles
for insert
with check (has_permission((select auth.uid()), 'admin.user.role.update'));
create policy rbac_user_roles_admin_update
on public.user_roles
for update
using (has_permission((select auth.uid()), 'admin.user.role.update'))
with check (has_permission((select auth.uid()), 'admin.user.role.update'));
create policy rbac_user_roles_admin_delete
on public.user_roles
for delete
using (has_permission((select auth.uid()), 'admin.user.role.update'));

drop policy if exists user_profile_self_select on public.user_profiles;
drop policy if exists user_profile_self_write on public.user_profiles;
drop policy if exists user_profiles_self_or_admin_read on public.user_profiles;
create policy user_profiles_self_or_admin_read
on public.user_profiles
for select
using (
  (select auth.uid()) = user_id
  or has_permission((select auth.uid()), 'admin.user.read')
);

drop policy if exists user_profiles_self_write on public.user_profiles;
create policy user_profiles_self_insert
on public.user_profiles
for insert
with check ((select auth.uid()) = user_id);
create policy user_profiles_self_update
on public.user_profiles
for update
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);
create policy user_profiles_self_delete
on public.user_profiles
for delete
using ((select auth.uid()) = user_id);

drop policy if exists user_self_select on public.users;
create policy user_self_select
on public.users
for select
using ((select auth.uid()) = id);
