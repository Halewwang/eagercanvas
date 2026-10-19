import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

import { transferSuspendedUserTeamProjects } from './workspace-ownership-transfer.service.js'

const source = readFileSync(new URL('./workspace-ownership-transfer.service.js', import.meta.url), 'utf8')
const migration = readFileSync(new URL('../../../supabase/016_admin_rbac_lifecycle.sql', import.meta.url), 'utf8')

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
    rpc(name, payload) {
      calls.push(['rpc', name, payload])
      return Promise.resolve({ data: payload.p_project_ids.length, error: null })
    },
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
      { id: 'suspended-1', status: 'suspending', suspension_event_id: 'event-1' },
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
  assert.deepEqual(supabaseClient.calls.find((call) => call[0] === 'rpc')?.slice(1), [
    'admin_transfer_workspace_projects_atomic',
    {
      p_event_id: 'event-1',
      p_workspace_id: 'team-1',
      p_project_ids: ['project-1', 'project-2'],
      p_from_user_id: 'suspended-1',
      p_to_user_id: 'creator-1',
      p_operator_user_id: 'admin-1'
    }
  ])
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
      { id: 'suspended-1', status: 'suspending', suspension_event_id: 'event-2' },
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

test('workspace lifecycle transfer delegates each exact plan and owner membership to database triggers', () => {
  const transferStart = migration.indexOf('create or replace function public.admin_transfer_workspace_projects_atomic')
  const transferEnd = migration.indexOf('revoke execute on function public.admin_transfer_workspace_projects_atomic', transferStart)
  const transferFunction = migration.slice(transferStart, transferEnd)

  assert.match(source, /rpc\('admin_transfer_workspace_projects_atomic'/)
  assert.match(source, /admin_workspace_transfer_plans/)
  assert.doesNotMatch(source, /from\('projects'\)[\s\S]+\.update\(\{ user_id: toUserId \}\)/)
  assert.match(migration, /create table if not exists public\.admin_workspace_transfer_plans/i)
  assert.match(migration, /create or replace function public\.admin_transfer_workspace_projects_atomic/i)
  assert.match(transferFunction, /insert into public\.workspace_members/i)
  assert.doesNotMatch(transferFunction, /insert into public\.project_members/i)
  assert.doesNotMatch(transferFunction, /delete from public\.project_members/i)
  assert.match(migration, /create or replace function public\.admin_sync_project_owner_membership\(\)/i)
  assert.match(migration, /create or replace function public\.admin_enforce_project_member_owner_integrity\(\)/i)
  assert.match(migration, /create trigger trg_project_members_owner_integrity\s+before insert or update on public\.project_members/i)
})
