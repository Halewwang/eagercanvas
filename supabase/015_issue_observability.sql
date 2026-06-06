-- Issue observability: online issue events, grouped handoff, and notification outbox.

create table if not exists public.issue_events (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  source_layer text not null,
  category text not null,
  severity text not null,
  environment text not null,
  build_id text,
  release_commit text,
  user_id uuid references public.users(id) on delete set null,
  session_hash text,
  request_id text,
  trace_id text,
  route text,
  route_name text,
  component text,
  method text,
  path_template text,
  status_code integer,
  duration_ms integer,
  provider text,
  model text,
  upstream_endpoint text,
  upstream_status integer,
  db_table text,
  db_operation text,
  db_code text,
  error_code text,
  message_summary text,
  stack_summary text,
  fingerprint text not null,
  metadata jsonb not null default '{}'::jsonb,
  constraint issue_events_source_layer_check
    check (source_layer in ('frontend', 'backend', 'database', 'provider', 'performance', 'ux')),
  constraint issue_events_severity_check
    check (severity in ('p0', 'p1', 'p2', 'p3'))
);

create index if not exists idx_issue_events_fingerprint_created_at
  on public.issue_events(fingerprint, created_at desc);
create index if not exists idx_issue_events_created_at
  on public.issue_events(created_at desc);
create index if not exists idx_issue_events_source_category_created_at
  on public.issue_events(source_layer, category, created_at desc);
create index if not exists idx_issue_events_request_id
  on public.issue_events(request_id)
  where request_id is not null;
create index if not exists idx_issue_events_user_created_at
  on public.issue_events(user_id, created_at desc)
  where user_id is not null;

create table if not exists public.issue_groups (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  first_seen_at timestamptz not null,
  last_seen_at timestamptz not null,
  fingerprint text not null unique,
  source_layer text not null,
  category text not null,
  severity text not null,
  status text not null default 'open',
  title text not null,
  event_count integer not null default 0,
  affected_users integer not null default 0,
  affected_sessions integer not null default 0,
  affected_routes integer not null default 0,
  affected_builds integer not null default 0,
  latest_build_id text,
  latest_release_commit text,
  latest_request_id text,
  sample_event_ids uuid[] not null default '{}',
  root_cause_layer text,
  root_cause_confidence text not null default 'unknown',
  evidence_summary jsonb not null default '{}'::jsonb,
  codex_handoff jsonb not null default '{}'::jsonb,
  last_notified_at timestamptz,
  notification_count integer not null default 0,
  constraint issue_groups_source_layer_check
    check (source_layer in ('frontend', 'backend', 'database', 'provider', 'performance', 'ux')),
  constraint issue_groups_severity_check
    check (severity in ('p0', 'p1', 'p2', 'p3')),
  constraint issue_groups_status_check
    check (status in ('open', 'investigating', 'resolved', 'ignored')),
  constraint issue_groups_confidence_check
    check (root_cause_confidence in ('high', 'medium', 'low', 'unknown'))
);

create index if not exists idx_issue_groups_status_severity_last_seen
  on public.issue_groups(status, severity, last_seen_at desc);
create index if not exists idx_issue_groups_source_category_last_seen
  on public.issue_groups(source_layer, category, last_seen_at desc);

create table if not exists public.issue_notifications (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  issue_group_id uuid not null references public.issue_groups(id) on delete cascade,
  channel text not null default 'email',
  recipient text not null,
  status text not null default 'queued',
  reason text,
  payload jsonb not null default '{}'::jsonb,
  attempts integer not null default 0,
  next_retry_at timestamptz,
  resend_message_id text,
  sent_at timestamptz,
  failed_at timestamptz,
  error_message text,
  constraint issue_notifications_channel_check
    check (channel in ('email')),
  constraint issue_notifications_status_check
    check (status in ('queued', 'sent', 'failed', 'skipped'))
);

create index if not exists idx_issue_notifications_status_next_retry
  on public.issue_notifications(status, next_retry_at, created_at);
create index if not exists idx_issue_notifications_issue_group_created_at
  on public.issue_notifications(issue_group_id, created_at desc);

revoke all on table public.issue_events from anon, authenticated;
revoke all on table public.issue_groups from anon, authenticated;
revoke all on table public.issue_notifications from anon, authenticated;

alter table public.issue_events enable row level security;
alter table public.issue_groups enable row level security;
alter table public.issue_notifications enable row level security;

drop policy if exists issue_events_service_role_all on public.issue_events;
create policy issue_events_service_role_all
on public.issue_events
for all
to service_role
using (true)
with check (true);

drop policy if exists issue_groups_service_role_all on public.issue_groups;
create policy issue_groups_service_role_all
on public.issue_groups
for all
to service_role
using (true)
with check (true);

drop policy if exists issue_notifications_service_role_all on public.issue_notifications;
create policy issue_notifications_service_role_all
on public.issue_notifications
for all
to service_role
using (true)
with check (true);

insert into public.permissions (code, name, description) values
  ('admin.issue.read', 'Read issue inbox', 'View issue observability groups and events'),
  ('admin.issue.export', 'Export issue inbox', 'Export issue groups to Codex handoff files'),
  ('admin.issue.update', 'Update issue inbox', 'Update issue status and triage fields'),
  ('admin.issue.notify', 'Notify issue inbox', 'Send or retry issue alert notifications')
on conflict (code) do update set
  name = excluded.name,
  description = excluded.description;

insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r
join public.permissions p on p.code in (
  'admin.issue.read',
  'admin.issue.export',
  'admin.issue.update',
  'admin.issue.notify'
)
where r.code in ('super_admin', 'admin')
on conflict (role_id, permission_id) do nothing;

insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r
join public.permissions p on p.code in (
  'admin.issue.read',
  'admin.issue.export',
  'admin.issue.notify'
)
where r.code = 'ops'
on conflict (role_id, permission_id) do nothing;

insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r
join public.permissions p on p.code = 'admin.issue.read'
where r.code = 'support'
on conflict (role_id, permission_id) do nothing;
