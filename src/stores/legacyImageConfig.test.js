import assert from 'node:assert/strict'
import test from 'node:test'
import { migrateLegacyImageConfigNodes } from './legacyImageConfig.js'
const { recoverMissingNodeMedia } = await import(new URL('../utils/canvasSync.js', import.meta.url))

const node = (id, type, data = {}) => ({ id, type, position: { x: 10, y: 20 }, data })
const edge = (id, source, target, data = {}) => ({ id, source, target, sourceHandle: 'right', targetHandle: 'left', data })

test('standalone legacy configuration becomes an image with the same identity and inputs', () => {
  const canvas = { nodes: [node('prompt', 'text', { content: 'brief' }), node('config', 'imageConfig', {
    prompt: 'saved brief', model: 'gpt-image-2', background: 'opaque', sourceRefImages: ['ref.png']
  })], edges: [edge('input', 'prompt', 'config')], viewport: { zoom: 1 } }
  const original = structuredClone(canvas)
  const next = migrateLegacyImageConfigNodes(canvas)
  assert.equal(next.nodes[1].type, 'image')
  assert.equal(next.nodes[1].id, 'config')
  assert.equal(next.nodes[1].data.sourcePrompt, 'saved brief')
  assert.equal(next.nodes[1].data.background, 'opaque')
  assert.deepEqual(next.edges, canvas.edges)
  assert.deepEqual(next.viewport, canvas.viewport)
  assert.deepEqual(canvas, original)
  assert.deepEqual(migrateLegacyImageConfigNodes(next), next)
})

test('configuration folds into its existing result without deleting media or historical asset identity', () => {
  const media = { url: 'saved.png', previewUrl: 'blob:preview', base64: 'inline', size: '1774x887', ratio: '2:1', fileType: 'image/png', runId: 'old-run', sourceConfigId: 'historical-config', sourcePrompt: 'original brief', background: 'auto' }
  const canvas = { nodes: [node('prompt', 'text'), node('ref', 'image', { url: 'reference.png' }), node('config', 'imageConfig', { model: 'gpt-image-2', background: 'opaque', prompt: 'config brief' }), node('result', 'image', media)], edges: [
    edge('prompt-input', 'prompt', 'config', { promptOrder: 2 }),
    edge('reference-input', 'ref', 'config', { imageOrder: 1 }),
    edge('output', 'config', 'result')
  ] }
  const next = migrateLegacyImageConfigNodes(canvas)
  assert.deepEqual(next.nodes.map(n => n.id), ['prompt', 'ref', 'result'])
  const result = next.nodes.find(n => n.id === 'result')
  assert.deepEqual(result.data, { model: 'gpt-image-2', prompt: 'config brief', ...media })
  assert.deepEqual(next.edges.map(e => [e.source, e.target, e.data]), [
    ['prompt', 'result', { promptOrder: 2 }], ['ref', 'result', { imageOrder: 1 }]
  ])
  assert.equal(next.edges.some(e => e.source === 'result' && e.target === 'result'), false)
})

test('all outputs inherit missing settings, ordered inputs and group output links', () => {
  const canvas = { nodes: [node('prompt', 'text'), node('config', 'imageConfig', { model: 'gpt-image-2', background: 'opaque', prompt: 'saved inline brief', sourceRefImages: ['saved-ref.png'] }), node('a', 'image'), node('b', 'image', { url: 'b.png' })], edges: [
    edge('input', 'prompt', 'config', { promptOrder: 3 }), edge('a-out', 'config', 'a'), edge('b-out', 'config', 'b'), edge('input-direct', 'prompt', 'a', { promptOrder: 3 })
  ], groups: [{ id: 'input-group', nodeIds: ['prompt'], outputLinks: [{ id: 'group-out', targetNodeId: 'config', kind: 'image' }] }] }
  const next = migrateLegacyImageConfigNodes(canvas)
  for (const id of ['a', 'b']) {
    const data = next.nodes.find(n => n.id === id).data
    assert.equal(data.background, 'opaque')
    assert.equal(data.sourcePrompt, 'saved inline brief')
    assert.equal(data.sourceConfigId, 'config')
    assert.deepEqual(data.sourceRefImages, ['saved-ref.png'])
  }
  assert.equal(next.nodes.find(n => n.id === 'b').data.url, 'b.png')
  assert.deepEqual(next.edges.map(e => [e.source, e.target]), [['prompt', 'a'], ['prompt', 'b']])
  assert.deepEqual(next.groups[0].nodeIds, ['prompt'])
  assert.deepEqual(next.groups[0].outputLinks.map(l => l.targetNodeId), ['a', 'b'])
  assert.equal(new Set(next.groups[0].outputLinks.map(l => l.id)).size, 2)
  assert.equal(new Set(next.edges.map(e => e.id)).size, next.edges.length)
  assert.deepEqual(migrateLegacyImageConfigNodes(next), next)
})

test('unusual config connections keep their non-output links and media-bearing configurations', () => {
  const canvas = { nodes: [node('config', 'imageConfig', { url: 'keep.png' }), node('other', 'imageConfig', { prompt: 'second' }), node('output', 'image', { url: 'output.png' }), node('video', 'video')], edges: [edge('ref', 'config', 'other'), edge('out', 'config', 'output'), edge('video', 'config', 'video')] }
  const next = migrateLegacyImageConfigNodes(canvas)
  assert.equal(next.nodes.length, 4)
  assert.equal(next.nodes[0].type, 'image')
  assert.equal(next.nodes[0].data.url, 'keep.png')
  assert.equal(next.nodes[1].type, 'image')
  assert.deepEqual(next.edges, canvas.edges)
})

test('graphs without legacy configurations and other node types remain unchanged', () => {
  const canvas = { nodes: [node('video', 'videoConfig'), node('llm', 'llmConfig'), node('image', 'image')], edges: [] }
  assert.equal(migrateLegacyImageConfigNodes(canvas), canvas)
})

test('whitespace source prompt does not hide a usable inline prompt', () => {
  const next = migrateLegacyImageConfigNodes({ nodes: [node('config', 'imageConfig', { sourcePrompt: '   ', prompt: 'usable brief' }), node('out', 'image')], edges: [edge('out', 'config', 'out')] })
  assert.equal(next.nodes[0].data.sourcePrompt, 'usable brief')
})

test('media indexed by a removed configuration can still be recovered', () => {
  const migrated = migrateLegacyImageConfigNodes({ nodes: [node('config', 'imageConfig'), node('out', 'image')], edges: [edge('out', 'config', 'out')] })
  const restored = recoverMissingNodeMedia({ ...migrated, assets: [{ sourceNodeId: 'config', kind: 'image', url: 'recovered.png' }] })
  assert.equal(restored.nodes[0].id, 'out')
  assert.equal(restored.nodes[0].data.url, 'recovered.png')
  assert.equal(restored.restoredCount, 1)
})

test('group membership remains intact when folding would cross groups or erase a group', () => {
  for (const groups of [
    [{ id: 'a', nodeIds: ['config', 'text'] }, { id: 'b', nodeIds: ['out', 'other'] }],
    [{ id: 'a', nodeIds: ['config', 'out'], name: 'Keep group context' }]
  ]) {
    const next = migrateLegacyImageConfigNodes({ nodes: [node('config', 'imageConfig'), node('text', 'text'), node('out', 'image'), node('other', 'image')], edges: [edge('out', 'config', 'out')], groups })
    assert.equal(next.nodes.find(n => n.id === 'config').type, 'image')
    assert.deepEqual(next.groups, groups)
  }
})

test('grouped configurations sharing the same output cannot collapse or merge their groups', () => {
  const nodes = [node('a', 'imageConfig'), node('b', 'imageConfig'), node('result', 'image'), node('t1', 'text'), node('t2', 'text')]
  const edges = [edge('a-result', 'a', 'result'), edge('b-result', 'b', 'result')]
  for (const groups of [[{ id: 'both', nodeIds: ['a', 'b'] }], [{ id: 'one', nodeIds: ['a', 't1'] }, { id: 'two', nodeIds: ['b', 't2'] }]]) {
    const next = migrateLegacyImageConfigNodes({ nodes, edges, groups })
    assert.deepEqual(next.groups, groups)
    assert.equal(next.nodes.filter(n => n.type === 'imageConfig').length, 0)
    assert.equal(next.nodes.length, nodes.length)
  }
})
