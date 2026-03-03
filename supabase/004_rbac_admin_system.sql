-- RBAC foundation for admin backoffice

create table if not exists public.roles (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  description text,
  created_at timestamptz not null default now()
);

create table if not exists public.permissions (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  description text,
  created_at timestamptz not null default now()
);

create table if not exists public.user_roles (
  user_id uuid not null references public.users(id) on delete cascade,
  role_id uuid not null references public.roles(id) on delete cascade,
  created_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (user_id, role_id)
);
create index if not exists idx_user_roles_role_id on public.user_roles(role_id);

create table if not exists public.role_permissions (
  role_id uuid not null references public.roles(id) on delete cascade,
  permission_id uuid not null references public.permissions(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (role_id, permission_id)
);
create index if not exists idx_role_permissions_permission_id on public.role_permissions(permission_id);

create table if not exists public.admin_operation_logs (
  id uuid primary key default gen_random_uuid(),
  operator_user_id uuid references public.users(id) on delete set null,
  target_user_id uuid references public.users(id) on delete set null,
  action text not null,
  metadata jsonb,
  created_at timestamptz not null default now()
);
create index if not exists idx_admin_operation_logs_operator_created_at
  on public.admin_operation_logs(operator_user_id, created_at desc);
create index if not exists idx_admin_operation_logs_target_created_at
  on public.admin_operation_logs(target_user_id, created_at desc);

alter table public.roles disable row level security;
alter table public.permissions disable row level security;
alter table public.user_roles disable row level security;
alter table public.role_permissions disable row level security;
alter table public.admin_operation_logs disable row level security;

insert into public.roles (code, name, description) values
  ('super_admin', 'Super Admin', 'Full control of all admin functions'),
  ('admin', 'Admin', 'Administrative management with high privilege scope'),
  ('ops', 'Ops', 'Operations role with read-focused capabilities'),
  ('support', 'Support', 'Customer support role with limited visibility'),
  ('user', 'User', 'Default role for regular users')
on conflict (code) do update set
  name = excluded.name,
  description = excluded.description;

insert into public.permissions (code, name, description) values
  ('admin.dashboard.read', 'Read admin dashboard', 'Access admin dashboard basic data'),
  ('admin.user.read', 'Read user list', 'View users in admin system'),
  ('admin.user.role.update', 'Update user role', 'Assign or remove user roles'),
  ('admin.user.status.update', 'Update user status', 'Ban/unban or activate/deactivate users'),
  ('admin.usage.read_all', 'Read global usage', 'View usage data across all users'),
  ('admin.api_key.assign', 'Assign API key', 'Assign or unassign API keys for users'),
  ('admin.api_key.manage', 'Manage API key', 'Create/update/delete upstream API keys'),
  ('admin.audit.read', 'Read admin audit logs', 'View admin operation logs')
on conflict (code) do update set
  name = excluded.name,
  description = excluded.description;

-- super_admin -> all permissions
insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r
join public.permissions p on true
where r.code = 'super_admin'
on conflict (role_id, permission_id) do nothing;

-- admin -> all operational permissions (same set as v1 super admin minus future-sensitive ops)
insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r
join public.permissions p on p.code in (
  'admin.dashboard.read',
  'admin.user.read',
  'admin.user.role.update',
  'admin.user.status.update',
  'admin.usage.read_all',
  'admin.api_key.assign',
  'admin.api_key.manage',
  'admin.audit.read'
)
where r.code = 'admin'
on conflict (role_id, permission_id) do nothing;

-- ops -> read only global usage and dashboard
insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r
join public.permissions p on p.code in (
  'admin.dashboard.read',
  'admin.user.read',
  'admin.usage.read_all',
  'admin.audit.read'
)
where r.code = 'ops'
on conflict (role_id, permission_id) do nothing;

-- support -> dashboard + user read
insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r
join public.permissions p on p.code in (
  'admin.dashboard.read',
  'admin.user.read'
)
where r.code = 'support'
on conflict (role_id, permission_id) do nothing;

-- ensure every existing account has at least one role (default user)
insert into public.user_roles (user_id, role_id)
select u.id, r.id
from public.users u
join public.roles r on r.code = 'user'
where not exists (
  select 1 from public.user_roles ur where ur.user_id = u.id
)
on conflict (user_id, role_id) do nothing;

-- Optional bootstrap for one super admin:
--   set app.bootstrap_super_admin_email = 'admin@example.com';
-- before running this migration in psql/supabase SQL editor.
do $$
declare
  bootstrap_email text;
begin
  bootstrap_email := nullif(current_setting('app.bootstrap_super_admin_email', true), '');
  if bootstrap_email is null then
    return;
  end if;

  insert into public.user_roles (user_id, role_id)
  select u.id, r.id
  from public.users u
  join public.roles r on r.code = 'super_admin'
  where lower(u.email) = lower(bootstrap_email)
  on conflict (user_id, role_id) do nothing;
end $$;
