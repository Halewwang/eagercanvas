import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { ref } from 'vue'

import { cloneCanvasData } from './canvasClone.js'

test('canvas clone helper deep clones Vue ref payloads', () => {
  const source = ref([
    {
      id: 'node_1',
      data: {
        label: 'Image',
        sourceRefImages: ['https://example.com/a.png']
      }
    }
  ])

  const cloned = cloneCanvasData(source.value)

  assert.deepEqual(cloned, source.value)
  assert.notEqual(cloned, source.value)
  assert.notEqual(cloned[0], source.value[0])
  assert.notEqual(cloned[0].data, source.value[0].data)
})

test('canvas store centralizes deep clone calls through canvasClone helper', () => {
  const canvasSource = readFileSync(new URL('./canvas.js', import.meta.url), 'utf8')

  assert.match(canvasSource, /import \{ cloneCanvasData \} from '\.\/canvasClone'/)
  assert.doesNotMatch(canvasSource, /JSON\.parse\(JSON\.stringify/)
})
