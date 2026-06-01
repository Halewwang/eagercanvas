import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { test } from 'node:test'

const metaRowUrl = new URL('./NodeMetaRow.vue', import.meta.url)
const metaRowPath = fileURLToPath(metaRowUrl)
const metaRowSource = existsSync(metaRowPath) ? readFileSync(metaRowUrl, 'utf8') : ''

const nodeSources = [
  {
    source: readFileSync(new URL('./ImageNode.vue', import.meta.url), 'utf8'),
    label: 'Image',
    icon: 'ImageOutline'
  },
  {
    source: readFileSync(new URL('./TextNode.vue', import.meta.url), 'utf8'),
    label: 'Text',
    icon: 'TextOutline'
  },
  {
    source: readFileSync(new URL('./VideoNode.vue', import.meta.url), 'utf8'),
    label: 'Video',
    icon: 'VideocamOutline'
  }
]

test('visual node headers use a shared meta row component', () => {
  assert.ok(existsSync(metaRowPath))
  assert.match(metaRowSource, /import \{ NIcon \} from 'naive-ui'/)
  assert.match(metaRowSource, /defineProps\(\{\s*label:/s)
  assert.match(metaRowSource, /icon:/)
  assert.match(metaRowSource, /defineEmits\(\['mousedown'\]\)/)
  assert.match(metaRowSource, /class="node-meta-row"/)
  assert.match(metaRowSource, /@mousedown="emit\('mousedown', \$event\)"/)
  assert.match(metaRowSource, /<n-icon :size="16" class="meta-icon">/)
  assert.match(metaRowSource, /<component :is="icon" \/>/)
  assert.match(metaRowSource, /<span class="meta-title">\{\{ label \}\}<\/span>/)

  for (const { source, label, icon } of nodeSources) {
    assert.match(source, /import NodeMetaRow from '\.\/NodeMetaRow\.vue'/)
    assert.match(source, new RegExp(`<NodeMetaRow\\s+label="${label}"\\s+:icon="${icon}"\\s+@mousedown="handleMetaMouseDown"\\s+\\/>`))
    assert.doesNotMatch(source, /<div class="node-meta-row" @mousedown="handleMetaMouseDown">/)
    assert.doesNotMatch(source, /<n-icon :size="16" class="meta-icon">/)
    assert.doesNotMatch(source, new RegExp(`<span class="meta-title">${label}<\\/span>`))
  }
})
