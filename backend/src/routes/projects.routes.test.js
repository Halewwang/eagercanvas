import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const source = readFileSync(new URL('./projects.routes.js', import.meta.url), 'utf8')

test('project list route forwards optional workspace scope', () => {
  const start = source.indexOf("projectsRouter.get('/',")
  const end = source.indexOf("projectsRouter.post('/',")
  const branch = source.slice(start, end)

  assert.match(branch, /req\.query\.workspaceId/)
  assert.match(branch, /listProjects\(req\.user\.id, \{ workspaceId \}\)/)
})

test('projects routes expose project permission management endpoints', () => {
  assert.match(source, /getProjectPermissions/)
  assert.match(source, /updateProjectPermission/)
  assert.match(source, /projectsRouter\.get\('\/:id\/permissions'/)
  assert.match(source, /projectsRouter\.patch\('\/:id\/permissions\/:userId'/)
})
