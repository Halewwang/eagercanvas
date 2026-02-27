-- Registration & profile extensions

-- add purpose to auth_codes for login/register separation
alter table public.auth_codes
  add column if not exists purpose text not null default 'login';

create index if not exists idx_auth_codes_email_purpose_created_at
  on public.auth_codes(email, purpose, created_at desc);

-- separate storage for registered user info
create table if not exists public.user_profiles (
  user_id uuid primary key references public.users(id) on delete cascade,
  display_name text,
  avatar_url text,
  registered_ip text,
  registered_at timestamptz not null default now(),
  last_login_at timestamptz,
  login_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_user_profiles_registered_at
  on public.user_profiles(registered_at desc);

-- updated_at trigger for user_profiles
create or replace function public.touch_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_user_profiles_touch_updated_at on public.user_profiles;
create trigger trg_user_profiles_touch_updated_at
before update on public.user_profiles
for each row execute function public.touch_updated_at();

-- RLS is disabled for server-side service-role access in this project
alter table public.user_profiles disable row level security;

-- Backward compatibility for already-created table
alter table public.user_profiles add column if not exists avatar_url text;
