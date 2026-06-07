import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

import {
  countWorkspaceMembersByWorkspaceId,
  ensurePersonalWorkspace,
  ensurePublicWorkspace,
  getActiveWorkspace,
  mapWorkspace
} from './workspace-membership.service.js'

const workspaceMembershipSource = readFileSync(new URL('./workspace-membership.service.js', import.meta.url), 'utf8')

const missingColumnError = (table, column) => ({
  code: 'PGRST204',
  message: `Could not find the '${column}' column of '${table}' in the schema cache`
})

const createLegacyWorkspaceClient = ({ upserts = [] } = {}) => ({
  from(table) {
    const query = {
      filters: {},
      row: null,
      selected: '',
      select(columns) {
        this.selected = columns
        return this
      },
      eq(column, value) {
        this.filters[column] = value
        return this
      },
      upsert(row) {
        this.row = row
        upserts.push({ table, row })
        return this
      },
      maybeSingle: async () => {
        if (table === 'users') {
          return { data: { id: query.filters.id, email: 'hale@example.com' }, error: null }
        }
        if (table === 'user_profiles') {
          if (String(query.selected || '').includes('username')) {
            return { data: null, error: missingColumnError('user_profiles', 'username') }
          }
          return { data: { user_id: query.filters.user_id, display_name: '', avatar_url: '' }, error: null }
        }
        return { data: null, error: null }
      },
      single: async () => {
        if (table === 'workspaces') {
          if (
            Object.prototype.hasOwnProperty.call(query.row || {}, 'kind') ||
            Object.prototype.hasOwnProperty.call(query.row || {}, 'avatar_url') ||
            Object.prototype.hasOwnProperty.call(query.row || {}, 'created_by')
          ) {
            return { data: null, error: missingColumnError('workspaces', 'kind') }
          }
          return {
            data: {
              id: query.row.slug === 'shared-workspace' ? 'public-workspace' : 'personal-workspace',
              slug: query.row.slug,
              name: query.row.name,
              is_default: query.row.is_default
            },
            error: null
          }
        }
        return { data: null, error: null }
      },
      then(resolve, reject) {
        if (table === 'workspace_members') {
          return Promise.resolve({ data: null, error: null }).then(resolve, reject)
        }
        return Promise.resolve({ data: null, error: null }).then(resolve, reject)
      }
    }
    return query
  }
})

const createWorkspaceMemberCountClient = ({ members = [] } = {}) => {
  const calls = []
  return {
    calls,
    from(table) {
      const query = {
        inFilters: {},
        select() {
          calls.push(['select', table])
          return this
        },
        in(column, values) {
          this.inFilters[column] = values
          return this
        },
        resolve() {
          if (table !== 'workspace_members') return { data: [], error: null }
          return {
            data: members.filter((member) => (
              (this.inFilters.workspace_id || []).includes(member.workspace_id)
            )),
            error: null
          }
        },
        then(resolve, reject) {
          return Promise.resolve(this.resolve()).then(resolve, reject)
        }
      }
      return query
    }
  }
}

const createExistingWorkspaceClient = () => {
  const calls = []
  const workspaces = new Map([
    ['shared-workspace', {
      id: 'public-workspace',
      slug: 'shared-workspace',
      name: 'Community',
      kind: 'public',
      is_default: true
    }],
    ['personal-user-1', {
      id: 'personal-workspace',
      slug: 'personal-user-1',
      name: 'User Space',
      kind: 'personal',
      is_default: false,
      created_by: 'user-1'
    }]
  ])

  return {
    calls,
    from(table) {
      const query = {
        filters: {},
        row: null,
        select(columns) {
          calls.push(['select', table, columns])
          return this
        },
        eq(column, value) {
          this.filters[column] = value
          return this
        },
        upsert(row) {
          this.row = row
          calls.push(['upsert', table, row])
          return this
        },
        maybeSingle: async () => {
          calls.push(['maybeSingle', table, { ...query.filters }])
          if (table === 'workspaces') {
            if (query.filters.slug) return { data: workspaces.get(query.filters.slug) || null, error: null }
            if (query.filters.id === 'personal-workspace') return { data: workspaces.get('personal-user-1'), error: null }
            return { data: null, error: null }
          }
          if (table === 'workspace_members') {
            if (query.filters.workspace_id === 'personal-workspace' && query.filters.user_id === 'user-1') {
              return { data: { workspace_id: 'personal-workspace', user_id: 'user-1', role: 'owner' }, error: null }
            }
            return { data: null, error: null }
          }
          if (table === 'user_workspace_preferences') {
            return { data: { active_workspace_id: 'personal-workspace' }, error: null }
          }
          if (table === 'users') {
            return { data: { id: query.filters.id, email: 'hale@example.com' }, error: null }
          }
          if (table === 'user_profiles') {
            return { data: { user_id: query.filters.user_id, display_name: 'Hale', avatar_url: '' }, error: null }
          }
          return { data: null, error: null }
        },
        single: async () => {
          calls.push(['single', table])
          if (table === 'workspaces') {
            return { data: { id: `${query.row.slug}-created`, ...query.row }, error: null }
          }
          return { data: query.row, error: null }
        },
        then(resolve, reject) {
          calls.push(['then', table, { ...query.filters }])
          if (table === 'workspace_members') {
            return Promise.resolve({ data: [], error: null }).then(resolve, reject)
          }
          return Promise.resolve({ data: [], error: null }).then(resolve, reject)
        }
      }
      return query
    }
  }
}

test('mapWorkspace infers public and personal kinds from legacy workspace rows', () => {
  const publicWorkspace = mapWorkspace({ id: 'public-1', slug: 'shared-workspace', name: 'Shared Workspace', is_default: true })
  const personalWorkspace = mapWorkspace({ id: 'personal-1', slug: 'personal-user-1', name: 'Personal Workspace', is_default: false })

  assert.equal(publicWorkspace.kind, 'public')
  assert.equal(personalWorkspace.kind, 'personal')
  assert.equal(publicWorkspace.schemaVersion, 'legacy')
  assert.equal(personalWorkspace.schemaVersion, 'legacy')
})

test('mapWorkspace marks modern workspace rows when kind exists', () => {
  const workspace = mapWorkspace({
    id: 'personal-1',
    slug: 'personal-user-1',
    name: 'Personal Workspace',
    kind: 'personal',
    is_default: false,
    created_by: 'user-1'
  })

  assert.equal(workspace.kind, 'personal')
  assert.equal(workspace.schemaVersion, 'modern')
  assert.equal(workspace.createdBy, 'user-1')
})

test('countWorkspaceMembersByWorkspaceId batches workspace member counts', async () => {
  const supabaseClient = createWorkspaceMemberCountClient({
    members: [
      { workspace_id: 'workspace-1', user_id: 'user-1' },
      { workspace_id: 'workspace-1', user_id: 'user-2' },
      { workspace_id: 'workspace-2', user_id: 'user-1' },
      { workspace_id: 'workspace-3', user_id: 'user-3' }
    ]
  })

  const counts = await countWorkspaceMembersByWorkspaceId(['workspace-1', 'workspace-2'], { supabaseClient })

  assert.equal(counts.get('workspace-1'), 2)
  assert.equal(counts.get('workspace-2'), 1)
  assert.equal(counts.has('workspace-3'), false)
  assert.equal(supabaseClient.calls.filter((call) => call[1] === 'workspace_members').length, 1)
})

test('ensurePublicWorkspace falls back to legacy workspace columns when kind is missing', async () => {
  const upserts = []
  const workspace = await ensurePublicWorkspace({
    supabaseClient: createLegacyWorkspaceClient({ upserts })
  })

  assert.equal(workspace.slug, 'shared-workspace')
  assert.equal(upserts.length, 2)
  assert.equal(upserts[0].row.kind, 'public')
  assert.equal(Object.prototype.hasOwnProperty.call(upserts[1].row, 'kind'), false)
})

test('ensurePublicWorkspace reuses existing public workspace without writing on read paths', async () => {
  const supabaseClient = createExistingWorkspaceClient()

  const workspace = await ensurePublicWorkspace({ supabaseClient })

  assert.equal(workspace.id, 'public-workspace')
  assert.equal(workspace.slug, 'shared-workspace')
  assert.deepEqual(
    supabaseClient.calls.filter((call) => call[0] === 'upsert'),
    []
  )
})

test('getActiveWorkspace reuses existing personal workspace and membership without workspace upserts', async () => {
  const supabaseClient = createExistingWorkspaceClient()

  const workspace = await getActiveWorkspace('user-1', { supabaseClient })

  assert.equal(workspace.id, 'personal-workspace')
  assert.equal(workspace.kind, 'personal')
  assert.deepEqual(
    supabaseClient.calls.filter((call) => call[0] === 'upsert'),
    []
  )
  assert.equal(supabaseClient.calls.some((call) => call[1] === 'users'), false)
  assert.equal(supabaseClient.calls.some((call) => call[1] === 'user_profiles'), false)
})

test('ensurePersonalWorkspace falls back to legacy profile and workspace columns', async () => {
  const upserts = []
  const workspace = await ensurePersonalWorkspace('user-1', {
    supabaseClient: createLegacyWorkspaceClient({ upserts })
  })
  const workspaceUpserts = upserts.filter((item) => item.table === 'workspaces')

  assert.equal(workspace.slug, 'personal-user-1')
  assert.equal(workspace.name, 'user-1 Space')
  assert.equal(workspaceUpserts.length, 2)
  assert.equal(Object.prototype.hasOwnProperty.call(workspaceUpserts[0].row, 'kind'), true)
  assert.equal(Object.prototype.hasOwnProperty.call(workspaceUpserts[1].row, 'kind'), false)
  assert.equal(Object.prototype.hasOwnProperty.call(workspaceUpserts[1].row, 'avatar_url'), false)
  assert.equal(Object.prototype.hasOwnProperty.call(workspaceUpserts[1].row, 'created_by'), false)
})

test('ensurePersonalWorkspace names personal spaces from the user display identity', async () => {
  const upserts = []
  const supabaseClient = createLegacyWorkspaceClient({ upserts })
  const originalFrom = supabaseClient.from
  supabaseClient.from = (table) => {
    const query = originalFrom(table)
    if (table === 'user_profiles') {
      query.maybeSingle = async () => ({
        data: {
          user_id: query.filters.user_id,
          display_name: '  Hale  ',
          username: 'hale',
          avatar_url: 'https://example.com/avatar.png'
        },
        error: null
      })
    }
    return query
  }

  const workspace = await ensurePersonalWorkspace('83092d16-116c-4dcf-b154-c9c69389ea39', { supabaseClient })
  const workspaceUpserts = upserts.filter((item) => item.table === 'workspaces')

  assert.equal(workspace.name, 'Hale Space')
  assert.equal(workspaceUpserts[0].row.name, 'Hale Space')
})

test('workspace membership service exposes owner-only team update and delete helpers', () => {
  assert.match(workspaceMembershipSource, /export const updateTeamWorkspace = async/)
  assert.match(workspaceMembershipSource, /export const deleteTeamWorkspace = async/)
  assert.match(workspaceMembershipSource, /teamWorkspaceSchema\.parse\(input \|\| \{\}\)/)
  assert.match(workspaceMembershipSource, /assertWorkspaceOwner\(userId, workspaceId/)
  assert.match(workspaceMembershipSource, /getWorkspaceKind\(workspace\) !== WORKSPACE_KIND\.team/)
  assert.match(workspaceMembershipSource, /\.from\('workspaces'\)[\s\S]*\.update\(\{[\s\S]*name: payload\.name/)
  assert.match(workspaceMembershipSource, /\.from\('workspaces'\)[\s\S]*\.delete\(\)[\s\S]*\.eq\('id', workspaceId\)/)
  assert.match(workspaceMembershipSource, /deletedWorkspaceId: workspaceId/)
})
