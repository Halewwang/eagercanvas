# Workspace Navigation Performance Design

## Summary

The workspace page has two visible latency paths:

1. Switching between personal and team workspaces waits for the selected workspace to be persisted before the target project list starts loading.
2. Opening a project waits for the Canvas route chunk and then serializes cache hydration, project-list refresh, and project-detail refresh before the requested project is guaranteed to render.

The current UI does not represent either path well. Workspace switching shows only a static dot and text, while project opening has no transition state. The result feels unresponsive even when requests are still making progress.

The chosen design reduces the real critical path and adds continuous feedback without changing authentication, authorization semantics, project save/sync behavior, canvas tools, generation workflows, or unrelated pages.

## Goals

- Start loading the target workspace's projects at the same time as the workspace-selection preference is persisted.
- Preserve the existing workspace membership and project access checks.
- Start project-detail loading without waiting for a redundant project-list refresh.
- Preload the Canvas route after workspace-critical work or when a user signals intent to open a project.
- Show an immediate, accessible loading transition for workspace switches and project opening.
- Prevent stale responses from a prior workspace switch or project open from replacing current state.
- Keep all existing no-parameter project-list callers backward compatible.

## Non-goals

- No changes to login, session bootstrap, admin access, team roles, project permission meanings, direct sharing, or edit-request workflows.
- No changes to canvas persistence, conflict resolution, offline drafts, media upload, or generation tools.
- No redesign of the workspace page or Canvas chrome.
- No aggregation of workspace selection and the full project list into one large response.
- No new runtime dependency.

## Evidence and Root Cause

### Workspace switching

`Workspace.vue` currently starts `selectWorkspace(workspaceId)`, waits for it, and only then calls `initProjectsStore()` through the background refresh path. The backend selection path validates workspace and membership, obtains a member count, then writes `user_workspace_preferences`. The subsequent `/projects` call resolves the active workspace again before it reads projects. These are separate serial phases even though the target workspace ID is already known on the client.

The existing optimistic workspace label update is useful, but old project cards remain visible while the new list is pending. The only progress indicator is a non-animated six-pixel dot, so the user cannot distinguish loading from a stalled page.

### Project opening

The workspace click handler already avoids the old bug of refreshing project detail before calling `router.push`. The remaining cold path is later:

1. Vue Router downloads and evaluates the lazy Canvas view and its dependencies.
2. `useCanvasRouteLifecycle` bootstraps auth and hydrates the browser draft cache.
3. It starts `initProjectsStore()`.
4. When no warm canvas draft is available, it waits for the full project list.
5. It then requests the selected project detail and applies it.
6. Missing-media recovery runs after the project is loaded.

The detail request does not depend on the list response: `refreshProjectById(id)` can fetch and insert the requested project directly. Waiting for the list therefore adds avoidable latency. The Canvas view also renders its normal empty surface during this work, with no loading or failure state.

## Chosen Architecture

### 1. Explicit, backward-compatible workspace scope for project lists

`GET /api/v1/projects` accepts an optional `workspaceId` query parameter.

- Without `workspaceId`, behavior remains exactly as it is now: resolve the user's persisted active workspace and return that workspace's projects plus directly shared projects.
- With `workspaceId`, the backend validates that the user is a member of that non-public workspace, then uses it as the project-list scope. It still merges directly shared projects and resolves project permissions exactly as today.
- The explicit scope is not trusted. It is only a way to avoid re-reading the persisted preference before the project query.

The client API and project store pass this option only during workspace switching. Existing callers remain unchanged.

### 2. Safe parallel workspace activation

When a user selects a workspace, the client starts two promises immediately:

- persist the selected workspace through the existing selection endpoint;
- fetch the target workspace's project list using the explicit `workspaceId`.

The project-store load accepts a `commitAfter` promise. The HTTP request begins immediately, but its result is not committed to shared project state until workspace selection succeeds. This prevents a successful list request from visually switching the project data if the preference write or membership validation fails.

The existing project-list request token remains the last-write guard. The existing workspace refresh ID remains the view-level guard. A rapid A → B → A sequence can therefore finish requests out of order without an older result replacing the current workspace.

Workspace preference writes themselves are serialized in selection order. Each target project-list request still starts immediately, but its staged result waits for its matching queued selection promise. A selection token prevents an earlier response from restoring or applying stale client state. This guarantees that the latest user choice is also the last preference written on the server without slowing the normal single-switch path.

On failure:

- `selectWorkspace` restores the previous workspace as it does now;
- the staged target project result is discarded;
- the prior project list remains visible after the loading state is removed;
- the existing notifier reports the error.

### 3. Narrow backend selection optimization

Workspace membership lookup is separated from member-count enrichment internally.

- Existing callers that need the mapped workspace and member count keep their current result.
- `setActiveWorkspace` validates workspace and membership first, then performs member-count lookup and preference upsert in parallel.
- The explicit project-list scope uses the validated workspace and membership without paying for member-count enrichment, because project listing does not use that count.

No endpoint response shape or permission outcome changes.

### 4. Canvas route preloading

The Canvas lazy importer moves to a small shared route-loader module used by both the router and Workspace.

Workspace triggers the same cached dynamic import:

- on pointer or keyboard focus intent over a project card;
- once after initial workspace-critical data has settled, scheduled through `requestIdleCallback` with a timeout fallback.

The preload is best-effort and has no user-facing error. It must not compete with the initial workspace project request.

### 5. Parallel Canvas data bootstrap

After auth bootstrap and browser draft hydration:

- a usable local draft is applied immediately, as today;
- the project-list refresh starts in the background;
- the selected project-detail refresh starts independently instead of waiting for the list;
- the requested project is applied as soon as its detail or valid local fallback is available;
- list refresh continues to update surrounding project metadata and menus.

Existing unsaved-change protection remains the gate before a remote snapshot is applied. Existing request-token behavior remains responsible for ignoring stale list responses.

Missing-media recovery begins after the project nodes are applied. It does not keep the main project-opening overlay visible because the usable canvas is already present.

### 6. Loading and transition states

#### Workspace switch

While switching:

- the workspace identity changes optimistically;
- project cards are replaced by a fixed-count skeleton grid, so projects from the previous workspace are not presented under the new workspace name;
- the existing status pill becomes an animated progress treatment with `role="status"` and concise text;
- workspace selection remains race-safe rather than globally disabled, allowing the latest choice to win.

#### Project open

The transition has two continuous stages:

1. Workspace sets `openingProjectId` before navigation. The clicked card shows a busy overlay and `aria-busy="true"` while the lazy route is resolving.
2. Canvas starts with a project-loading overlay and removes it only after a usable project snapshot has been applied.

If neither remote detail nor a local fallback can be loaded, Canvas replaces the indefinite loader with a small failure panel offering a return to Workspace and retry. A failed router navigation clears `openingProjectId` and reports the existing notifier error.

Animations use the existing dark workspace/Canvas visual language, subtle ring borders, restrained opacity/translate motion, and no new accent colors. `prefers-reduced-motion: reduce` removes shimmer, rotation, and translation while retaining the status copy and skeleton structure.

## Component and File Boundaries

- `backend/src/routes/projects.routes.js`: parse and forward optional `workspaceId`.
- `backend/src/services/projects.service.js`: resolve an explicit authorized workspace scope while preserving current default behavior.
- `backend/src/services/workspace-membership.service.js`: expose a lightweight validated membership context and parallelize count enrichment with preference persistence.
- `src/api/projects.js`: pass optional project-list query parameters.
- `src/stores/projects.js`: start scoped fetches immediately, stage commits behind workspace activation, and preserve request-token guards.
- `src/router/viewLoaders.js`: own the shared Canvas dynamic importer.
- `src/router/index.js`: use the shared Canvas loader without changing routes.
- `src/components/workspace/WorkspaceCardsGrid.vue`: expose project intent events and render the selected card's busy state.
- `src/components/workspace/WorkspaceLoadingGrid.vue`: own the workspace-switch skeleton UI.
- `src/views/Workspace.vue`: coordinate switch state, parallel activation, route preload, and project-open state.
- `src/components/canvas/CanvasProjectLoadingOverlay.vue`: own Canvas loading and failure presentation.
- `src/hooks/useCanvasRouteLifecycle.js`: run list/detail work independently and report loading, ready, and error transitions.
- `src/views/Canvas.vue`: connect lifecycle state to the overlay without changing canvas business actions.

## Error Handling and Data Integrity

- Explicit workspace scope always requires server-side membership validation.
- Public/community workspaces remain non-selectable as project workspaces.
- The project list does not commit before workspace activation succeeds.
- A stale scoped request cannot commit after a newer switch because it fails the request-token check.
- Direct shares remain included and continue to be separated in the UI by `accessSource`/`accessMode`.
- Remote project detail never overwrites pending local edits because `shouldApplyRemoteProjectSnapshot` remains mandatory.
- Loading state always reaches ready or error; no rejected promise may leave an indefinite overlay.
- Existing browser-local cache remains a fallback for Canvas entry, not an authoritative workspace project list.

## Testing Strategy

### Backend

- Prove the existing no-query `/projects` behavior remains unchanged.
- Prove explicit personal and team workspace scopes use the requested authorized workspace.
- Prove a non-member and a public workspace are rejected.
- Prove direct shares and permission resolution are preserved.
- Prove active-workspace selection still returns the same shape while member count and preference write are parallelized.

### Frontend store and lifecycle

- Prove a scoped project request starts before `commitAfter` settles but does not mutate project state early.
- Prove failed activation discards staged project data and preserves the prior list.
- Prove stale scoped responses cannot replace the latest workspace.
- Prove Canvas project detail starts without waiting for project-list completion.
- Prove a warm draft renders immediately and remote reconciliation stays in the background.
- Prove loading transitions reach ready and error deterministically.

### View contracts

- Prove workspace switching renders an accessible skeleton/status state and hides stale cards.
- Prove only the clicked project card enters the busy state.
- Prove Canvas renders the loading overlay and recoverable error action.
- Prove reduced-motion CSS disables nonessential animation.

### Verification

- Run focused frontend and backend Node tests for every changed boundary.
- Run `npm run check`.
- Run `npm run build`; if the existing Vite transform stall recurs, capture and report it rather than claiming a successful build.
- Run `git diff --check`.
- Use browser throttling to verify workspace selection feedback appears immediately, the clicked card transitions before the Canvas chunk resolves, the Canvas loader persists until usable data is present, and no stale project list flashes during switching.

## Acceptance Criteria

- Selecting a different workspace produces visible feedback in the same render frame.
- Target project loading begins without waiting for workspace-preference persistence to finish.
- Projects from the previous workspace are never shown beneath the new workspace identity.
- Clicking a project produces immediate card feedback and a continuous Canvas loading state.
- Project detail loading does not wait for the full project-list request.
- Warm local drafts remain immediately usable and retain current conflict protections.
- Failed requests end in a recoverable error state rather than an indefinite blank or loading screen.
- Existing workspace permissions, direct shares, project save/sync behavior, and all unrelated business tests remain unchanged.
