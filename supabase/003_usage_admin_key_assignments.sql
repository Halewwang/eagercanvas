-- Usage admin: map users to assigned 302 API keys

create table if not exists public.user_api_key_assignments (
  user_id uuid not null references public.users(id) on delete cascade,
  api_name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, api_name)
);

create index if not exists idx_user_api_key_assignments_api_name
  on public.user_api_key_assignments(api_name);

-- Reuse existing touch_updated_at function from prior migrations

drop trigger if exists trg_user_api_key_assignments_touch_updated_at on public.user_api_key_assignments;
create trigger trg_user_api_key_assignments_touch_updated_at
before update on public.user_api_key_assignments
for each row execute function public.touch_updated_at();

alter table public.user_api_key_assignments disable row level security;
