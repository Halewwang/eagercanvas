import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

import {
  applyProjectListWorkspaceFilter,
  mergeProjectListRows,
  shouldUseLegacyPersonalProjectList
} from './projects.service.js'

const projectsServiceSource = readFileSync(new URL('./projects.service.js', import.meta.url), 'utf8')

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

test('project listing merges direct shares without duplicating active workspace rows', () => {
  const rows = mergeProjectListRows(
    [
      { id: 'owned-1', updated_at: '2026-06-03T10:00:00.000Z' },
      { id: 'shared-1', updated_at: '2026-06-03T09:00:00.000Z' }
    ],
    [
      { id: 'shared-2', updated_at: '2026-06-03T11:00:00.000Z' },
      { id: 'shared-1', updated_at: '2026-06-03T12:00:00.000Z' }
    ]
  )

  assert.deepEqual(rows.map((row) => row.id), ['shared-2', 'owned-1', 'shared-1'])
})

test('project copy and direct sharing stay scoped to personal owner projects', () => {
  assert.match(projectsServiceSource, /PERSONAL_PROJECT_COPY_REQUIRED/)
  assert.match(projectsServiceSource, /Only personal projects can be copied to a team workspace/)
  assert.match(projectsServiceSource, /PERSONAL_PROJECT_SHARE_REQUIRED/)
  assert.match(projectsServiceSource, /Only personal projects can be shared with a user/)
})

test('project listing uses batched access resolution instead of per-row permission lookups', () => {
  const start = projectsServiceSource.indexOf('export const listProjects = async')
  const end = projectsServiceSource.indexOf('export const getProject = async')
  const listProjectsSource = projectsServiceSource.slice(start, end)

  assert.match(listProjectsSource, /resolveProjectListAccessMap\(userId, rows, \{ directSharedIds \}\)/)
  assert.doesNotMatch(listProjectsSource, /await resolveProjectAccess\(userId, row\)/)
})
