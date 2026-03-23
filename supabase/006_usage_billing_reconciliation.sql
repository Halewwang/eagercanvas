alter table public.usage_events
  add column if not exists api_name text,
  add column if not exists provider_request_id text,
  add column if not exists estimated_cost_usd numeric(12, 6) not null default 0,
  add column if not exists billed_cost_usd numeric(12, 6) not null default 0,
  add column if not exists billing_status text not null default 'estimated',
  add column if not exists raw_usage jsonb;

create index if not exists idx_usage_events_api_name_created_at
  on public.usage_events(api_name, created_at desc);

create index if not exists idx_usage_events_provider_request_id
  on public.usage_events(provider_request_id);
