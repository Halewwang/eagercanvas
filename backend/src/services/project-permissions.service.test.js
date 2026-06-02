import assert from 'node:assert/strict'
import test from 'node:test'

import {
  assertProjectCanEdit,
  resolveProjectAccess
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
