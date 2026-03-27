create table if not exists public.workspaces (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.workspace_members (
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  role text not null default 'member' check (role in ('owner', 'member')),
  created_at timestamptz not null default now(),
  primary key (workspace_id, user_id)
);

create index if not exists idx_workspace_members_user_id on public.workspace_members(user_id);

create table if not exists public.shared_project_templates (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  source_project_id uuid not null references public.projects(id) on delete cascade,
  owner_user_id uuid not null references public.users(id) on delete cascade,
  owner_display_name text,
  title text not null,
  description text not null default '',
  cover_url text,
  canvas_json jsonb not null default '{}'::jsonb,
  is_published boolean not null default true,
  published_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, source_project_id)
);

create index if not exists idx_shared_project_templates_workspace_published
  on public.shared_project_templates(workspace_id, is_published, updated_at desc);

drop trigger if exists trg_workspaces_touch_updated_at on public.workspaces;
create trigger trg_workspaces_touch_updated_at
before update on public.workspaces
for each row execute function public.touch_updated_at();

drop trigger if exists trg_shared_project_templates_touch_updated_at on public.shared_project_templates;
create trigger trg_shared_project_templates_touch_updated_at
before update on public.shared_project_templates
for each row execute function public.touch_updated_at();

insert into public.workspaces (slug, name, is_default)
values ('shared-workspace', 'Shared Workspace', true)
on conflict (slug) do update
set
  name = excluded.name,
  is_default = excluded.is_default;

insert into public.workspace_members (workspace_id, user_id, role)
select w.id, u.id, 'member'
from public.workspaces w
join public.users u on true
where w.slug = 'shared-workspace'
on conflict (workspace_id, user_id) do nothing;
