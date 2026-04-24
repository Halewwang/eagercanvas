import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const readStore = (name) => readFile(new URL(`./${name}.js`, import.meta.url), 'utf8')

test('canvas store exposes a useCanvasStore facade for existing state and actions', async () => {
  const source = await readStore('canvas')

  assert.match(source, /export const useCanvasStore = \(\) => \(\{/)
  assert.match(source, /\bnodes,\n/)
  assert.match(source, /\bcurrentProjectId,\n/)
  assert.match(source, /\baddNode,\n/)
  assert.match(source, /\bloadProject,\n/)
  assert.match(source, /\bsaveProject,\n/)
})

test('projects store exposes a useProjectsStore facade for existing state and actions', async () => {
  const source = await readStore('projects')

  assert.match(source, /export const useProjectsStore = \(\) => \(\{/)
  assert.match(source, /\bprojects,\n/)
  assert.match(source, /\bprojectsLoadState,\n/)
  assert.match(source, /\bloadProjects,\n/)
  assert.match(source, /\bcreateProject,\n/)
  assert.match(source, /\bgetProjectCanvas,\n/)
})
