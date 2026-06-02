import assert from 'node:assert/strict'
import test from 'node:test'

import {
  ensurePersonalWorkspace,
  ensurePublicWorkspace,
  mapWorkspace
} from './workspace-membership.service.js'

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
    is_default: false
  })

  assert.equal(workspace.kind, 'personal')
  assert.equal(workspace.schemaVersion, 'modern')
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

test('ensurePersonalWorkspace falls back to legacy profile and workspace columns', async () => {
  const upserts = []
  const workspace = await ensurePersonalWorkspace('user-1', {
    supabaseClient: createLegacyWorkspaceClient({ upserts })
  })
  const workspaceUpserts = upserts.filter((item) => item.table === 'workspaces')

  assert.equal(workspace.slug, 'personal-user-1')
  assert.equal(workspace.name, 'user-1 Workspace')
  assert.equal(workspaceUpserts.length, 2)
  assert.equal(Object.prototype.hasOwnProperty.call(workspaceUpserts[0].row, 'kind'), true)
  assert.equal(Object.prototype.hasOwnProperty.call(workspaceUpserts[1].row, 'kind'), false)
  assert.equal(Object.prototype.hasOwnProperty.call(workspaceUpserts[1].row, 'avatar_url'), false)
  assert.equal(Object.prototype.hasOwnProperty.call(workspaceUpserts[1].row, 'created_by'), false)
})
