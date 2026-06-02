import assert from 'node:assert/strict'
import test from 'node:test'

import {
  applyProjectListWorkspaceFilter,
  shouldUseLegacyPersonalProjectList
} from './projects.service.js'

const createProjectListQueryRecorder = () => ({
  filters: [],
  eq(column, value) {
    this.filters.push(['eq', column, value])
    return this
  },
  or(filters) {
    this.filters.push(['or', filters])
    return this
  }
})

test('personal workspace project listing includes legacy projects without workspace ids', () => {
  const query = createProjectListQueryRecorder()

  applyProjectListWorkspaceFilter(query, { id: 'personal-workspace-1', kind: 'personal' }, 'user-1')

  assert.deepEqual(query.filters, [
    ['or', 'workspace_id.eq.personal-workspace-1,workspace_id.is.null'],
    ['eq', 'user_id', 'user-1']
  ])
})

test('legacy personal workspace project listing reads by owner without workspace columns', () => {
  const query = createProjectListQueryRecorder()
  const activeWorkspace = { id: 'personal-workspace-1', kind: 'personal', schemaVersion: 'legacy' }

  assert.equal(shouldUseLegacyPersonalProjectList(activeWorkspace), true)
  applyProjectListWorkspaceFilter(query, activeWorkspace, 'user-1')

  assert.deepEqual(query.filters, [
    ['eq', 'user_id', 'user-1']
  ])
})

test('team workspace project listing remains scoped to team projects only', () => {
  const query = createProjectListQueryRecorder()

  applyProjectListWorkspaceFilter(query, { id: 'team-workspace-1', kind: 'team' }, 'user-1')

  assert.deepEqual(query.filters, [
    ['eq', 'workspace_id', 'team-workspace-1'],
    ['eq', 'access_mode', 'team']
  ])
})
