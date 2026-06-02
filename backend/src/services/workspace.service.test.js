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
