alter table public.project_members
  drop constraint if exists project_members_role_check;

alter table public.project_members
  add constraint project_members_role_check
  check (role in ('owner', 'editor', 'viewer'));

create index if not exists idx_project_members_user_role
  on public.project_members(user_id, role);
