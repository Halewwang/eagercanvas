import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { test } from 'node:test'

const flowHandlesUrl = new URL('./NodeFlowHandles.vue', import.meta.url)
const flowHandlesPath = fileURLToPath(flowHandlesUrl)
const flowHandlesSource = existsSync(flowHandlesPath) ? readFileSync(flowHandlesUrl, 'utf8') : ''

const nodeSources = [
  readFileSync(new URL('./ImageNode.vue', import.meta.url), 'utf8'),
  readFileSync(new URL('./TextNode.vue', import.meta.url), 'utf8'),
  readFileSync(new URL('./VideoNode.vue', import.meta.url), 'utf8')
]

test('visual nodes delegate Vue Flow plus handles to a shared component', () => {
  assert.ok(existsSync(flowHandlesPath))
  assert.match(flowHandlesSource, /import \{ Handle, Position \} from '@vue-flow\/core'/)
  assert.match(flowHandlesSource, /defineProps\(\{\s*showHandles:/s)
  assert.match(flowHandlesSource, /<Handle\s+type="source"\s+:position="Position\.Right"\s+id="right"/)
  assert.match(flowHandlesSource, /<Handle\s+type="target"\s+:position="Position\.Left"\s+id="left"/)
  assert.match(flowHandlesSource, /\['node-handle-plus', 'node-handle-plus-right', \{ 'node-handle-plus-visible': showHandles \}\]/)
  assert.match(flowHandlesSource, /\['node-handle-plus', 'node-handle-plus-left', \{ 'node-handle-plus-visible': showHandles \}\]/)

  for (const source of nodeSources) {
    assert.match(source, /import NodeFlowHandles from '\.\/NodeFlowHandles\.vue'/)
    assert.match(source, /<NodeFlowHandles :show-handles="showHandles" \/>/)
    assert.doesNotMatch(source, /<Handle type="source"/)
    assert.doesNotMatch(source, /<Handle type="target"/)
    assert.doesNotMatch(source, /Position\.(Right|Left)/)
  }
})
