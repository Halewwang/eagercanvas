-- User account lifecycle for admin management

alter table public.users
  add column if not exists status text not null default 'active',
  add column if not exists suspended_at timestamptz,
  add column if not exists suspended_reason text,
  add column if not exists deleted_at timestamptz,
  add column if not exists deleted_by uuid references public.users(id) on delete set null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'users_status_check'
  ) then
    alter table public.users
      add constraint users_status_check check (status in ('active', 'suspended', 'deleted'));
  end if;
end $$;

create index if not exists idx_users_status_created_at
  on public.users(status, created_at desc);

update public.users
set status = 'active'
where status is null or status not in ('active', 'suspended', 'deleted');
