-- Team workspaces and project-level permissions

alter table public.workspaces
  add column if not exists kind text not null default 'team',
  add column if not exists avatar_url text,
  add column if not exists created_by uuid references public.users(id) on delete set null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'workspaces_kind_check'
      and conrelid = 'public.workspaces'::regclass
  ) then
    alter table public.workspaces
      add constraint workspaces_kind_check check (kind in ('personal', 'public', 'team'));
  end if;
end $$;

alter table public.user_profiles
  add column if not exists username text;

create unique index if not exists idx_user_profiles_username_lower_unique
  on public.user_profiles(lower(username))
  where username is not null and btrim(username) <> '';

alter table public.projects
  add column if not exists workspace_id uuid references public.workspaces(id) on delete cascade,
  add column if not exists access_mode text not null default 'private';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'projects_access_mode_check'
      and conrelid = 'public.projects'::regclass
  ) then
    alter table public.projects
      add constraint projects_access_mode_check check (access_mode in ('private', 'team'));
  end if;
end $$;

alter table public.shared_project_templates
  add column if not exists owner_avatar_url text;

create table if not exists public.user_workspace_preferences (
  user_id uuid primary key references public.users(id) on delete cascade,
  active_workspace_id uuid references public.workspaces(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.workspace_invites (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  invite_type text not null check (invite_type in ('direct', 'link')),
  invitee_user_id uuid references public.users(id) on delete cascade,
  invitee_email text,
  token_hash text,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'revoked', 'expired')),
  created_by uuid not null references public.users(id) on delete cascade,
  expires_at timestamptz not null,
  accepted_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists idx_workspace_invites_token_hash_unique
  on public.workspace_invites(token_hash)
  where token_hash is not null;
create index if not exists idx_workspace_invites_workspace_status
  on public.workspace_invites(workspace_id, status, expires_at);
create index if not exists idx_workspace_invites_invitee_user
  on public.workspace_invites(invitee_user_id, status);
create index if not exists idx_workspace_invites_invitee_email
  on public.workspace_invites(lower(invitee_email), status)
  where invitee_email is not null;

create table if not exists public.project_members (
  project_id uuid not null references public.projects(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  role text not null check (role in ('owner', 'editor')),
  granted_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (project_id, user_id)
);

create index if not exists idx_project_members_user_id
  on public.project_members(user_id);

create table if not exists public.project_edit_requests (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  requester_user_id uuid not null references public.users(id) on delete cascade,
  reviewer_user_id uuid references public.users(id) on delete set null,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  message text,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists idx_project_edit_requests_unique_status
  on public.project_edit_requests(project_id, requester_user_id, status);
create index if not exists idx_project_edit_requests_project_status
  on public.project_edit_requests(project_id, status, created_at);

create table if not exists public.shared_project_template_favorites (
  user_id uuid not null references public.users(id) on delete cascade,
  template_id uuid not null references public.shared_project_templates(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, template_id)
);

create index if not exists idx_shared_project_template_favorites_template
  on public.shared_project_template_favorites(template_id);

drop trigger if exists trg_user_workspace_preferences_touch_updated_at on public.user_workspace_preferences;
create trigger trg_user_workspace_preferences_touch_updated_at
before update on public.user_workspace_preferences
for each row execute function public.touch_updated_at();

drop trigger if exists trg_workspace_invites_touch_updated_at on public.workspace_invites;
create trigger trg_workspace_invites_touch_updated_at
before update on public.workspace_invites
for each row execute function public.touch_updated_at();

drop trigger if exists trg_project_members_touch_updated_at on public.project_members;
create trigger trg_project_members_touch_updated_at
before update on public.project_members
for each row execute function public.touch_updated_at();

drop trigger if exists trg_project_edit_requests_touch_updated_at on public.project_edit_requests;
create trigger trg_project_edit_requests_touch_updated_at
before update on public.project_edit_requests
for each row execute function public.touch_updated_at();

insert into public.workspaces (slug, name, kind, is_default)
values ('shared-workspace', 'Community', 'public', true)
on conflict (slug) do update
set
  name = excluded.name,
  kind = excluded.kind,
  is_default = excluded.is_default;

insert into public.workspaces (slug, name, kind, is_default, avatar_url, created_by)
select
  'personal-' || u.id::text,
  u.id::text || ' Workspace',
  'personal',
  false,
  p.avatar_url,
  u.id
from public.users u
left join public.user_profiles p on p.user_id = u.id
on conflict (slug) do update
set
  kind = excluded.kind,
  avatar_url = excluded.avatar_url,
  created_by = excluded.created_by;

insert into public.workspace_members (workspace_id, user_id, role)
select w.id, u.id, 'owner'
from public.users u
join public.workspaces w on w.slug = 'personal-' || u.id::text
on conflict (workspace_id, user_id) do update
set role = 'owner';

update public.workspace_members wm
set role = 'owner'
from public.workspaces w
where wm.workspace_id = w.id
  and w.kind = 'personal';

do $$
begin
  if exists (
    select 1
    from pg_trigger
    where tgname = 'trg_projects_touch_updated_at'
      and tgrelid = 'public.projects'::regclass
  ) then
    alter table public.projects disable trigger trg_projects_touch_updated_at;
  end if;
end $$;

update public.projects p
set
  workspace_id = w.id,
  access_mode = 'private'
from public.workspaces w
where w.slug = 'personal-' || p.user_id::text
  and p.workspace_id is null;

do $$
begin
  if exists (
    select 1
    from pg_trigger
    where tgname = 'trg_projects_touch_updated_at'
      and tgrelid = 'public.projects'::regclass
  ) then
    alter table public.projects enable trigger trg_projects_touch_updated_at;
  end if;
end $$;

insert into public.user_workspace_preferences (user_id, active_workspace_id)
select u.id, w.id
from public.users u
join public.workspaces w on w.slug = 'personal-' || u.id::text
on conflict (user_id) do nothing;

create index if not exists idx_projects_workspace_updated_at
  on public.projects(workspace_id, updated_at desc);
create index if not exists idx_projects_workspace_access_mode
  on public.projects(workspace_id, access_mode, updated_at desc);
create index if not exists idx_projects_access_owner
  on public.projects(access_mode, user_id);
create index if not exists idx_workspaces_created_by
  on public.workspaces(created_by);
create index if not exists idx_user_workspace_preferences_active_workspace
  on public.user_workspace_preferences(active_workspace_id);

revoke all on table public.user_workspace_preferences from anon, authenticated;
revoke all on table public.workspace_invites from anon, authenticated;
revoke all on table public.project_members from anon, authenticated;
revoke all on table public.project_edit_requests from anon, authenticated;
revoke all on table public.shared_project_template_favorites from anon, authenticated;

alter table public.user_workspace_preferences enable row level security;
alter table public.workspace_invites enable row level security;
alter table public.project_members enable row level security;
alter table public.project_edit_requests enable row level security;
alter table public.shared_project_template_favorites enable row level security;

drop policy if exists user_workspace_preferences_service_role_all on public.user_workspace_preferences;
create policy user_workspace_preferences_service_role_all
on public.user_workspace_preferences
for all
to service_role
using (true)
with check (true);

drop policy if exists workspace_invites_service_role_all on public.workspace_invites;
create policy workspace_invites_service_role_all
on public.workspace_invites
for all
to service_role
using (true)
with check (true);

drop policy if exists project_members_service_role_all on public.project_members;
create policy project_members_service_role_all
on public.project_members
for all
to service_role
using (true)
with check (true);

drop policy if exists project_edit_requests_service_role_all on public.project_edit_requests;
create policy project_edit_requests_service_role_all
on public.project_edit_requests
for all
to service_role
using (true)
with check (true);

drop policy if exists shared_project_template_favorites_service_role_all on public.shared_project_template_favorites;
create policy shared_project_template_favorites_service_role_all
on public.shared_project_template_favorites
for all
to service_role
using (true)
with check (true);
