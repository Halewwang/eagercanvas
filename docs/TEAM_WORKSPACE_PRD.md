# Team Workspace Sharing PRD

Date: 2026-06-02
Status: Reviewed for MVP implementation; product follow-ups are listed below

## Goal

Add personal and team workspace isolation to the project and Share Templates experience. Users keep a personal workspace, can switch into team workspaces, and can create team-scoped projects that are visible to all team members by default.

The feature should solve the current privacy problem: shared project templates are visible to every user because the backend forces every user into one default shared workspace.

## Implementation Review

The MVP build is scoped to Workspace, Projects, Share Templates, and Canvas permission guardrails. It preserves Personal Workspace behavior, adds team workspace creation/switching/invites/leave-transfer flows, makes team projects visible to team members as read-only by default, and enforces edit access on the backend before project mutations.

The implementation intentionally does not change node models, node parameter schemas, AI provider selection, generation request payloads, or canvas node integration logic for this workspace feature.

## Inputs And References

- User-provided screenshots:
  - Workspace switcher and create workspace modal inspired by Fuser-style workspace controls.
  - Shared-space interaction reference with left workspace switcher, `Shared with me`, `Workspace` and `Private` sidebar sections, and top tabs such as `Community`, `Workspace`, `My Techniques`, and `Favorites`.
- Product inspiration: FLORA positions creative AI work around one unified creative environment and team iteration; Fuser positions workspace, canvas, workflows/templates, and Teams as one collaboration surface.
- Repo evidence:
  - `supabase/009_workspace_shared_templates.sql` already creates `workspaces`, `workspace_members`, and `shared_project_templates`.
  - `supabase/001_init.sql` creates `projects` with `user_id`, so project ownership currently belongs to one user and has no workspace/team scope.
  - `backend/src/services/workspace.service.js` currently uses `DEFAULT_WORKSPACE_SLUG = 'shared-workspace'` and `getCurrentWorkspace()` upserts every user into that workspace.
  - `backend/src/routes/workspace.routes.js` exposes only `/workspace/current`, `/workspace/current/templates`, template status, publish, unpublish, and use-template routes.
  - `src/stores/workspace.js` holds only `currentWorkspace` and `featuredTemplates`.
  - `src/views/Workspace.vue` renders `My Project` and `Share Templates`; `WorkspaceSidebar.vue` shows the current workspace brand; `WorkspaceCardsGrid.vue` renders project/template cards.
  - `src/components/canvas/CanvasShareModal.vue` already shows a workspace section and delegates share actions through `useCanvasProjectActions.js`.

## Problem Statement

The existing shared-template implementation has the right base tables but the wrong membership model for privacy. A single default workspace is treated as the current workspace for everyone, and all users are inserted into it. As a result, publishing a project template is effectively public.

The new model must separate:

- Personal workspace: private project creation and management for the current user.
- Team workspace: team project creation, project list visibility, read-only project entry for all team members, and edit access controlled by the project creator/manager.
- Public shared templates: fallback community-style template surface when the user has no team context or explicitly switches to public template browsing.
- Team shared templates/projects: visible only to members of the selected team workspace.

## MVP Requirements

1. Users keep a personal workspace and can switch team workspaces.
   - Personal Workspace remains available after joining a team.
   - The workspace page left/top area shows the active workspace name and avatar.
   - A dropdown shows available workspaces and actions.
   - Users can create a team workspace from the dropdown.
   - Users can switch between Personal Workspace and joined team workspaces.
   - Users can leave a team workspace from the dropdown.
   - Creating a project uses the currently active workspace by default.

2. Creating a team opens a modal.
   - User enters a workspace name.
   - Creator can upload a team avatar during creation or after creation.
   - A URL slug is generated from the name and can be edited before creation.
   - After creation, the backend generates a 7-day invite link that can be copied and shared.

3. Invites support two modes.
   - Direct invite by username or email.
   - Link invite with a 7-day expiration.
   - Joining by either invite sets that team as the active workspace.

4. Team workspace projects are visible to team members by default.
   - Projects created while a team workspace is active are stored in that team workspace.
   - All members of that team can see those projects in the team project list.
   - All members of that team can enter the project in read-only mode.
   - Editing requires project-level edit permission.
   - The project creator/manager owns approval for edit requests.

5. Team project edit permission is request-based.
   - A team member without edit permission can request edit access from the project page.
   - The project creator/manager can approve or reject the request.
   - Approved users can edit the project; unapproved users remain read-only.

6. Share Templates shows the right template scope.
   - If the active workspace is a team, show that team's shared templates/projects.
   - If the active workspace is personal and the user has no team context, show public shared templates as the fallback.
   - If the user belongs to multiple teams, the workspace switcher determines the active team.
   - Team-published templates do not appear in the public shared-template fallback.

7. Team-shared project/template cards show the sharer's avatar.
   - Cards in Share Templates display the template owner's avatar in the upper-left corner.
   - If no avatar exists, show owner initials or a deterministic fallback.

8. Leaving a team requires ownership transfer when needed.
   - If the leaving user owns or manages team projects, they must transfer those project management permissions to another team member before exit.
   - If the leaving user is the only team owner, team ownership must also be transferred before exit.
   - Transfer target must be an existing member of that team.
   - For project management transfer, prefer a user who already has a `project_members` row; if no eligible project member exists, the selected team member is added as the new project owner during transfer.

## Non-Goals For MVP

- Real-time collaborative editing inside the canvas.
- Shared folders for project source files.
- Billing, quota, or usage allocation by team.
- Fine-grained role hierarchy beyond workspace `owner/member` and project `owner/editor/viewer`.
- Admin dashboard management for team spaces.
- Simultaneous multi-user conflict resolution beyond the existing canvas/project optimistic locking behavior.

## Recommended Architecture

Reuse the existing workspace abstraction and make it real:

- `workspaces` becomes the canonical shared-scope entity.
- `workspace_members` controls access to team workspaces.
- `projects.workspace_id` becomes the project-list and project-read visibility boundary.
- `project_members` controls project edit permission.
- `project_edit_requests` tracks team members asking the creator/manager for edit access.
- `shared_project_templates.workspace_id` remains the reusable-template isolation boundary.
- The backend resolves a user's active workspace before listing projects, creating projects, reading projects, updating projects, publishing templates, unpublishing templates, or using templates.
- The frontend stores a list of available spaces plus the active workspace and passes that context into the workspace page, project store, and Canvas permission state.

This is the smallest safe path that satisfies the new requirements because it preserves the existing canvas/project persistence flow while adding workspace scope and explicit project edit permissions.

## Data Model

Add one migration after the existing Supabase migrations.

### `workspaces`

Existing table; extend it:

```sql
alter table public.workspaces
  add column if not exists kind text not null default 'team',
  add column if not exists avatar_url text,
  add column if not exists created_by uuid references public.users(id) on delete set null;

alter table public.workspaces
  add constraint workspaces_kind_check
  check (kind in ('personal', 'public', 'team'));
```

Migration behavior:

- Existing `shared-workspace` becomes `kind = 'public'`.
- Its display name should become `Public Workspace` or the current product-approved public name.
- Each existing user gets a `kind = 'personal'` workspace.
- Existing projects are assigned to the owning user's personal workspace.
- New user-created spaces use `kind = 'team'`.
- `slug` stays globally unique and remains the readable URL segment.
- Team `avatar_url` can be set by the creator during team creation and updated by the team owner.

### `user_profiles`

Existing table; extend it so direct username invitations can target a stable unique identifier instead of fuzzy display names:

```sql
alter table public.user_profiles
  add column if not exists username text;

create unique index if not exists idx_user_profiles_username_lower
  on public.user_profiles (lower(username))
  where username is not null and username <> '';
```

Direct invite lookup accepts either `users.email` or `user_profiles.username`.

### `workspace_members`

Existing table; keep the current `owner/member` model for MVP.

Required behavior:

- Creating a team inserts the creator as `owner`.
- Joining a team inserts the user as `member`.
- Leaving a team deletes the current user's membership unless owner-exit rules block it.
- Personal workspace inserts the user as `owner`.
- Public workspace does not need membership for access checks.

### `workspace_invites`

Create a dedicated invite table instead of using slug as the secret. Slugs are guessable; invite links should be unguessable. The same table supports direct username/email invitations and link invitations.

```sql
create table if not exists public.workspace_invites (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  invite_type text not null check (invite_type in ('direct', 'link')),
  token_hash text unique,
  invitee_user_id uuid references public.users(id) on delete cascade,
  invitee_email text,
  created_by uuid references public.users(id) on delete set null,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'revoked', 'expired')),
  expires_at timestamptz not null,
  accepted_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_workspace_invites_workspace_id
  on public.workspace_invites(workspace_id);
create index if not exists idx_workspace_invites_invitee_user_id
  on public.workspace_invites(invitee_user_id);
create index if not exists idx_workspace_invites_invitee_email
  on public.workspace_invites(invitee_email);
```

Backend returns the raw invite token only for link invitations. The database stores only a hash. Link invitations always set `expires_at = now() + interval '7 days'`. Direct invitations can be accepted by a matched registered `invitee_user_id` or by email after the invitee registers/logs in with that email.

### `user_workspace_preferences`

Store the user's active workspace:

```sql
create table if not exists public.user_workspace_preferences (
  user_id uuid primary key references public.users(id) on delete cascade,
  active_workspace_id uuid references public.workspaces(id) on delete set null,
  updated_at timestamptz not null default now()
);
```

Backend must validate that `active_workspace_id` is either the user's personal workspace or a team workspace where the user is a member. Public community templates are browsed as a template scope, not as the default project-creation workspace.

### `projects`

Existing table; extend it:

```sql
alter table public.projects
  add column if not exists workspace_id uuid references public.workspaces(id) on delete set null,
  add column if not exists access_mode text not null default 'private'
    check (access_mode in ('private', 'team'));

create index if not exists idx_projects_workspace_updated_at
  on public.projects(workspace_id, updated_at desc);
```

Project behavior:

- Personal workspace projects use `access_mode = 'private'` and are visible only to the owning user.
- Team workspace projects use `access_mode = 'team'` and are visible to all members of that team.
- Existing `projects.user_id` remains the project creator/manager field for compatibility.
- Creating a project while active workspace is team sets `workspace_id` to that team and `access_mode = 'team'`.
- Creating a project while active workspace is personal sets `workspace_id` to the user's personal workspace and `access_mode = 'private'`.

### `project_members`

Tracks project-level edit permission. Team members get read-only access through workspace membership; they do not need a `project_members` row unless they can edit or manage.

```sql
create table if not exists public.project_members (
  project_id uuid not null references public.projects(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  role text not null check (role in ('owner', 'editor')),
  granted_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (project_id, user_id)
);

create index if not exists idx_project_members_user_id
  on public.project_members(user_id);
```

### `project_edit_requests`

Tracks edit access requests from read-only team members.

```sql
create table if not exists public.project_edit_requests (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  requester_user_id uuid not null references public.users(id) on delete cascade,
  reviewer_user_id uuid references public.users(id) on delete set null,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected', 'cancelled')),
  message text,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (project_id, requester_user_id, status)
);

create index if not exists idx_project_edit_requests_project_status
  on public.project_edit_requests(project_id, status, created_at desc);
```

### `shared_project_templates`

Keep the table and `workspace_id` isolation for reusable templates/techniques. No schema change is required for owner avatars if the backend batch-loads `user_profiles.avatar_url` by `owner_user_id` when listing templates.

API template payload should add:

```js
{
  ownerAvatarUrl: string,
  workspaceKind: 'public' | 'team',
  workspaceName: string
}
```

### `shared_project_template_favorites`

Supports the `Favorites` tab from the shared-space interaction reference.

```sql
create table if not exists public.shared_project_template_favorites (
  user_id uuid not null references public.users(id) on delete cascade,
  template_id uuid not null references public.shared_project_templates(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, template_id)
);

create index if not exists idx_shared_project_template_favorites_template_id
  on public.shared_project_template_favorites(template_id);
```

## Backend API

Keep existing `/api/v1/workspace/current/*` endpoints but change how current workspace is resolved.

### New endpoints

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/workspace/spaces` | List Personal Workspace, public template fallback, joined team workspaces, pending direct invites, and active workspace. |
| `POST` | `/workspace/spaces` | Create a team workspace with optional avatar upload URL/payload and return `workspace` plus 7-day `inviteLink`. |
| `PUT` | `/workspace/current` | Set active workspace by `workspaceId`. |
| `POST` | `/workspace/spaces/:workspaceId/invites/direct` | Invite by username or email. |
| `POST` | `/workspace/invites/:token/join` | Join a team by invite token and set it active. |
| `POST` | `/workspace/spaces/:workspaceId/invite-link` | Owner regenerates or creates a 7-day copyable invite link. |
| `POST` | `/workspace/invites/:inviteId/accept` | Accept a direct username/email invite. |
| `DELETE` | `/workspace/spaces/:workspaceId/members/me` | Leave the team workspace with required ownership/project transfer payload. |
| `GET` | `/workspace/spaces/:workspaceId/transfer-targets` | List team members eligible to receive team ownership or project management transfer. |
| `GET` | `/workspace/templates?scope=community\|workspace\|my\|favorites` | Back the template tabs from the interaction reference. |
| `POST` | `/workspace/templates/:templateId/favorite` | Add template to the current user's favorites. |
| `DELETE` | `/workspace/templates/:templateId/favorite` | Remove template from the current user's favorites. |

### Existing endpoints with changed behavior

| Method | Path | New behavior |
| --- | --- | --- |
| `GET` | `/workspace/current` | Return active personal/team workspace if valid; otherwise personal workspace. Do not upsert all users into public membership. |
| `GET` | `/workspace/current/templates` | Compatibility endpoint for active workspace templates; new tabbed UI should use `/workspace/templates?scope=...`. |
| `GET` | `/workspace/current/projects/:projectId/template` | Check publish status only in the active workspace. |
| `PUT` | `/workspace/current/projects/:projectId/template` | Publish/update template in the active workspace. |
| `DELETE` | `/workspace/current/projects/:projectId/template` | Unpublish only from the active workspace. |
| `POST` | `/workspace/current/templates/:templateId/use` | Allow use only when the template belongs to the active workspace and the user can access that workspace. |

### Project endpoints with changed behavior

| Method | Path | New behavior |
| --- | --- | --- |
| `GET` | `/projects` | List projects for the active workspace: personal projects in Personal Workspace, all team-visible projects in a team workspace. |
| `POST` | `/projects` | Create the project in the active workspace. Team workspace creates a team-visible read-only-by-default project. |
| `GET` | `/projects/:id` | Allow creator/editor access and team member read-only access for team projects. Return `permission: 'owner' | 'editor' | 'viewer'`. |
| `PATCH` | `/projects/:id` | Allow only owner/editor. Reject read-only team viewers with `403 PROJECT_EDIT_PERMISSION_REQUIRED`. |
| `DELETE` | `/projects/:id` | Allow project owner only for MVP. |
| `POST` | `/projects/:id/edit-requests` | Current team viewer requests edit access. |
| `GET` | `/projects/:id/edit-requests` | Project owner/editor lists pending requests. |
| `POST` | `/projects/:id/edit-requests/:requestId/approve` | Project owner approves and inserts `project_members(role='editor')`. |
| `POST` | `/projects/:id/edit-requests/:requestId/reject` | Project owner rejects the request. |

### Service Boundaries

Split `backend/src/services/workspace.service.js` into focused helpers during implementation:

- `workspace-membership.service.js`
  - `listUserWorkspaces(userId)`
  - `assertWorkspaceAccess(userId, workspaceId)`
  - `createTeamWorkspace(userId, payload)`
  - `leaveWorkspace(userId, workspaceId, transferPayload)`
  - `ensurePersonalWorkspace(userId)`
  - `listTransferTargets(userId, workspaceId)`

- `workspace-invites.service.js`
  - `createDirectInvite(userId, workspaceId, payload)`
  - `createInviteLink(userId, workspaceId)`
  - `acceptDirectInvite(userId, inviteId)`
  - `joinWorkspaceByInvite(userId, rawToken)`
  - `resolveInviteeByUsernameOrEmail(value)`
  - `hashInviteToken(rawToken)`

- `workspace-templates.service.js`
  - Existing template list/publish/unpublish/use logic after it receives a resolved workspace.
  - `listTemplatesByScope(userId, scope)`
  - `favoriteTemplate(userId, templateId)`
  - `unfavoriteTemplate(userId, templateId)`

- `project-permissions.service.js`
  - `resolveProjectAccess(userId, projectId)`
  - `assertProjectCanRead(userId, projectId)`
  - `assertProjectCanEdit(userId, projectId)`
  - `createProjectEditRequest(userId, projectId, payload)`
  - `reviewProjectEditRequest(ownerUserId, requestId, decision)`
  - `transferManagedProjects(fromUserId, toUserId, workspaceId)`

Keep compatibility exports from `workspace.service.js` during the split so existing route imports do not break.

## Frontend Architecture

### API layer

Extend `src/api/workspace.js`:

- `apiListWorkspaces()`
- `apiCreateWorkspace(payload)`
- `apiSetCurrentWorkspace(workspaceId)`
- `apiCreateDirectWorkspaceInvite(workspaceId, payload)`
- `apiJoinWorkspaceInvite(token)`
- `apiAcceptWorkspaceInvite(inviteId)`
- `apiCreateWorkspaceInviteLink(workspaceId)`
- `apiListWorkspaceTransferTargets(workspaceId)`
- `apiLeaveWorkspace(workspaceId)`
- `apiListWorkspaceTemplates(scope)`
- `apiFavoriteWorkspaceTemplate(templateId)`
- `apiUnfavoriteWorkspaceTemplate(templateId)`

Keep existing template API functions.

Extend `src/api/projects.js`:

- Keep existing CRUD function names.
- Ensure API callers can pass the active workspace context when needed.
- Add edit-request helpers:
  - `apiCreateProjectEditRequest(projectId, payload)`
  - `apiListProjectEditRequests(projectId)`
  - `apiApproveProjectEditRequest(projectId, requestId)`
  - `apiRejectProjectEditRequest(projectId, requestId)`

### Store

Extend `src/stores/workspace.js`:

```js
export const workspaces = ref([])
export const currentWorkspace = ref(null)
export const featuredTemplates = ref([])
export const workspaceInviteLink = ref('')
export const pendingInvites = ref([])
export const templateScope = ref('community')
```

Add actions:

- `loadWorkspaceContext()`: loads list and current workspace.
- `selectWorkspace(workspaceId)`: sets active workspace, reloads templates.
- `createTeamWorkspace(payload)`: creates team with optional avatar, stores returned invite link, reloads workspace context and templates.
- `createDirectInvite(workspaceId, payload)`: invites by username or email.
- `joinWorkspaceInvite(token)`: joins team, sets it active, reloads.
- `acceptDirectInvite(inviteId)`: accepts a direct invite, sets team active, reloads.
- `leaveWorkspace(workspaceId, transferPayload)`: leaves team, falls back to personal, reloads.
- `createInviteLink(workspaceId)`: returns a copyable link.
- `listTransferTargets(workspaceId)`: returns members eligible for ownership/project transfer.
- `loadTemplatesByScope(scope)`: loads `community`, `workspace`, `my`, or `favorites` templates for the tabbed template surface.

Extend `src/stores/projects.js` behavior:

- `initProjectsStore()` and `apiListProjects()` list projects for the active workspace.
- `createProject()` sends/uses current workspace context so team workspace projects are created as team-visible projects.
- `get/load project` stores permission metadata returned by the backend.
- `updateProject()` and canvas autosave must stop or show read-only messaging when permission is `viewer`.

Local preview mode should provide at least:

- one personal workspace,
- one public workspace,
- one team workspace,
- recent projects in personal and team spaces,
- team templates with `ownerAvatarUrl`,
- team projects with read-only and editor examples,
- public templates for fallback.

### Workspace Page UI

Use the new shared-space interaction reference as the information architecture guide:

- Left rail top: active workspace avatar/name/member count with switcher affordance.
- Left rail primary entries: `Projects`, `Share Templates`, `Shared with me`, `History`.
- Left rail sections:
  - `Workspace`: team-visible project collections and team template collections.
  - `Private`: personal projects and personal saved items.
- Main content tabs for reusable templates/techniques:
  - `Community`
  - `Workspace`
  - `My`
  - `Favorites`
- Search stays in the main content header for templates/projects.

Add focused components under `src/components/workspace`:

- `WorkspaceSwitcher.vue`
  - Shows active workspace avatar, name, kind, and member count.
  - Dropdown lists Personal Workspace and joined teams.
  - Emits `select-workspace`, `create-workspace`, `invite-members`, `leave-workspace`, and `copy-invite-link`.

- `WorkspaceCreateModal.vue`
  - Name field.
  - Avatar upload control.
  - Generated/editable slug.
  - Create button.
  - Success state with invite link and copy action.

- `WorkspaceInviteModal.vue`
  - Direct invite by username or email.
  - Link invite creation/copy state with visible 7-day expiration.

- `WorkspaceLeaveTransferModal.vue`
  - Shows projects and workspace owner responsibilities that must be transferred.
  - Requires selecting an eligible team member before exit when transfer is required.

- `WorkspaceJoin.vue`
  - Route: `/workspace/join/:token`.
  - If unauthenticated, redirect to login/register with `redirect=/workspace/join/:token`.
  - If authenticated, call join API, set active workspace, redirect to `/workspace?joined=<slug>`.

- `WorkspaceTemplatesTabs.vue`
  - Renders `Community`, `Workspace`, `My`, and `Favorites` tabs for Share Templates/techniques.

- `ProjectAccessBanner.vue`
  - Shows read-only team project status and request-edit action inside Canvas.

- `ProjectEditRequestsPanel.vue`
  - Lets project owner/manager approve or reject edit requests.

Modify existing files:

- `src/views/Workspace.vue`
  - Load workspace context before templates.
  - Reload project list when active workspace changes.
  - Pass workspace list/current workspace to `WorkspaceSidebar`.
  - Handle switcher events.

- `src/components/workspace/WorkspaceSidebar.vue`
  - Replace the plain `workspaceBrand` text block with `WorkspaceSwitcher`.
  - Keep the existing nav and account sections.

- `src/components/workspace/WorkspaceCardsGrid.vue`
  - For team project/template cards, render owner avatar on the media's upper-left corner.
  - Change the badge from always `Public` to `Team` or `Public` based on template workspace kind.

- `src/utils/workspaceDisplay.js`
  - Add helpers for workspace initials, workspace avatar fallback, member count label, template badge label, project permission label, and owner avatar fallback.

### Canvas Project Access UI

Modify:

- `src/components/canvas/CanvasShareWorkspaceSection.vue`
  - Show active workspace name.
  - Show visibility copy:
    - Team: `Visible to members of {workspaceName}.`
    - Public: `Visible in public Share Templates.`

- `src/components/canvas/CanvasShareStatusSection.vue`
  - Replace `Published to Featured Templates` with workspace-aware copy.

- `src/hooks/useCanvasProjectUiState.js`
  - Keep deriving `workspaceName` from `currentWorkspace`.
  - Add `workspaceKind` derived from `currentWorkspace.kind` for copy and status.

- `src/views/Canvas.vue`
  - Show `ProjectAccessBanner` when backend returns `permission = 'viewer'`.
  - Disable or hide editing controls that would trigger project mutation for read-only viewers.
  - Keep project viewing available for team members.

No separate share target selector is required for MVP if the workspace switcher controls active workspace. Team workspace projects are team-visible by default, and the share dialog remains focused on reusable template publishing.

## Core Flows

### Create Team

1. User opens workspace dropdown.
2. User clicks `Create a new workspace`.
3. Modal opens with avatar upload, name, and generated slug.
4. Backend validates slug uniqueness and creates:
   - team workspace,
   - owner membership,
   - active workspace preference,
   - initial 7-day invite link.
5. Frontend switches to the new team and shows copyable invite link.
6. Project list and Share Templates reload under the new team context.

### Invite Team Members

1. Team owner opens invite modal.
2. Owner chooses direct invite or link invite.
3. Direct invite:
   - Owner enters username or email.
   - Backend creates a pending direct invite.
   - Existing user can accept from invite notification/list.
   - Unregistered email can accept after registering or logging in with that email.
4. Link invite:
   - Backend creates a random invite token.
   - Link expires after 7 days.
   - Database stores only token hash.
5. Accepted invite inserts workspace membership and sets the team as active workspace.

### Join Team By Link

1. Existing member shares invite link.
2. Recipient opens `/workspace/join/:token`.
3. If unauthenticated, app redirects to login/register and then resumes the join route.
4. Backend validates token hash, workspace, status, and 7-day expiration.
5. Backend inserts membership and sets active workspace preference.
6. Frontend redirects to `/workspace` and reloads current workspace/templates/projects.

### Create Project In Personal Workspace

1. User selects Personal Workspace in the switcher.
2. User creates a project.
3. Backend creates `projects.workspace_id = personalWorkspace.id` and `access_mode = 'private'`.
4. Only the creator can list, read, edit, and delete the project.

### Create Project In Team Workspace

1. User selects a team workspace in the switcher.
2. User creates a project.
3. Backend creates `projects.workspace_id = teamWorkspace.id`, `access_mode = 'team'`, and a `project_members(role='owner')` row for the creator.
4. All team members can see the project in the team project list.
5. All team members can open the project in read-only mode.
6. Only project owner/editor can save canvas changes, rename, duplicate into team, or delete.

### Request Project Edit Access

1. Team member opens a team project without editor permission.
2. Canvas loads in read-only mode with a request-edit action.
3. User submits an edit request.
4. Project creator/manager sees pending request.
5. Creator/manager approves or rejects.
6. Approval inserts `project_members(role='editor')` and the requester can edit after refresh/reload.

### Publish Reusable Template

1. User opens Canvas share dialog.
2. Dialog shows the current workspace and visibility.
3. Publish calls the existing template endpoint.
4. Backend resolves active workspace and writes `shared_project_templates.workspace_id`.
5. Public templates do not receive a row when active workspace is a team.

### Browse Share Templates

1. Workspace page loads workspace context.
2. It loads templates for active workspace.
3. If no active team is valid, backend falls back to personal workspace for projects and public workspace for community templates.
4. Template cards show owner avatar and workspace badge.

### Leave Team

1. User chooses leave from workspace dropdown.
2. Backend checks whether the user is the only team owner or owns/manages team projects.
3. If transfer is required, frontend shows eligible team members.
4. User selects a transfer target.
5. Backend transfers team ownership and/or project management permissions.
6. Membership is removed.
7. If the left team was active, active workspace falls back to Personal Workspace.
8. Frontend reloads projects and templates.

## Development Path

### Phase 1: Schema And Access Rules

Files:

- Create: `supabase/013_team_workspaces.sql`
- Modify: `docs/SUPABASE_VALIDATION_EVIDENCE.md` after live validation if Supabase connector is used.

Work:

- Add workspace kind/avatar/creator fields.
- Add unique `user_profiles.username` support for username invites.
- Add invite, active-preference, project member, project edit request, and template favorite tables.
- Extend `projects` with `workspace_id` and `access_mode`.
- Migrate existing default workspace to public kind.
- Create personal workspace rows for existing users.
- Migrate existing projects into the owning user's personal workspace.
- Add indexes for preferences, invites, workspace member lookups, project workspace lists, project editors, and edit requests.
- Keep RLS service-role-only policy style consistent with `supabase/012_supabase_lint_remediation.sql`.

Validation:

- `git diff --check`
- Apply migration in a safe Supabase environment before production.

### Phase 2: Backend Workspace Context

Files:

- Modify: `backend/src/services/workspace.service.js` as the compatibility export layer.
- Modify: `backend/src/services/projects.service.js`
- Modify: `backend/src/routes/projects.routes.js`
- Create:
  - `backend/src/services/workspace-membership.service.js`
  - `backend/src/services/workspace-invites.service.js`
  - `backend/src/services/workspace-templates.service.js`
  - `backend/src/services/project-permissions.service.js`
  - `backend/src/services/workspace.service.test.js`
  - `backend/src/services/project-permissions.service.test.js`
- Modify: `backend/src/routes/workspace.routes.js`

Work:

- Replace unconditional default workspace membership upsert with `resolveCurrentWorkspace(userId)`.
- Add create/list/select/join/leave/direct-invite/link-invite APIs.
- Add 7-day expiration enforcement for link invites.
- Add owner/project transfer validation to leave-team flow.
- Ensure all template operations receive a resolved accessible workspace.
- Update project list/read/create/update/delete behavior for personal/team workspaces.
- Return `permission` metadata on project read.
- Reject project mutation from read-only team viewers.
- Add edit request create/list/approve/reject behavior.
- Add template scope list and favorite/unfavorite behavior.
- Batch-load template owner profiles to expose `ownerAvatarUrl`.
- Add audit log actions:
  - `workspace.create`
  - `workspace.join`
  - `workspace.leave`
  - `workspace.invite.create`
  - `workspace.invite.accept`
  - `project.edit_request.create`
  - `project.edit_request.approve`
  - `project.edit_request.reject`
  - `project.management.transfer`
  - Existing `template.publish/use/unpublish` should include workspace id and kind.

Validation:

- `npm run test:backend`
- Targeted backend tests for personal/team project visibility, read-only project access, edit request approval, invite expiration, direct invite matching, team leave transfer, template scopes, and template favorites.

### Phase 3: Frontend Workspace State

Files:

- Modify: `src/api/workspace.js`
- Modify: `src/api/projects.js`
- Modify: `src/stores/workspace.js`
- Modify: `src/stores/projects.js`
- Modify: `src/stores/workspacePreviewData.js`
- Modify or add tests:
  - `src/stores/workspaceLocalPreview.test.js`
  - `src/stores/workspacePreviewData.test.js`
  - `src/stores/workspace.test.js`
  - `src/stores/projectsData.test.js`
  - `src/stores/projectsActivity.test.js`

Work:

- Add workspace list/current/team/direct-invite/link-invite/leave-transfer actions.
- Add project edit request API/store actions.
- Add template scope and favorite/unfavorite API/store actions.
- Make local preview expose personal, public, team, viewer, and editor states.
- Ensure `loadFeaturedTemplates()` always follows current workspace.
- Ensure joining/creating/selecting reloads projects and templates without requiring page reload.
- Ensure read-only project permissions stop autosave and mutation flows.

Validation:

- `npm run test:frontend`

### Phase 4: Workspace Switcher And Create/Join UI

Files:

- Create: `src/components/workspace/WorkspaceSwitcher.vue`
- Create: `src/components/workspace/WorkspaceCreateModal.vue`
- Create: `src/components/workspace/WorkspaceInviteModal.vue`
- Create: `src/components/workspace/WorkspaceLeaveTransferModal.vue`
- Create: `src/components/workspace/WorkspaceTemplatesTabs.vue`
- Create: `src/views/WorkspaceJoin.vue`
- Modify: `src/components/workspace/WorkspaceSidebar.vue`
- Modify: `src/views/Workspace.vue`
- Modify: `src/router/index.js`
- Modify tests:
  - `src/views/Workspace.test.js`
  - Add route/source coverage for `/workspace/join/:token` in the existing frontend test surface.

Work:

- Add active workspace display with avatar and dropdown.
- Add Personal Workspace and team workspace switch targets.
- Add create modal with avatar upload, slug preview, and 7-day invite link success state.
- Add invite modal for username/email and link invite.
- Add leave transfer modal for team/project management transfer.
- Add shared-space navigation reference:
  - `Shared with me`
  - `Workspace`
  - `Private`
  - `Community / Workspace / My / Favorites` template tabs.
- Add join route behavior and login redirect recovery.
- Add leave-team action with owner guard messaging.

Validation:

- `npm run test:frontend`
- Browser smoke:
  - create team,
  - upload team avatar,
  - copy invite link,
  - create direct invite,
  - switch personal/team,
  - leave member team with transfer when required,
  - route guard for join link.

### Phase 5: Project Access And Templates Isolation UI

Files:

- Create: `src/components/canvas/ProjectAccessBanner.vue`
- Create: `src/components/canvas/ProjectEditRequestsPanel.vue`
- Modify: `src/components/canvas/CanvasShareWorkspaceSection.vue`
- Modify: `src/components/canvas/CanvasShareStatusSection.vue`
- Modify: `src/hooks/useCanvasProjectUiState.js`
- Modify: `src/hooks/useCanvasProjectActions.js` only if workspace metadata must be passed explicitly.
- Modify: `src/views/Canvas.vue`
- Modify: `src/components/workspace/WorkspaceCardsGrid.vue`
- Modify: `src/utils/workspaceDisplay.js`
- Modify tests:
  - `src/views/Canvas.test.js`
  - `src/views/Workspace.test.js`

Work:

- Show read-only project state when current user is team viewer.
- Disable canvas mutation/autosave/project actions for team viewers.
- Add request-edit flow and owner approval/rejection UI.
- Show team/public visibility in the share modal.
- Keep publish/unpublish APIs unchanged at call sites when possible.
- Display owner avatar on team template cards.
- Display `Team` or `Public` badge.
- Ensure project list and Share Templates switch data after active workspace changes.

Validation:

- `npm run test:frontend`
- Browser smoke:
  - publish in public fallback,
  - join team and create a team-visible project,
  - open team project as another member in read-only mode,
  - request edit access and approve it,
  - publish reusable template to team,
  - verify public page no longer shows team-published item,
  - verify team member sees team-published item with owner avatar.

### Phase 6: Full Verification

Commands:

```bash
npm run check
npm run build
git diff --check
```

Manual browser paths:

- Logged-out invite link redirects to auth and resumes join.
- New user with no team sees public Share Templates.
- User creates team and sees it active in the switcher.
- User switches between Personal Workspace and team workspace.
- Team member creates a project and another team member sees it in the team project list.
- Team member without edit permission opens the project read-only.
- Edit request approval grants editor permission.
- Non-member cannot list/read team projects or use team templates by ID.
- Leaving active team transfers required management and falls back to Personal Workspace.

## Acceptance Criteria

- A user can create a team workspace from the workspace page.
- Created team has creator-uploaded or generated avatar, generated slug, owner membership, and copyable 7-day invite link.
- A user can invite by username/email and by 7-day link.
- A user can join a team through direct invite or link invite after authentication.
- Personal Workspace remains available after joining teams.
- Creating a project in Personal Workspace keeps it private to the creator.
- Creating a project in a team workspace makes it visible to all members of that team.
- Team members can open team projects in read-only mode.
- Team project editing requires owner/editor permission.
- A read-only team member can request edit access.
- Project creator/manager can approve or reject edit requests.
- Approved editor can save project changes.
- Team projects and team templates are invisible to non-members and inaccessible by direct API calls.
- If a user has no team or no valid active team, Share Templates shows public shared templates while project creation remains personal.
- Team project/template cards show the sharer's avatar or fallback initials.
- Leaving a team requires transferring team ownership and project management permissions when the leaving user owns them.
- Existing personal project open/rename/duplicate/delete behavior remains available in Personal Workspace.
- Existing public shared-template behavior remains available for users without a team.

## Benefits

- Privacy isolation: team projects/templates stop leaking into the global shared template list.
- Clear collaboration model: users understand whether they are working in Personal Workspace or a team workspace before creating or sharing.
- Team visibility without accidental edits: members can inspect team projects immediately, while edits stay under creator/manager control.
- Reuse of existing infrastructure: current workspace, project, and shared-template tables are extended instead of replaced.
- Future-ready foundation: membership, invites, project permissions, and active workspace can support later notifications, billing, or admin tools.

## Risks And Mitigations

| Risk | Impact | Mitigation |
| --- | --- | --- |
| Team projects or templates accidentally appear in public/personal fallback | Privacy regression | Resolve workspace server-side for every project/template route; add backend tests for public/personal/team isolation and direct ID access. |
| Existing users lose access to current public templates | Product regression | Migrate the current `shared-workspace` to `kind = 'public'` and keep it as fallback. |
| Existing personal projects become team-visible after migration | Privacy regression | Create personal workspaces for existing users and migrate existing `projects` rows to those personal workspaces with `access_mode = 'private'`. |
| Slug-only join links are guessable | Unauthorized team joins | Use random invite tokens and store only token hashes; keep slugs readable but not secret. |
| Link invites remain usable too long | Unauthorized team joins | Enforce `expires_at = created_at + 7 days` on server and reject expired/revoked links. |
| Direct email invite is accepted by the wrong user | Unauthorized team joins | Match direct email invites to the authenticated user's verified email before acceptance. |
| Owner leaves a team with no other owner | Orphaned team | Block owner leave until ownership transfer to an eligible team member succeeds. |
| Project manager leaves team without transferring owned projects | Orphaned projects | Require transfer target and move project owner/editor management rows before membership removal. |
| Read-only users accidentally mutate canvas state | Data corruption | Return explicit project permission, disable frontend mutation controls, and enforce edit permission in every backend update/delete/autosave path. |
| Multiple teams make create/share target ambiguous | Wrong workspace publish | Use active workspace as the single source of truth; after join/create, automatically switch active workspace to that team and show active workspace in the left rail. |
| Avatar data becomes stale | Incorrect sharer identity | Batch-load current `user_profiles.avatar_url` when listing templates; avoid duplicating avatar on template rows for MVP. |
| Frontend local preview diverges from real behavior | Missed UI regressions | Update local preview fixtures to include personal, public, team, viewer, and editor states. |
| RLS and service-role policies drift | Supabase security warnings | Follow the service-role-only pattern already used for workspace tables in `012_supabase_lint_remediation.sql`. |

## Product Decisions To Confirm

1. Direct invite delivery: should username/email invites only appear inside the app, or should the backend also send an email notification when Resend is configured?
2. Direct invite for unregistered email: should an unregistered invitee be allowed to register and accept automatically, or should owner approval be required after registration?
3. Edit request notification: should project creators see edit requests only inside the app, or also receive email/in-app notification badges?
4. Public workspace naming: should the fallback public shared space be called `Public Workspace`, `Community`, `Share Templates`, or another product name?
5. Template tabs naming: should the UI use `Share Templates`, `Techniques`, or a bilingual label for the shared technique/template surface?
