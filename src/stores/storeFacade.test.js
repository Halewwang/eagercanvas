import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const readStore = (name) => readFile(new URL(`./${name}.js`, import.meta.url), 'utf8')

test('canvas store exposes a Pinia defineStore boundary without direct runtime exports', async () => {
  const source = await readStore('canvas')

  assert.match(source, /import \{ defineStore \} from 'pinia'/)
  assert.match(source, /export const useCanvasStore = defineStore\('canvas', \(\) => \{/)
  assert.deepEqual(
    Array.from(source.matchAll(/^export const (?!useCanvasStore\b)(\w+)/gm), ([, name]) => name),
    []
  )
  assert.match(source, /return \{[\s\S]*\bcurrentProjectId,[\s\S]*\bnodes,[\s\S]*\baddNode,[\s\S]*\bloadProject,[\s\S]*\bsaveProject,/)
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
