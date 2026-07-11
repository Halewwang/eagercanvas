import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const source = readFileSync(new URL('./workspace.js', import.meta.url), 'utf8')

test('workspace writes are ordered and stale responses are ignored', () => {
  assert.match(source, /let workspaceSelectionQueue = Promise\.resolve\(\)/)
  assert.match(source, /let workspaceSelectionRequestToken = 0/)
  assert.match(source, /workspaceSelectionQueue[\s\S]*apiSelectWorkspace\(workspaceId\)/)
  assert.match(source, /requestToken !== workspaceSelectionRequestToken/)
  assert.match(source, /requestToken === workspaceSelectionRequestToken/)
})
