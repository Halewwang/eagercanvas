import assert from 'node:assert/strict'
import test from 'node:test'

import { transferSuspendedUserTeamProjects } from './workspace-ownership-transfer.service.js'

const createQuery = ({ table, calls, rows }) => {
  const state = {
    table,
    op: 'select',
    filters: [],
    inFilters: [],
    payload: null,
    conflict: ''
  }

  const query = {
    select(columns) {
      calls.push([table, 'select', columns])
      return this
    },
    eq(column, value) {
      state.filters.push([column, value])
      calls.push([table, 'eq', column, value])
      return this
    },
    in(column, values) {
      state.inFilters.push([column, values])
      calls.push([table, 'in', column, values])
      return this
    },
    update(payload) {
      state.op = 'update'
      state.payload = payload
      calls.push([table, 'update', payload])
      return this
    },
    upsert(payload, options = {}) {
      state.op = 'upsert'
      state.payload = payload
      state.conflict = options.onConflict || ''
      calls.push([table, 'upsert', payload, options])
      return Promise.resolve({ data: null, error: null })
    },
    delete() {
      state.op = 'delete'
      calls.push([table, 'delete'])
      return this
    },
    then(resolve, reject) {
      return Promise.resolve(resolveState(state, rows)).then(resolve, reject)
    }
  }

  return query
}

const matchesFilters = (row, filters = [], inFilters = []) => {
  for (const [column, value] of filters) {
    if (row[column] !== value) return false
  }
  for (const [column, values] of inFilters) {
    if (!values.includes(row[column])) return false
  }
  return true
}

const resolveState = (state, rows) => {
  if (state.op === 'select') {
    return {
      data: (rows[state.table] || []).filter((row) => matchesFilters(row, state.filters, state.inFilters)),
      error: null
    }
  }
  return { data: null, error: null }
}

const createTransferClient = (rows) => {
  const calls = []
  return {
    calls,
    from(table) {
      return createQuery({ table, calls, rows })
    }
  }
}

test('transferSuspendedUserTeamProjects transfers team projects to active workspace creator', async () => {
  const supabaseClient = createTransferClient({
    projects: [
      { id: 'project-1', user_id: 'suspended-1', workspace_id: 'team-1', access_mode: 'team' },
      { id: 'project-2', user_id: 'suspended-1', workspace_id: 'team-1', access_mode: 'team' }
    ],
    workspaces: [{ id: 'team-1', kind: 'team', created_by: 'creator-1' }],
    workspace_members: [
      { workspace_id: 'team-1', user_id: 'creator-1', role: 'member' },
      { workspace_id: 'team-1', user_id: 'owner-2', role: 'owner' }
    ],
    users: [
      { id: 'creator-1', status: 'active', deleted_at: null },
      { id: 'owner-2', status: 'active', deleted_at: null },
      { id: 'admin-1', status: 'active', deleted_at: null }
    ]
  })

  const result = await transferSuspendedUserTeamProjects({
    targetUserId: 'suspended-1',
    operatorUserId: 'admin-1',
    supabaseClient
  })

  assert.equal(result.transferredProjectCount, 2)
  assert.deepEqual(result.transfers.map((item) => item.toUserId), ['creator-1'])
  assert.deepEqual(supabaseClient.calls.filter((call) => call[0] === 'projects' && call[1] === 'update'), [
    ['projects', 'update', { user_id: 'creator-1' }]
  ])
  assert.deepEqual(supabaseClient.calls.find((call) => call[0] === 'project_members' && call[1] === 'upsert')?.[2], [
    { project_id: 'project-1', user_id: 'creator-1', role: 'owner', granted_by: 'admin-1' },
    { project_id: 'project-2', user_id: 'creator-1', role: 'owner', granted_by: 'admin-1' }
  ])
  assert.deepEqual(supabaseClient.calls.find((call) => call[0] === 'workspace_members' && call[1] === 'upsert')?.[2], {
    workspace_id: 'team-1',
    user_id: 'creator-1',
    role: 'owner'
  })
})

test('transferSuspendedUserTeamProjects falls back to active owner then operator', async () => {
  const supabaseClient = createTransferClient({
    projects: [
      { id: 'project-1', user_id: 'suspended-1', workspace_id: 'team-1', access_mode: 'team' },
      { id: 'project-2', user_id: 'suspended-1', workspace_id: 'team-2', access_mode: 'team' }
    ],
    workspaces: [
      { id: 'team-1', kind: 'team', created_by: 'creator-1' },
      { id: 'team-2', kind: 'team', created_by: 'creator-2' }
    ],
    workspace_members: [
      { workspace_id: 'team-1', user_id: 'owner-2', role: 'owner' },
      { workspace_id: 'team-2', user_id: 'suspended-1', role: 'owner' }
    ],
    users: [
      { id: 'creator-1', status: 'suspended', deleted_at: null },
      { id: 'creator-2', status: 'deleted', deleted_at: '2026-07-01T00:00:00.000Z' },
      { id: 'owner-2', status: 'active', deleted_at: null },
      { id: 'admin-1', status: 'active', deleted_at: null }
    ]
  })

  const result = await transferSuspendedUserTeamProjects({
    targetUserId: 'suspended-1',
    operatorUserId: 'admin-1',
    supabaseClient
  })

  assert.equal(result.transferredProjectCount, 2)
  assert.deepEqual(result.transfers.map((item) => [item.workspaceId, item.toUserId]), [
    ['team-1', 'owner-2'],
    ['team-2', 'admin-1']
  ])
})
