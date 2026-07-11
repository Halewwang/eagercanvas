# Workspace Navigation Performance Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make workspace switching and project opening materially faster while providing continuous, accessible loading feedback and preserving existing permissions, persistence, and unrelated business behavior.

**Architecture:** Add an optional authorized workspaceId scope to the project-list endpoint so target projects load alongside ordered workspace preference persistence. Preload the Canvas route, run Canvas list/detail refreshes independently, and connect narrow loading-state components to the existing views.

**Tech Stack:** Vue 3.5, Vue Router 4, Node.js test runner, Express, Supabase, Vite 5, scoped Vue CSS.

## Global Constraints

- No changes to login, session bootstrap, admin access, team roles, project permission meanings, direct sharing, or edit-request workflows.
- No changes to canvas persistence, conflict resolution, offline drafts, media upload, or generation tools.
- No redesign of the workspace page or Canvas chrome.
- No aggregation of workspace selection and the full project list into one large response.
- No new runtime dependency.
- Existing no-parameter project-list callers remain backward compatible.
- Browser-local cache remains a Canvas fallback, not an authoritative workspace project list.
- Loading feedback retains status text and honors prefers-reduced-motion: reduce.
- Preserve the unrelated untracked file docs/PROJECT_HANDOFF_AND_DEPLOYMENT.md and never stage it.

## File Map

- backend/src/services/workspace-membership.service.js: lightweight membership context and faster selection persistence.
- backend/src/services/projects.service.js and backend/src/routes/projects.routes.js: optional authorized list scope.
- src/stores/projectListActivation.js, src/stores/projects.js, src/stores/workspace.js: staged list commits and ordered writes.
- src/router/viewLoaders.js: shared Canvas importer.
- Workspace loading components and src/views/Workspace.vue: switch/open feedback.
- Canvas loading component, lifecycle hook, and src/views/Canvas.vue: independent detail load and recoverable overlay.

---

### Task 1: Lightweight Workspace Access and Faster Selection Persistence

**Files:**
- Modify: backend/src/services/workspace-membership.service.test.js
- Modify: backend/src/services/workspace-membership.service.js:294-369

**Interfaces:**
- Produces: assertWorkspaceMemberAccess(userId, workspaceId, options) returning workspace, membership, and mapped.
- Preserves: assertWorkspaceMember and setActiveWorkspace response shapes.

- [ ] **Step 1: Write failing contract tests**

Add assertWorkspaceMemberAccess to the existing named import, then append:

~~~js
test('workspace access validation avoids member-count enrichment', () => {
  const accessStart = workspaceMembershipSource.indexOf('export const assertWorkspaceMemberAccess = async')
  const memberStart = workspaceMembershipSource.indexOf('export const assertWorkspaceMember = async')
  const accessSource = workspaceMembershipSource.slice(accessStart, memberStart)
  assert.ok(accessStart >= 0)
  assert.match(accessSource, /Promise\.all/)
  assert.doesNotMatch(accessSource, /countWorkspaceMembers/)
})

test('workspace selection overlaps count and preference persistence', () => {
  const start = workspaceMembershipSource.indexOf('export const setActiveWorkspace = async')
  const end = workspaceMembershipSource.indexOf('export const getActiveWorkspace = async')
  const source = workspaceMembershipSource.slice(start, end)
  assert.match(source, /assertWorkspaceMemberAccess/)
  assert.match(source, /const preferenceWrite = supabaseClient/)
  assert.match(source, /Promise\.all/)
  assert.match(source, /mapWorkspace\(workspace, membership\.role, memberCount\)/)
})

const createWorkspaceAccessClient = ({ workspace = null, membership = null } = {}) => ({
  from(table) {
    return {
      select() { return this },
      eq() { return this },
      maybeSingle: async () => ({
        data: table === 'workspaces' ? workspace : membership,
        error: null
      })
    }
  }
})

test('lightweight workspace access rejects public workspaces and non-members', async () => {
  await assert.rejects(
    assertWorkspaceMemberAccess('user-1', 'public-1', {
      supabaseClient: createWorkspaceAccessClient({
        workspace: { id: 'public-1', slug: 'shared-workspace', kind: 'public' },
        membership: { workspace_id: 'public-1', user_id: 'user-1', role: 'member' }
      })
    }),
    (error) => error.code === 'WORKSPACE_NOT_FOUND'
  )

  await assert.rejects(
    assertWorkspaceMemberAccess('user-1', 'team-1', {
      supabaseClient: createWorkspaceAccessClient({
        workspace: { id: 'team-1', slug: 'team-1', kind: 'team' },
        membership: null
      })
    }),
    (error) => error.code === 'WORKSPACE_NOT_FOUND'
  )
})
~~~

- [ ] **Step 2: Verify RED**

Run: node --test backend/src/services/workspace-membership.service.test.js

Expected: FAIL because assertWorkspaceMemberAccess and preferenceWrite do not exist.

- [ ] **Step 3: Extract lightweight validation**

~~~js
export const assertWorkspaceMemberAccess = async (userId, workspaceId, { supabaseClient = supabase } = {}) => {
  const [workspace, membership] = await Promise.all([
    getWorkspaceById(workspaceId, { supabaseClient }),
    getWorkspaceMembership(userId, workspaceId, { supabaseClient })
  ])
  if (!workspace || !membership || getWorkspaceKind(workspace) === WORKSPACE_KIND.public) {
    throw new HttpError(404, 'Workspace not found', 'WORKSPACE_NOT_FOUND')
  }
  return { workspace, membership, mapped: mapWorkspace(workspace, membership.role) }
}

export const assertWorkspaceMember = async (userId, workspaceId, { supabaseClient = supabase } = {}) => {
  const { workspace, membership } = await assertWorkspaceMemberAccess(userId, workspaceId, { supabaseClient })
  const memberCount = await countWorkspaceMembers(workspace.id, { supabaseClient })
  return { workspace, membership, mapped: mapWorkspace(workspace, membership.role, memberCount) }
}
~~~

- [ ] **Step 4: Parallelize count and preference persistence**

~~~js
export const setActiveWorkspace = async (userId, workspaceId, { supabaseClient = supabase } = {}) => {
  const { workspace, membership } = await assertWorkspaceMemberAccess(userId, workspaceId, { supabaseClient })
  const preferenceWrite = supabaseClient
    .from('user_workspace_preferences')
    .upsert({
      user_id: userId,
      active_workspace_id: workspace.id,
      updated_at: new Date().toISOString()
    }, { onConflict: 'user_id' })
  const [memberCount, { error }] = await Promise.all([
    countWorkspaceMembers(workspace.id, { supabaseClient }),
    preferenceWrite
  ])
  if (isMissingRelationError(error, 'user_workspace_preferences')) {
    return mapWorkspace(workspace, membership.role, memberCount)
  }
  if (error) throw new HttpError(500, error.message, 'WORKSPACE_SELECT_FAILED')
  return mapWorkspace(workspace, membership.role, memberCount)
}
~~~

- [ ] **Step 5: Verify GREEN and commit**

~~~bash
node --test backend/src/services/workspace-membership.service.test.js backend/src/services/workspace.service.test.js
git add backend/src/services/workspace-membership.service.js backend/src/services/workspace-membership.service.test.js
git commit -m "perf: streamline workspace selection"
~~~

Expected: all tests PASS and the existing selection response shape remains unchanged.

---

### Task 2: Optional Authorized Workspace Scope for Project Lists

**Files:**
- Modify: backend/src/routes/projects.routes.test.js
- Modify: backend/src/routes/projects.routes.js:20-26
- Modify: backend/src/services/projects.service.test.js
- Modify: backend/src/services/projects.service.js:1-18,229-276

**Interfaces:**
- Consumes: assertWorkspaceMemberAccess from Task 1.
- Produces: listProjects(userId, { workspaceId? }); the no-option call is unchanged.

- [ ] **Step 1: Write failing route and service tests**

~~~js
test('project list route forwards optional workspace scope', () => {
  const start = source.indexOf("projectsRouter.get('/',")
  const end = source.indexOf("projectsRouter.post('/',")
  const branch = source.slice(start, end)
  assert.match(branch, /req\.query\.workspaceId/)
  assert.match(branch, /listProjects\(req\.user\.id, \{ workspaceId \}\)/)
})
~~~

~~~js
test('project listing supports authorized explicit scope and preserves direct shares', () => {
  const resolverStart = projectsServiceSource.indexOf('const resolveProjectListWorkspace = async')
  const listStart = projectsServiceSource.indexOf('export const listProjects = async')
  const listEnd = projectsServiceSource.indexOf('export const getProject = async')
  const resolver = projectsServiceSource.slice(resolverStart, listStart)
  const listing = projectsServiceSource.slice(listStart, listEnd)
  assert.match(resolver, /if \(!workspaceId\) return getActiveWorkspace\(userId\)/)
  assert.match(resolver, /assertWorkspaceMemberAccess\(userId, workspaceId\)/)
  assert.match(listing, /listDirectSharedProjectRows\(userId\)/)
  assert.match(listing, /resolveProjectListAccessMap/)
})
~~~

- [ ] **Step 2: Verify RED**

Run: node --test backend/src/routes/projects.routes.test.js backend/src/services/projects.service.test.js

Expected: FAIL because the query is ignored and the resolver is absent.

- [ ] **Step 3: Implement the authorized scope**

Add assertWorkspaceMemberAccess to the current membership imports, then add:

~~~js
const resolveProjectListWorkspace = async (userId, options = {}) => {
  const workspaceId = String(options.workspaceId || '').trim()
  if (!workspaceId) return getActiveWorkspace(userId)
  const { mapped } = await assertWorkspaceMemberAccess(userId, workspaceId)
  return mapped
}
~~~

Change the function signature and active-workspace resolution; do not alter the subsequent query, direct-share merge, permission resolution, or mapping statements:

~~~js
export const listProjects = async (userId, options = {}) => {
  const activeWorkspace = await resolveProjectListWorkspace(userId, options)
~~~

- [ ] **Step 4: Forward the route query**

~~~js
projectsRouter.get('/', asyncHandler(async (req, res) => {
  const workspaceId = typeof req.query.workspaceId === 'string'
    ? req.query.workspaceId.trim()
    : ''
  const projects = await listProjects(req.user.id, { workspaceId })
  res.json({ data: projects })
}))
~~~

- [ ] **Step 5: Verify GREEN and commit**

~~~bash
node --test backend/src/routes/projects.routes.test.js backend/src/services/projects.service.test.js backend/src/services/project-permissions.service.test.js
git add backend/src/routes/projects.routes.js backend/src/routes/projects.routes.test.js backend/src/services/projects.service.js backend/src/services/projects.service.test.js
git commit -m "perf: scope project lists by workspace"
~~~

Expected: all tests PASS; personal, team, direct-share, and permission contracts remain green.

---

### Task 3: Stage Project Lists Behind Ordered Workspace Activation

**Files:**
- Create: src/stores/projectListActivation.js
- Create: src/stores/projectListActivation.test.js
- Create: src/stores/workspaceSelection.test.js
- Modify: src/api/projects.js:20-27
- Modify: src/stores/projects.js:1-20,319-391
- Modify: src/stores/workspace.js:30-40,309-327

**Interfaces:**
- Produces: awaitProjectListActivation({ requestPromise, commitAfter? }).
- Extends: loadProjects({ workspaceId?, commitAfter?, allowLocalFallback? }).
- Preserves: selectWorkspace(workspaceId), with ordered preference writes and stale-response guards.

- [ ] **Step 1: Write failing activation tests**

Create src/stores/projectListActivation.test.js:

~~~js
import assert from 'node:assert/strict'
import test from 'node:test'
import { PROJECT_LIST_ACTIVATION_FAILED, awaitProjectListActivation } from './projectListActivation.js'

test('request resolves early but cannot commit before activation', async () => {
  let release
  const commitAfter = new Promise((resolve) => { release = resolve })
  let settled = false
  const pending = awaitProjectListActivation({
    requestPromise: Promise.resolve({ data: [{ id: 'p1' }] }),
    commitAfter
  }).then((value) => { settled = true; return value })
  await Promise.resolve()
  assert.equal(settled, false)
  release()
  assert.deepEqual(await pending, { data: [{ id: 'p1' }] })
})

test('activation rejection is distinguishable from request failure', async () => {
  const cause = new Error('selection failed')
  await assert.rejects(
    awaitProjectListActivation({
      requestPromise: Promise.resolve({ data: [] }),
      commitAfter: Promise.reject(cause)
    }),
    (error) => error.code === PROJECT_LIST_ACTIVATION_FAILED && error.cause === cause
  )
})
~~~

Create src/stores/workspaceSelection.test.js:

~~~js
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const source = readFileSync(new URL('./workspace.js', import.meta.url), 'utf8')

test('workspace writes are ordered and stale responses are ignored', () => {
  assert.match(source, /let workspaceSelectionQueue = Promise\.resolve\(\)/)
  assert.match(source, /let workspaceSelectionRequestToken = 0/)
  assert.match(source, /workspaceSelectionQueue[\s\S]*apiSelectWorkspace\(workspaceId\)/)
  assert.match(source, /requestToken !== workspaceSelectionRequestToken/)
  assert.match(source, /requestToken === workspaceSelectionRequestToken/)
})
~~~

- [ ] **Step 2: Verify RED**

Run: node --test src/stores/projectListActivation.test.js src/stores/workspaceSelection.test.js

Expected: FAIL because the helper and selection queue are absent.

- [ ] **Step 3: Implement the activation helper**

Create src/stores/projectListActivation.js:

~~~js
export const PROJECT_LIST_ACTIVATION_FAILED = 'PROJECT_LIST_ACTIVATION_FAILED'

const captureRequest = (requestPromise) => Promise.resolve(requestPromise).then(
  (response) => ({ response, error: null }),
  (error) => ({ response: null, error })
)

export const awaitProjectListActivation = async ({ requestPromise, commitAfter = null } = {}) => {
  const requestResult = captureRequest(requestPromise)
  if (commitAfter) {
    try {
      await commitAfter
    } catch (cause) {
      const error = new Error(cause?.message || 'Workspace activation failed', { cause })
      error.code = PROJECT_LIST_ACTIVATION_FAILED
      throw error
    }
  }
  const result = await requestResult
  if (result.error) throw result.error
  return result.response
}
~~~

- [ ] **Step 4: Extend API and project store**

Replace apiListProjects:

~~~js
export const apiListProjects = (options = {}) => {
  const workspaceId = String(options.workspaceId || '').trim()
  return apiRequest({
    url: '/projects',
    method: 'get',
    ...(workspaceId ? { params: { workspaceId } } : {}),
    silentNetworkErrorToast: true
  })
}
~~~

Import the activation helper. Change loadProjects signature and request:

~~~js
export const loadProjects = async ({
  allowLocalFallback = true,
  workspaceId = '',
  commitAfter = null
} = {}) => {
  const requestToken = ++projectListRequestToken
~~~

~~~js
const response = await awaitProjectListActivation({
  requestPromise: apiListProjects({ workspaceId }),
  commitAfter
})
~~~

In the catch block, after the stale-token guard:

~~~js
if (error?.code === PROJECT_LIST_ACTIVATION_FAILED) {
  throw error.cause || error
}
~~~

- [ ] **Step 5: Queue workspace writes**

Add module state:

~~~js
let workspaceSelectionQueue = Promise.resolve()
let workspaceSelectionRequestToken = 0
~~~

Replace selectWorkspace:

~~~js
export const selectWorkspace = async (workspaceId) => {
  if (BYPASS_AUTH_IN_DEV) return setLocalPreviewActiveWorkspace(workspaceId)

  const requestToken = ++workspaceSelectionRequestToken
  const previousWorkspace = currentWorkspace.value
  const optimisticWorkspace = workspaces.value.find((workspace) => workspace.id === workspaceId)
  if (optimisticWorkspace) currentWorkspace.value = optimisticWorkspace

  const selectionRequest = workspaceSelectionQueue
    .catch(() => null)
    .then(() => apiSelectWorkspace(workspaceId))
  workspaceSelectionQueue = selectionRequest.catch(() => null)

  try {
    const response = await selectionRequest
    if (requestToken !== workspaceSelectionRequestToken) return currentWorkspace.value
    applyWorkspaceCollection(response?.data || {})
    return currentWorkspace.value
  } catch (error) {
    if (requestToken === workspaceSelectionRequestToken) currentWorkspace.value = previousWorkspace
    throw error
  }
}
~~~

- [ ] **Step 6: Verify GREEN and commit**

~~~bash
node --test src/stores/projectListActivation.test.js src/stores/workspaceSelection.test.js src/stores/workspaceLocalPreview.test.js src/views/Workspace.test.js
git add src/api/projects.js src/stores/projectListActivation.js src/stores/projectListActivation.test.js src/stores/projects.js src/stores/workspace.js src/stores/workspaceSelection.test.js
git commit -m "perf: parallelize workspace project loading"
~~~

Expected: all tests PASS and failed activation preserves the prior project list.

---

### Task 4: Workspace Skeleton, Card Busy State, and Canvas Preload

**Files:**
- Create: src/router/viewLoaders.js
- Create: src/components/workspace/WorkspaceLoadingGrid.vue
- Modify: src/router/index.js
- Modify: src/components/workspace/WorkspaceCardsGrid.vue
- Modify: src/views/Workspace.test.js
- Modify: src/views/Workspace.vue

**Interfaces:**
- Produces: loadCanvasView and preloadCanvasView.
- Extends WorkspaceCardsGrid with openingProjectId and projectIntent.
- Consumes scoped loadProjects options from Task 3.

- [ ] **Step 1: Write failing view contracts**

Append to src/views/Workspace.test.js:

~~~js
test('workspace switching hides stale cards behind accessible skeletons', () => {
  const loading = readWorkspaceComponentSource('WorkspaceLoadingGrid')
  assert.match(workspaceSource, /WorkspaceLoadingGrid/)
  assert.match(workspaceSource, /<WorkspaceLoadingGrid v-if="workspaceSwitching"/)
  assert.match(workspaceSource, /v-else-if="showsCardsGrid"/)
  assert.match(loading, /role="status"/)
  assert.match(loading, /prefers-reduced-motion/)
})

test('project cards preload on intent and expose selected busy state', () => {
  const cards = readWorkspaceComponentSource('WorkspaceCardsGrid')
  assert.match(cards, /openingProjectId/)
  assert.match(cards, /projectIntent/)
  assert.match(cards, /aria-busy/)
  assert.match(cards, /project-opening-overlay/)
  assert.match(workspaceSource, /preloadCanvasView/)
})

test('workspace switch starts scoped loading before activation settles', () => {
  const start = workspaceSource.indexOf('const handleSelectWorkspace = async')
  const end = workspaceSource.indexOf('const openCreateWorkspaceModal =')
  const branch = workspaceSource.slice(start, end)
  assert.match(branch, /const selection = selectWorkspace\(workspaceId\)/)
  assert.match(branch, /workspaceId,[\s\S]*commitAfter: selection/)
  assert.doesNotMatch(branch, /await selection[\s\S]*loadWorkspaceProjects/)
})
~~~

- [ ] **Step 2: Verify RED**

Run: node --test src/views/Workspace.test.js

Expected: FAIL because the skeleton, preload, busy prop, and scoped coordinator are missing.

- [ ] **Step 3: Share the Canvas importer**

Create src/router/viewLoaders.js:

~~~js
export const loadCanvasView = () => import('@/views/Canvas.vue')
export const preloadCanvasView = () => loadCanvasView().catch(() => null)
~~~

Update the router import and Canvas route exactly:

~~~js
import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { loadCanvasView } from './viewLoaders.js'
~~~

~~~js
{
  path: '/canvas/:id?',
  name: 'Canvas',
  component: loadCanvasView
}
~~~

- [ ] **Step 4: Create the skeleton component**

Create src/components/workspace/WorkspaceLoadingGrid.vue:

~~~vue
<template>
  <section class="workspace-loading-grid" role="status" aria-label="Loading workspace projects">
    <article v-for="index in 6" :key="index" class="workspace-loading-card" aria-hidden="true">
      <div class="workspace-loading-media" />
      <div class="workspace-loading-line title" />
      <div class="workspace-loading-line meta" />
    </article>
  </section>
</template>

<style scoped>
.workspace-loading-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(300px,1fr)); gap:22px; }
.workspace-loading-card { display:flex; flex-direction:column; gap:12px; }
.workspace-loading-media,.workspace-loading-line { position:relative; overflow:hidden; background:rgba(255,255,255,.055); }
.workspace-loading-media { aspect-ratio:16/9; border-radius:24px; box-shadow:0 0 0 1px rgba(255,255,255,.08); }
.workspace-loading-line { height:12px; border-radius:6px; }
.workspace-loading-line.title { width:42%; }
.workspace-loading-line.meta { width:66%; opacity:.7; }
.workspace-loading-media::after,.workspace-loading-line::after {
  content:''; position:absolute; inset:0; transform:translateX(-100%);
  background:linear-gradient(90deg,transparent,rgba(255,255,255,.09),transparent);
  animation:workspace-loading-shimmer 1.25s ease-in-out infinite;
}
@keyframes workspace-loading-shimmer { to { transform:translateX(100%); } }
@media (prefers-reduced-motion:reduce) {
  .workspace-loading-media::after,.workspace-loading-line::after { animation:none; display:none; }
}
</style>
~~~

- [ ] **Step 5: Add card intent and busy UI**

Add openingProjectId string prop; add projectIntent to defineEmits. Bind each article:

~~~vue
:tabindex="activeSection === 'featured' ? -1 : 0"
:aria-busy="openingProjectId === item.id"
@pointerenter="$emit('projectIntent', item)"
@focusin="$emit('projectIntent', item)"
@keydown.enter="$emit('primaryClick', item)"
~~~

Inside card-media add:

~~~vue
<div v-if="openingProjectId === item.id" class="project-opening-overlay" role="status">
  <span class="project-opening-spinner" aria-hidden="true" />
  <span>Opening project</span>
</div>
~~~

Add scoped overlay styles:

~~~css
.project-opening-overlay {
  position:absolute; inset:0; z-index:4; display:flex; align-items:center; justify-content:center; gap:9px;
  background:rgba(8,8,8,.66); color:rgba(255,255,255,.92); font-size:12px; font-weight:500;
  backdrop-filter:blur(6px);
}
.project-opening-spinner {
  width:14px; height:14px; border-radius:999px; box-shadow:inset 0 0 0 1.5px rgba(255,255,255,.22);
  border-top:1.5px solid rgba(255,255,255,.92); animation:project-opening-spin .75s linear infinite;
}
@keyframes project-opening-spin { to { transform:rotate(360deg); } }
@media (prefers-reduced-motion:reduce) { .project-opening-spinner { animation:none; } }
~~~

- [ ] **Step 6: Coordinate Workspace state**

Import onBeforeUnmount, WorkspaceLoadingGrid, and preloadCanvasView. Add:

~~~js
const openingProjectId = ref('')
let canvasPreloadHandle = null

const scheduleCanvasPreload = () => {
  if (typeof window.requestIdleCallback === 'function') {
    canvasPreloadHandle = window.requestIdleCallback(() => {
      canvasPreloadHandle = null
      void preloadCanvasView()
    }, { timeout: 1500 })
    return
  }
  canvasPreloadHandle = window.setTimeout(() => {
    canvasPreloadHandle = null
    void preloadCanvasView()
  }, 300)
}

const cancelCanvasPreload = () => {
  if (canvasPreloadHandle === null) return
  if (typeof window.cancelIdleCallback === 'function') window.cancelIdleCallback(canvasPreloadHandle)
  else window.clearTimeout(canvasPreloadHandle)
  canvasPreloadHandle = null
}
~~~

Call scheduleCanvasPreload after the initial mounted Promise.all settles, and register:

~~~js
onBeforeUnmount(() => {
  cancelCanvasPreload()
})
~~~

Render WorkspaceLoadingGrid when workspaceSwitching, otherwise render WorkspaceCardsGrid with:

~~~vue
:opening-project-id="openingProjectId"
@project-intent="preloadCanvasView"
~~~

Replace project opening:

~~~js
const handlePrimaryClick = async (item) => {
  if (activeSection.value !== 'projects' && activeSection.value !== 'shared') {
    openTemplatePreview(item)
    return
  }
  const id = String(item?.id || '').trim()
  if (!id || openingProjectId.value) return
  openingProjectId.value = id
  void preloadCanvasView()
  try {
    await router.push('/canvas/' + id)
  } catch (error) {
    openingProjectId.value = ''
    notifier.error(getErrorMessage(error, 'Failed to open project'))
  }
}
~~~

Change the loader and switch coordinator:

~~~js
const loadWorkspaceProjects = async (options = {}) => {
  await initProjectsStore({ allowLocalFallback: false, ...options })
}

const handleSelectWorkspace = async (workspaceId) => {
  if (!workspaceId || workspaceId === currentWorkspace.value?.id) return
  const refreshId = ++workspaceSwitchRefreshId
  workspaceSwitching.value = true
  openingProjectId.value = ''
  try {
    const selection = selectWorkspace(workspaceId)
    resetTemplateScopeForCurrentWorkspace()
    activeSection.value = 'projects'
    await loadWorkspaceProjects({ workspaceId, commitAfter: selection })
    if (refreshId !== workspaceSwitchRefreshId) return
    resetTemplateScopeForCurrentWorkspace()
    void loadTemplatesForActiveScope({ preferCache: true }).catch((error) => {
      featuredTemplates.value = []
      notifier.error(getErrorMessage(error, 'Failed to refresh shared templates'))
    })
  } catch (error) {
    if (refreshId === workspaceSwitchRefreshId) {
      notifier.error(getErrorMessage(error, 'Failed to switch workspace'))
    }
  } finally {
    if (refreshId === workspaceSwitchRefreshId) workspaceSwitching.value = false
  }
}
~~~

Replace the existing status-dot style and add:

~~~css
.workspace-switching-status-dot {
  width:12px; height:12px; border-radius:999px;
  box-shadow:inset 0 0 0 1.5px rgba(255,255,255,.2);
  border-top:1.5px solid rgba(255,255,255,.9);
  animation:workspace-switching-spin .75s linear infinite;
}
@keyframes workspace-switching-spin { to { transform:rotate(360deg); } }
@media (prefers-reduced-motion:reduce) { .workspace-switching-status-dot { animation:none; } }
~~~

- [ ] **Step 7: Verify GREEN and commit**

~~~bash
node --test src/views/Workspace.test.js src/stores/projectListActivation.test.js src/stores/workspaceSelection.test.js
git diff --check
git add src/router/viewLoaders.js src/router/index.js src/components/workspace/WorkspaceLoadingGrid.vue src/components/workspace/WorkspaceCardsGrid.vue src/views/Workspace.vue src/views/Workspace.test.js
git commit -m "feat: add workspace loading transitions"
~~~

Expected: tests PASS, stale cards are hidden, and only the selected card becomes busy.

---

### Task 5: Independent Canvas Bootstrap and Recoverable Overlay

**Files:**
- Create: src/components/canvas/CanvasProjectLoadingOverlay.vue
- Modify: src/hooks/useCanvasRouteLifecycle.test.js
- Modify: src/hooks/useCanvasRouteLifecycle.js
- Modify: src/views/Canvas.test.js
- Modify: src/views/Canvas.vue

**Interfaces:**
- Extends useCanvasRouteLifecycle with onProjectLoadStateChange.
- Emits status objects containing status, projectId, and error.
- Produces retryProjectLoad from the lifecycle return.

- [ ] **Step 1: Write failing concurrency/state tests**

Extend the lifecycle harness with:

~~~js
const projectLoadStates = []
~~~

Use these injected functions:

~~~js
initProjectsStore: () => {
  calls.push(['init-projects-store'])
  return overrides.projectsReady || Promise.resolve(overrides.initProjectResult || null)
},
onProjectLoadStateChange: (state) => projectLoadStates.push(state),
refreshProjectById: async (projectId) => {
  calls.push(['refresh-project', projectId])
  if (overrides.refreshError) throw overrides.refreshError
  return overrides.refreshResult || { id: projectId, canvasData: { nodes: [{ id: 'remote' }] } }
},
~~~

Replace the harness getProjectCanvas stub so an explicit null represents no fallback:

~~~js
getProjectCanvas: (projectId) => {
  calls.push(['get-project-canvas', projectId])
  return Object.prototype.hasOwnProperty.call(overrides, 'cachedCanvasData')
    ? overrides.cachedCanvasData
    : { nodes: [{ id: 'cached' }] }
},
~~~

Include projectLoadStates in the object returned by createHarness, then add:

~~~js
test('canvas starts detail without waiting for project list', async () => {
  let releaseProjects
  const projectsReady = new Promise((resolve) => { releaseProjects = resolve })
  const { calls, mountedCallbacks } = createHarness({
    cachedCanvasData: null,
    shouldUseCache: false,
    projectsReady
  })
  const mounted = mountedCallbacks[0]()
  await Promise.resolve()
  await Promise.resolve()
  assert.equal(calls.some((call) => call[0] === 'init-projects-store'), true)
  assert.equal(calls.some((call) => call[0] === 'refresh-project'), true)
  releaseProjects()
  await mounted
})

test('canvas reports ready and unrecoverable error states', async () => {
  const ready = createHarness({ shouldUseCache: false })
  await ready.lifecycle.ensureProjectSnapshot('project-1')
  assert.equal(ready.projectLoadStates.at(-1).status, 'ready')

  const failed = createHarness({
    cachedCanvasData: null,
    shouldUseCache: false,
    refreshError: new Error('detail unavailable')
  })
  await failed.lifecycle.ensureProjectSnapshot('project-1')
  assert.equal(failed.projectLoadStates.at(-1).status, 'error')
  assert.equal(failed.projectLoadStates.at(-1).error, 'detail unavailable')
})
~~~

Append to src/views/Canvas.test.js:

~~~js
test('canvas renders lifecycle loading and recoverable error UI', () => {
  const overlay = readComponentSource('CanvasProjectLoadingOverlay')
  assert.match(canvasSource, /CanvasProjectLoadingOverlay/)
  assert.match(canvasSource, /canvasProjectLoadState/)
  assert.match(canvasSource, /retryProjectLoad/)
  assert.match(overlay, /role="status"/)
  assert.match(overlay, /role="alert"/)
  assert.match(overlay, /prefers-reduced-motion/)
})
~~~

- [ ] **Step 2: Verify RED**

Run: node --test src/hooks/useCanvasRouteLifecycle.test.js src/views/Canvas.test.js

Expected: FAIL because detail waits for list completion and no lifecycle state/overlay exists.

- [ ] **Step 3: Implement lifecycle state and concurrency**

Add this parameter default to useCanvasRouteLifecycle:

~~~js
onProjectLoadStateChange = () => {},
~~~

Replace loadProjectById:

~~~js
const loadProjectById = async (projectId) => {
  flowKey.value = nowFn()
  if (projectId && projectId !== 'new') {
    loadProject(projectId)
    onProjectLoadStateChange({ status: 'ready', projectId, error: '' })
    try {
      await recoverBlankMediaNodes(projectId)
    } catch (error) {
      consoleRef.warn('Blank media recovery skipped:', error?.message || error)
    }
    return true
  }
  resetCanvasSession()
  onProjectLoadStateChange({ status: 'ready', projectId: '', error: '' })
  return true
}
~~~

Replace ensureProjectSnapshot:

~~~js
const ensureProjectSnapshot = async (projectId) => {
  const id = String(projectId || '')
  if (!id || id === 'new') return loadProjectById(id)

  onProjectLoadStateChange({ status: 'loading', projectId: id, error: '' })
  let refreshError = null
  try {
    await refreshProjectById(id)
  } catch (error) {
    refreshError = error
  }

  if (refreshError && !getProjectCanvas(id)) {
    onProjectLoadStateChange({
      status: 'error',
      projectId: id,
      error: refreshError?.message || 'Project could not be loaded'
    })
    return false
  }

  if (!shouldApplyRemoteProjectSnapshotFn({
    refreshedProjectId: id,
    activeRouteProjectId: String(route.params.id || ''),
    currentCanvasProjectId: currentCanvasProjectId.value,
    hasPendingCanvasChanges: hasPendingCanvasChanges()
  })) {
    onProjectLoadStateChange({ status: 'ready', projectId: id, error: '' })
    return true
  }
  return loadProjectById(id)
}
~~~

Replace the mounted list/detail branch:

~~~js
const projectsReady = Promise.resolve(initProjectsStore()).catch((error) => {
  consoleRef.warn('Project list refresh skipped:', error?.message || error)
  return null
})

if (!hasWarmProject) {
  await ensureProjectSnapshot(route.params.id)
} else if (routeProjectId && routeProjectId !== 'new') {
  void refreshProjectById(routeProjectId).then((project) => {
    if (!shouldApplyRemoteProjectSnapshotFn({
      refreshedProjectId: project?.id || routeProjectId,
      activeRouteProjectId: String(route.params.id || ''),
      currentCanvasProjectId: currentCanvasProjectId.value,
      hasPendingCanvasChanges: hasPendingCanvasChanges()
    })) return
    if (!project?.canvasData) return
    return loadProjectById(routeProjectId)
  }).catch(() => {
    // Keep the already-rendered local draft.
  })
}
void projectsReady
~~~

Return this retry function with the existing lifecycle API:

~~~js
retryProjectLoad: () => ensureProjectSnapshot(route.params.id)
~~~

- [ ] **Step 4: Create the overlay component**

Create src/components/canvas/CanvasProjectLoadingOverlay.vue:

~~~vue
<template>
  <div v-if="state.status !== 'ready'" class="canvas-project-loader">
    <div v-if="state.status === 'loading'" class="loader-card" role="status" aria-live="polite">
      <span class="spinner" aria-hidden="true" />
      <strong>Opening project</strong>
      <span>Preparing your canvas and latest saved work.</span>
    </div>
    <div v-else class="loader-card" role="alert">
      <strong>Project could not be opened</strong>
      <span>{{ state.error || 'The project is temporarily unavailable.' }}</span>
      <div class="actions">
        <button type="button" @click="$emit('retry')">Retry</button>
        <button type="button" class="secondary" @click="$emit('back')">Back to workspace</button>
      </div>
    </div>
  </div>
</template>

<script setup>
defineProps({
  state: {
    type: Object,
    default: () => ({ status: 'ready', projectId: '', error: '' })
  }
})
defineEmits(['retry', 'back'])
</script>

<style scoped>
.canvas-project-loader { position:absolute; inset:0; z-index:80; display:grid; place-items:center; background:rgba(8,8,8,.78); backdrop-filter:blur(8px); }
.loader-card { width:min(360px,calc(100vw - 40px)); display:flex; flex-direction:column; align-items:center; gap:10px; padding:24px; border-radius:16px; color:rgba(255,255,255,.92); background:rgba(22,23,26,.96); box-shadow:0 0 0 1px rgba(255,255,255,.1),0 18px 48px rgba(0,0,0,.28); text-align:center; }
.loader-card > span:not(.spinner) { color:rgba(255,255,255,.62); font-size:12px; line-height:1.5; }
.spinner { width:24px; height:24px; border-radius:999px; box-shadow:inset 0 0 0 2px rgba(255,255,255,.18); border-top:2px solid rgba(255,255,255,.92); animation:loader-spin .8s linear infinite; }
.actions { display:flex; gap:8px; margin-top:6px; }
.actions button { height:34px; padding:0 13px; border:0; border-radius:8px; color:#0d0e10; background:#fff; cursor:pointer; }
.actions button.secondary { color:rgba(255,255,255,.82); background:rgba(255,255,255,.08); box-shadow:inset 0 0 0 1px rgba(255,255,255,.1); }
@keyframes loader-spin { to { transform:rotate(360deg); } }
@media (prefers-reduced-motion:reduce) { .spinner { animation:none; } }
</style>
~~~

- [ ] **Step 5: Connect Canvas state**

Import the overlay. Add:

~~~js
const canvasProjectLoadState = ref({
  status: String(route.params.id || '') && route.params.id !== 'new' ? 'loading' : 'ready',
  projectId: String(route.params.id || ''),
  error: ''
})
~~~

Destructure retryProjectLoad from useCanvasRouteLifecycle and pass:

~~~js
onProjectLoadStateChange: (state) => {
  canvasProjectLoadState.value = state
},
~~~

Render after CanvasReadOnlyBanner:

~~~vue
<CanvasProjectLoadingOverlay
  :state="canvasProjectLoadState"
  @retry="retryProjectLoad"
  @back="goWorkspace"
/>
~~~

- [ ] **Step 6: Verify GREEN and commit**

~~~bash
node --test src/hooks/useCanvasRouteLifecycle.test.js src/views/Canvas.test.js
git diff --check
git add src/components/canvas/CanvasProjectLoadingOverlay.vue src/hooks/useCanvasRouteLifecycle.js src/hooks/useCanvasRouteLifecycle.test.js src/views/Canvas.vue src/views/Canvas.test.js
git commit -m "perf: unblock canvas project loading"
~~~

Expected: tests PASS and refresh-project is observed before the deferred list resolves.

---

## Final Verification

- [ ] Run focused tests:

~~~bash
node --test backend/src/services/workspace-membership.service.test.js backend/src/services/workspace.service.test.js backend/src/routes/projects.routes.test.js backend/src/services/projects.service.test.js backend/src/services/project-permissions.service.test.js src/stores/projectListActivation.test.js src/stores/workspaceSelection.test.js src/stores/workspaceLocalPreview.test.js src/views/Workspace.test.js src/hooks/useCanvasRouteLifecycle.test.js src/views/Canvas.test.js
~~~

Expected: all tests PASS with zero failures.

- [ ] Run repository-wide and scope gates:

~~~bash
npm run check
git diff --check origin/main...HEAD
git status --short
git diff --stat origin/main...HEAD
~~~

Expected: exit code 0; only planned files plus design/plan commits differ; docs/PROJECT_HANDOFF_AND_DEPLOYMENT.md remains untracked.

- [ ] Run production build:

~~~bash
npm run build
~~~

Expected: exit code 0. If Vite remains at transforming, capture elapsed time and process state and report the build as blocked, not successful.

- [ ] Use the frontend browser verification skill with network throttling to confirm:

1. Personal to team switching shows spinner and skeleton immediately.
2. No previous-workspace project flashes under the target identity.
3. Rapid A to B to A ends on A before and after refresh.
4. Hover/focus preloads Canvas; clicking marks only that card busy.
5. Canvas overlay remains until usable local or remote data is applied.
6. Forced detail failure exposes Retry and Back to workspace.
7. Reduced-motion removes shimmer/spin while retaining status.
8. Browser console has no new errors or Vue warnings.
