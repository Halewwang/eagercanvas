import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const workspaceServiceSource = readFileSync(new URL('./workspace.service.js', import.meta.url), 'utf8')

test('selectWorkspace returns only the selected active workspace for fast switching', () => {
  const start = workspaceServiceSource.indexOf('export const selectWorkspace = async')
  const end = workspaceServiceSource.indexOf('export const updateTeamWorkspace = async')
  const selectWorkspaceSource = workspaceServiceSource.slice(start, end)

  assert.match(selectWorkspaceSource, /const activeWorkspace = await setActiveWorkspace\(userId, workspaceId\)/)
  assert.match(selectWorkspaceSource, /return \{ activeWorkspace \}/)
  assert.doesNotMatch(selectWorkspaceSource, /listUserWorkspaces\(userId\)/)
})

test('workspace template list returns lightweight summaries while detail returns canvas data', () => {
  const listStart = workspaceServiceSource.indexOf('export const listTemplatesByScope = async')
  const listEnd = workspaceServiceSource.indexOf('export const listFeaturedTemplates = async')
  const listTemplatesSource = workspaceServiceSource.slice(listStart, listEnd)
  const detailStart = workspaceServiceSource.indexOf('export const getSharedTemplateDetail = async')
  const detailEnd = workspaceServiceSource.indexOf('export const getProjectTemplateStatus = async')
  const detailSource = workspaceServiceSource.slice(detailStart, detailEnd)

  assert.match(workspaceServiceSource, /const TEMPLATE_LIST_COLUMNS = /)
  assert.doesNotMatch(workspaceServiceSource.match(/const TEMPLATE_LIST_COLUMNS = [\s\S]*?\n/)?.[0] || '', /canvas_json/)
  assert.match(listTemplatesSource, /templates: await mapTemplateSummariesForRead/)
  assert.doesNotMatch(listTemplatesSource, /templates: await mapTemplatesForRead/)
  assert.match(detailSource, /template: await mapTemplate\(data/)
})
