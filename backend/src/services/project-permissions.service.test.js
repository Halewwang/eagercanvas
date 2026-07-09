import assert from 'node:assert/strict'
import test from 'node:test'

import {
  assertProjectCanEdit,
  resolveProjectAccess,
  resolveProjectListAccessMap
} from './project-permissions.service.js'

const createFakeProjectAccessClient = ({ projectMembers = [], workspaceMembers = [] } = {}) => ({
  from(table) {
    const query = {
      filters: {},
      select() { return this },
      eq(column, value) {
        this.filters[column] = value
        return this
      },
      maybeSingle: async () => {
        if (table === 'project_members') {
          const row = projectMembers.find((item) => (
            item.project_id === query.filters.project_id &&
            item.user_id === query.filters.user_id
          ))
          return { data: row || null, error: null }
        }
        if (table === 'workspace_members') {
          const row = workspaceMembers.find((item) => (
            item.workspace_id === query.filters.workspace_id &&
            item.user_id === query.filters.user_id
          ))
          return { data: row || null, error: null }
        }
        return { data: null, error: null }
      }
    }
    return query
  }
})

const createFakeProjectListAccessClient = ({ projectMembers = [], workspaceMembers = [] } = {}) => {
  const calls = []

  return {
    calls,
    from(table) {
      const query = {
        filters: {},
        inFilters: {},
        select() {
          calls.push(['select', table])
          return this
        },
        eq(column, value) {
          this.filters[column] = value
          return this
        },
        in(column, values) {
          this.inFilters[column] = values
          return this
        },
        resolve() {
          if (table === 'project_members') {
            return {
              data: projectMembers.filter((item) => (
                item.user_id === this.filters.user_id &&
                (this.inFilters.project_id || []).includes(item.project_id)
              )),
              error: null
            }
          }
          if (table === 'workspace_members') {
            return {
              data: workspaceMembers.filter((item) => (
                item.user_id === this.filters.user_id &&
                (this.inFilters.workspace_id || []).includes(item.workspace_id)
              )),
              error: null
            }
          }
          return { data: [], error: null }
        },
        then(resolve, reject) {
          return Promise.resolve(this.resolve()).then(resolve, reject)
        }
      }
      return query
    }
  }
}

test('resolveProjectAccess treats team members as read-only viewers until granted edit rights', async () => {
  const project = {
    id: 'project-1',
    user_id: 'owner-1',
    workspace_id: 'team-1',
    access_mode: 'team'
  }
  const supabaseClient = createFakeProjectAccessClient({
    workspaceMembers: [{ workspace_id: 'team-1', user_id: 'member-1', role: 'member' }],
    projectMembers: [{ project_id: 'project-1', user_id: 'editor-1', role: 'editor' }]
  })

  assert.equal(await resolveProjectAccess('owner-1', project, { supabaseClient }), 'owner')
  assert.equal(await resolveProjectAccess('member-1', project, { supabaseClient }), 'viewer')
  assert.equal(await resolveProjectAccess('editor-1', project, { supabaseClient }), 'editor')
  assert.equal(await resolveProjectAccess('outsider-1', project, { supabaseClient }), 'none')
})

test('resolveProjectAccess treats workspace owners as team project owners', async () => {
  const project = {
    id: 'project-1',
    user_id: 'owner-1',
    workspace_id: 'team-1',
    access_mode: 'team'
  }
  const supabaseClient = createFakeProjectAccessClient({
    workspaceMembers: [
      { workspace_id: 'team-1', user_id: 'workspace-owner-1', role: 'owner' },
      { workspace_id: 'team-1', user_id: 'member-1', role: 'member' }
    ],
    projectMembers: [
      { project_id: 'project-1', user_id: 'workspace-owner-1', role: 'viewer' }
    ]
  })

  assert.equal(await resolveProjectAccess('workspace-owner-1', project, { supabaseClient }), 'owner')
  assert.equal(await assertProjectCanEdit('workspace-owner-1', project, { supabaseClient }), 'owner')
  assert.equal(await resolveProjectAccess('member-1', project, { supabaseClient }), 'viewer')
})

test('resolveProjectAccess treats directly shared project members as viewers', async () => {
  const project = {
    id: 'project-1',
    user_id: 'owner-1',
    workspace_id: 'personal-1',
    access_mode: 'private'
  }
  const supabaseClient = createFakeProjectAccessClient({
    projectMembers: [{ project_id: 'project-1', user_id: 'viewer-1', role: 'viewer' }]
  })

  assert.equal(await resolveProjectAccess('viewer-1', project, { supabaseClient }), 'viewer')
})

test('resolveProjectListAccessMap batches project and workspace membership lookups', async () => {
  const rows = [
    { id: 'owned-1', user_id: 'user-1', workspace_id: 'personal-1', access_mode: 'private' },
    { id: 'direct-1', user_id: 'owner-2', workspace_id: 'personal-2', access_mode: 'private' },
    { id: 'direct-editor-1', user_id: 'owner-2', workspace_id: 'team-1', access_mode: 'team' },
    { id: 'editor-1', user_id: 'owner-3', workspace_id: 'team-1', access_mode: 'team' },
    { id: 'team-viewer-1', user_id: 'owner-4', workspace_id: 'team-1', access_mode: 'team' },
    { id: 'outsider-1', user_id: 'owner-5', workspace_id: 'team-2', access_mode: 'team' },
    { id: 'private-1', user_id: 'owner-6', workspace_id: 'personal-3', access_mode: 'private' }
  ]
  const supabaseClient = createFakeProjectListAccessClient({
    projectMembers: [
      { project_id: 'direct-editor-1', user_id: 'user-1', role: 'editor' },
      { project_id: 'editor-1', user_id: 'user-1', role: 'editor' }
    ],
    workspaceMembers: [
      { workspace_id: 'team-1', user_id: 'user-1', role: 'owner' }
    ]
  })

  const accessByProjectId = await resolveProjectListAccessMap('user-1', rows, {
    directSharedIds: new Set(['direct-1', 'direct-editor-1']),
    supabaseClient
  })

  assert.equal(accessByProjectId.get('owned-1'), 'owner')
  assert.equal(accessByProjectId.get('direct-1'), 'viewer')
  assert.equal(accessByProjectId.get('direct-editor-1'), 'owner')
  assert.equal(accessByProjectId.get('editor-1'), 'owner')
  assert.equal(accessByProjectId.get('team-viewer-1'), 'owner')
  assert.equal(accessByProjectId.get('outsider-1'), 'none')
  assert.equal(accessByProjectId.get('private-1'), 'none')
  assert.equal(supabaseClient.calls.filter((call) => call[1] === 'project_members').length, 1)
  assert.equal(supabaseClient.calls.filter((call) => call[1] === 'workspace_members').length, 1)
})

test('assertProjectCanEdit rejects team viewers before project mutation', async () => {
  const project = {
    id: 'project-1',
    user_id: 'owner-1',
    workspace_id: 'team-1',
    access_mode: 'team'
  }
  const supabaseClient = createFakeProjectAccessClient({
    workspaceMembers: [{ workspace_id: 'team-1', user_id: 'member-1', role: 'member' }]
  })

  await assert.rejects(
    () => assertProjectCanEdit('member-1', project, { supabaseClient }),
    (error) => {
      assert.equal(error.status, 403)
      assert.equal(error.code, 'PROJECT_EDIT_PERMISSION_REQUIRED')
      return true
    }
  )
})
