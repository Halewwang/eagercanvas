import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const source = readFileSync(new URL('./projects.routes.js', import.meta.url), 'utf8')

test('projects routes expose project permission management endpoints', () => {
  assert.match(source, /getProjectPermissions/)
  assert.match(source, /updateProjectPermission/)
  assert.match(source, /projectsRouter\.get\('\/:id\/permissions'/)
  assert.match(source, /projectsRouter\.patch\('\/:id\/permissions\/:userId'/)
})
