import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const routesSource = readFileSync(new URL('./workspace.routes.js', import.meta.url), 'utf8')

test('workspace routes expose owner update and delete team endpoints', () => {
  assert.match(routesSource, /updateTeamWorkspace/)
  assert.match(routesSource, /deleteTeamWorkspace/)
  assert.match(routesSource, /workspaceRouter\.patch\('\/workspaces\/:workspaceId'/)
  assert.match(routesSource, /workspaceRouter\.delete\('\/workspaces\/:workspaceId'/)
})
