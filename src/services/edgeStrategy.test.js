import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const readEdgeStrategy = () => readFile(new URL('./edgeStrategy.js', import.meta.url), 'utf8')

test('video image role selection overrides the initial connection slot', async () => {
  const source = await readEdgeStrategy()

  assert.match(
    source,
    /const role = edge\.data\?\.imageRole \|\| edge\.data\?\.slot \|\| 'first_frame_image'/,
    'resolveNodeInputs should prefer the user-selected imageRole over the initial slot'
  )
})

test('image input resolution appends group output context without changing edge parsing', async () => {
  const source = await readEdgeStrategy()

  assert.match(source, /import \{ resolveGroupOutputContexts \} from '@\/utils\/groupContextInputs'/)
  assert.match(source, /const \{ nodes, edges, groups \} = storeToRefs\(canvasStore\)/)
  assert.match(source, /resolveGroupOutputContexts\(\{[\s\S]*targetNodeId,[\s\S]*nodes: nodes\.value,[\s\S]*groups: groups\.value[\s\S]*\}\)/)
  assert.match(source, /groupContexts: groupInputContext\.groupContexts/)
})
