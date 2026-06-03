import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

import { sortProjectsByActivity } from './projectsData.js'

const readSource = (path) => readFile(new URL(path, import.meta.url), 'utf8')

test('workspace project click does not mark a project as opened before navigation', async () => {
  const source = await readSource('../views/Workspace.vue')

  assert.doesNotMatch(source, /\bmarkProjectOpened\b/)
})

test('project activity sorting ignores last-opened timestamps', () => {
  const sorted = sortProjectsByActivity([
    {
      id: 'recently-opened-old-project',
      createdAt: '2026-05-01T00:00:00.000Z',
      updatedAt: '2026-05-01T00:00:00.000Z',
      lastOpenedAt: '2026-06-01T00:00:00.000Z'
    },
    {
      id: 'newer-edited-project',
      createdAt: '2026-05-02T00:00:00.000Z',
      updatedAt: '2026-05-02T00:00:00.000Z',
      lastOpenedAt: '2026-05-02T00:00:00.000Z'
    }
  ])

  assert.deepEqual(sorted.map((project) => project.id), [
    'newer-edited-project',
    'recently-opened-old-project'
  ])
})

test('projects store delegates activity sorting to project data helpers', async () => {
  const source = await readSource('./projects.js')

  assert.match(source, /sortProjectsByActivity[\s\S]*from '\.\/projectsData\.js'/)
  assert.doesNotMatch(source, /const getProjectActivityTs =/)
})

test('project list loading ignores stale responses from previous workspace switches', async () => {
  const source = await readSource('./projects.js')

  assert.match(source, /let projectListRequestToken = 0/)
  assert.match(source, /const requestToken = \+\+projectListRequestToken/)
  assert.match(source, /if \(requestToken !== projectListRequestToken\) return projects\.value/)
})
