import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const readCanvasSource = () => readFileSync(new URL('./canvas.js', import.meta.url), 'utf8')

test('canvas store keeps large graph collections in shallow refs', () => {
  const source = readCanvasSource()

  assert.match(source, /import \{[^}]*\bshallowRef\b[^}]*\btriggerRef\b[^}]*\} from 'vue'/s)
  assert.match(source, /const nodes = shallowRef\(\[\]\)/)
  assert.match(source, /const edges = shallowRef\(\[\]\)/)
  assert.match(source, /const groups = shallowRef\(\[\]\)/)
  assert.match(source, /return \{[\s\S]*\bnodes,[\s\S]*\bedges,[\s\S]*\bgroups,/)
})

test('canvas store exposes an explicit refresh boundary for Vue Flow in-place updates', () => {
  const source = readCanvasSource()

  assert.match(source, /const refreshCanvasCollectionRefs = \(\{[\s\S]*triggerRef\(nodes\)[\s\S]*triggerRef\(edges\)[\s\S]*triggerRef\(groups\)/)
  assert.match(source, /return \{[\s\S]*\brefreshCanvasCollectionRefs\b/)
  assert.doesNotMatch(source, /nodes\.value\.(push|splice|sort|reverse|shift|unshift|pop)\(/)
  assert.doesNotMatch(source, /edges\.value\.(push|splice|sort|reverse|shift|unshift|pop)\(/)
  assert.doesNotMatch(source, /groups\.value\.(push|splice|sort|reverse|shift|unshift|pop)\(/)
})
