-- Provider usage synchronization runs, cumulative snapshots, and billing summary.

create table if not exists public.provider_usage_sync_runs (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  status text not null check (status in ('running', 'completed', 'partial', 'failed')),
  requested_by uuid references public.users(id) on delete set null,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  total_keys integer not null default 0 check (total_keys >= 0),
  succeeded_keys integer not null default 0 check (succeeded_keys >= 0),
  failed_keys integer not null default 0 check (failed_keys >= 0),
  matched_users integer not null default 0 check (matched_users >= 0),
  unmatched_keys integer not null default 0 check (unmatched_keys >= 0),
  error_summary jsonb
);

create table if not exists public.provider_usage_snapshots (
  id uuid primary key default gen_random_uuid(),
  sync_run_id uuid not null references public.provider_usage_sync_runs(id) on delete cascade,
  provider text not null,
  api_name text not null,
  user_id uuid references public.users(id) on delete set null,
  service_credential_id uuid references public.user_service_credentials(id) on delete set null,
  total_amount numeric(18,6),
  currency text,
  snapshot_at timestamptz not null default now(),
  status text not null check (status in ('success', 'unmatched', 'failed')),
  error_code text,
  unique (sync_run_id, provider, api_name)
);

create index if not exists idx_provider_usage_snapshots_user_time
  on public.provider_usage_snapshots(user_id, snapshot_at desc);

create index if not exists idx_provider_usage_snapshots_api_time
  on public.provider_usage_snapshots(api_name, snapshot_at desc);

create index if not exists idx_provider_usage_snapshots_run
  on public.provider_usage_snapshots(sync_run_id);

create or replace view public.admin_provider_billing_user_model_summary
with (security_invoker = true) as
select
  user_id,
  coalesce(model, 'unknown') as model,
  cost_currency,
  count(*)::bigint as call_count,
  sum(input_tokens)::bigint as input_tokens,
  sum(output_tokens)::bigint as output_tokens,
  sum(image_count)::bigint as image_count,
  sum(video_seconds)::bigint as video_seconds,
  sum(cost_amount) as cost_amount
from public.provider_billing_records
where user_id is not null
group by user_id, coalesce(model, 'unknown'), cost_currency;

revoke all on table public.provider_usage_sync_runs
  from public, anon, authenticated, service_role;
revoke all on table public.provider_usage_snapshots
  from public, anon, authenticated, service_role;
grant select, insert, update, delete on table public.provider_usage_sync_runs
  to service_role;
grant select, insert, update, delete on table public.provider_usage_snapshots
  to service_role;

revoke all on public.admin_provider_billing_user_model_summary
  from public, anon, authenticated, service_role;
grant select on public.admin_provider_billing_user_model_summary
  to service_role;

alter table public.provider_usage_sync_runs enable row level security;
alter table public.provider_usage_snapshots enable row level security;

drop policy if exists provider_usage_sync_runs_service_role
  on public.provider_usage_sync_runs;
drop policy if exists provider_usage_snapshots_service_role
  on public.provider_usage_snapshots;

create policy provider_usage_sync_runs_service_role
  on public.provider_usage_sync_runs
  for all
  to service_role
  using (true)
  with check (true);

create policy provider_usage_snapshots_service_role
  on public.provider_usage_snapshots
  for all
  to service_role
  using (true)
  with check (true);
