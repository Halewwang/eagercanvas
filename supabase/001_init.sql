-- Extensions
create extension if not exists pgcrypto;

-- users
create table if not exists public.users (
  id uuid primary key default gen_random_uuid(),
  email text unique not null,
  created_at timestamptz not null default now()
);

-- login verification codes
create table if not exists public.auth_codes (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  code_hash text not null,
  expires_at timestamptz not null,
  used boolean not null default false,
  used_at timestamptz,
  created_ip text,
  used_ip text,
  created_at timestamptz not null default now()
);
create index if not exists idx_auth_codes_email_created_at on public.auth_codes(email, created_at desc);

-- refresh token sessions
create table if not exists public.sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  refresh_token_hash text not null unique,
  expires_at timestamptz not null,
  revoked boolean not null default false,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists idx_sessions_user_id on public.sessions(user_id);

-- projects
create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  name text not null,
  canvas_json jsonb not null default '{}'::jsonb,
  thumbnail_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_projects_user_id_updated_at on public.projects(user_id, updated_at desc);

-- workflow runs
create table if not exists public.workflow_runs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  project_id uuid references public.projects(id) on delete set null,
  type text not null,
  status text not null,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  error_msg text,
  created_at timestamptz not null default now()
);
create index if not exists idx_workflow_runs_user_id_started_at on public.workflow_runs(user_id, started_at desc);

-- usage events (atomic)
create table if not exists public.usage_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  run_id uuid references public.workflow_runs(id) on delete set null,
  provider text,
  model text,
  event_type text not null,
  input_tokens integer not null default 0,
  output_tokens integer not null default 0,
  image_count integer not null default 0,
  video_seconds integer not null default 0,
  cost_usd numeric(12, 6) not null default 0,
  latency_ms integer not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists idx_usage_events_user_id_created_at on public.usage_events(user_id, created_at desc);

-- daily aggregate
create table if not exists public.usage_daily_agg (
  date date not null,
  user_id uuid not null references public.users(id) on delete cascade,
  total_calls integer not null default 0,
  total_tokens integer not null default 0,
  total_images integer not null default 0,
  total_video_seconds integer not null default 0,
  total_cost_usd numeric(12, 6) not null default 0,
  updated_at timestamptz not null default now(),
  primary key (date, user_id)
);

-- audit logs
create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.users(id) on delete set null,
  action text not null,
  metadata jsonb,
  created_at timestamptz not null default now()
);
create index if not exists idx_audit_logs_user_id_created_at on public.audit_logs(user_id, created_at desc);

-- update timestamp trigger
create or replace function public.touch_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_projects_touch_updated_at on public.projects;
create trigger trg_projects_touch_updated_at
before update on public.projects
for each row execute function public.touch_updated_at();

-- RLS baseline
alter table public.users enable row level security;
alter table public.projects enable row level security;
alter table public.workflow_runs enable row level security;
alter table public.usage_events enable row level security;
alter table public.usage_daily_agg enable row level security;
alter table public.audit_logs enable row level security;

-- JWT-based RLS policies (for future direct supabase access)
do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'projects' and policyname = 'project_owner_select'
  ) then
    create policy project_owner_select on public.projects
    for select using (auth.uid() = user_id);
  end if;

  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'projects' and policyname = 'project_owner_write'
  ) then
    create policy project_owner_write on public.projects
    for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
  end if;
end $$;
