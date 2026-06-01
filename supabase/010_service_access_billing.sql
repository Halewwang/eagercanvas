-- Service access credentials and official billing records

create table if not exists public.user_service_credentials (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  provider text not null default '302ai',
  internal_name text not null unique,
  provider_api_name text not null unique,
  api_key_last4 text,
  api_key_encrypted text,
  status text not null default 'active',
  limit_cost numeric(12, 4) not null default 0,
  limit_daily_cost numeric(12, 4) not null default 0,
  expired_on bigint not null default 0,
  created_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  disabled_at timestamptz,
  deleted_at timestamptz,
  last_error text,
  constraint user_service_credentials_status_check
    check (status in ('active', 'disabled', 'deleted', 'create_failed'))
);

create unique index if not exists idx_user_service_credentials_user_active
  on public.user_service_credentials(user_id)
  where status = 'active';

create index if not exists idx_user_service_credentials_user_status
  on public.user_service_credentials(user_id, status);

create index if not exists idx_user_service_credentials_provider_api_name
  on public.user_service_credentials(provider_api_name);

alter table public.user_service_credentials enable row level security;

drop policy if exists user_service_credentials_service_role_all
  on public.user_service_credentials;

create policy user_service_credentials_service_role_all
  on public.user_service_credentials
  for all
  to service_role
  using (true)
  with check (true);

create table if not exists public.provider_billing_records (
  id uuid primary key default gen_random_uuid(),
  provider text not null default '302ai',
  upstream_request_id text unique,
  upstream_task_id text,
  service_credential_id uuid references public.user_service_credentials(id) on delete set null,
  provider_api_name text,
  user_id uuid references public.users(id) on delete set null,
  run_id uuid references public.workflow_runs(id) on delete set null,
  usage_event_id uuid references public.usage_events(id) on delete set null,
  model text,
  endpoint text,
  status text,
  input_tokens integer not null default 0,
  output_tokens integer not null default 0,
  image_count integer not null default 0,
  video_seconds integer not null default 0,
  cost_amount numeric(12, 6) not null default 0,
  cost_currency text not null default 'USD',
  official_created_at timestamptz,
  synced_at timestamptz not null default now(),
  reconciliation_status text not null default 'matched',
  raw_record jsonb not null default '{}'::jsonb
);

create index if not exists idx_provider_billing_records_user_created
  on public.provider_billing_records(user_id, official_created_at desc);

create index if not exists idx_provider_billing_records_credential_created
  on public.provider_billing_records(service_credential_id, official_created_at desc);

create unique index if not exists idx_provider_billing_records_upstream_task_id_unique
  on public.provider_billing_records(upstream_task_id);

create index if not exists idx_provider_billing_records_provider_api_name_created
  on public.provider_billing_records(provider_api_name, official_created_at desc);

create index if not exists idx_provider_billing_records_model
  on public.provider_billing_records(model);

create index if not exists idx_provider_billing_records_reconciliation_status
  on public.provider_billing_records(reconciliation_status);

alter table public.provider_billing_records enable row level security;

drop policy if exists provider_billing_records_service_role_all
  on public.provider_billing_records;

create policy provider_billing_records_service_role_all
  on public.provider_billing_records
  for all
  to service_role
  using (true)
  with check (true);

alter table public.usage_events
  add column if not exists service_credential_id uuid references public.user_service_credentials(id) on delete set null,
  add column if not exists billing_record_id uuid references public.provider_billing_records(id) on delete set null,
  add column if not exists upstream_task_id text,
  add column if not exists client_request_id text;

create index if not exists idx_usage_events_service_credential_created_at
  on public.usage_events(service_credential_id, created_at desc);

create index if not exists idx_usage_events_upstream_task_id
  on public.usage_events(upstream_task_id);

insert into public.permissions (code, name, description) values
  ('admin.service_access.activate', 'Activate service access', 'Create a dedicated service credential for a user'),
  ('admin.service_access.disable', 'Disable service access', 'Disable a user service credential'),
  ('admin.service_access.reset', 'Reset service credential', 'Disable and recreate a user service credential'),
  ('admin.service_access.update_limits', 'Update service limits', 'Update user service credential limits'),
  ('admin.billing.reconcile', 'Run billing reconciliation', 'Synchronize and reconcile official provider billing records')
on conflict (code) do update set
  name = excluded.name,
  description = excluded.description;

insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r
join public.permissions p on p.code in (
  'admin.service_access.activate',
  'admin.service_access.disable',
  'admin.service_access.reset',
  'admin.service_access.update_limits',
  'admin.billing.reconcile'
)
where r.code in ('super_admin', 'admin')
on conflict (role_id, permission_id) do nothing;

insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r
join public.permissions p on p.code = 'admin.billing.reconcile'
where r.code = 'ops'
on conflict (role_id, permission_id) do nothing;
