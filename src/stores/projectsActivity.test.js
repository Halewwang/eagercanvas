import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const readSource = (path) => readFile(new URL(path, import.meta.url), 'utf8')

test('workspace project click does not mark a project as opened before navigation', async () => {
  const source = await readSource('../views/Workspace.vue')

  assert.doesNotMatch(source, /\bmarkProjectOpened\b/)
})

test('project activity sorting ignores last-opened timestamps', async () => {
  const source = await readSource('./projects.js')
  const activityMatcher = /const getProjectActivityTs = \(project\) => Math\.max\((?<body>[\s\S]*?)\n\)/
  const match = source.match(activityMatcher)

  assert.ok(match, 'getProjectActivityTs should remain explicit and reviewable')
  assert.doesNotMatch(match.groups.body, /\blastOpenedAt\b/)
})
