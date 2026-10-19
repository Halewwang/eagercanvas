import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const source = readFileSync(new URL('./workflows.js', import.meta.url), 'utf8')
  .replace(/^import (\w+) from '@\/assets\/[^']+'$/gm, 'const $1 = "data:image/png;base64,aW1hZ2U="')
const { WORKFLOW_TEMPLATES, getWorkflowById, getWorkflowsByCategory } = await import(
  `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`
)
const start = { x: 50, y: 100 }
const expectations = {
  'multi-angle-storyboard': { nodes: 10, images: 5, generated: 5 },
  'product-ecommerce-full-set': { nodes: 10, images: 5, generated: 4 },
  'drama-character-design': { nodes: 10, images: 5, generated: 4 },
  'drama-scene-background': { nodes: 9, images: 4, generated: 4 },
  'picture-book-generator': { nodes: 17, images: 6, generated: 6 }
}

for (const template of WORKFLOW_TEMPLATES) {
  test(`${template.id} uses image capsules with complete ordered input chains`, () => {
    const { nodes, edges } = template.createNodes(start)
    const byId = new Map(nodes.map(node => [node.id, node]))
    const expected = expectations[template.id]
    assert.equal(byId.size, nodes.length)
    assert.equal(nodes.length, expected.nodes)
    assert.equal(nodes.filter(node => node.type === 'image').length, expected.images)
    assert.equal(nodes.filter(node => node.type === 'imageConfig').length, 0)
    assert.equal(new Set(edges.map(edge => edge.id)).size, edges.length)
    for (const edge of edges) {
      assert.ok(byId.has(edge.source), `missing source: ${edge.source}`)
      assert.ok(byId.has(edge.target), `missing target: ${edge.target}`)
      assert.notEqual(edge.source, edge.target)
      assert.equal(edge.sourceHandle, 'right')
      assert.equal(edge.targetHandle, 'left')
    }
    const generated = nodes.filter(node => node.type === 'image' && node.data.model)
    assert.equal(generated.length, expected.generated)
    for (const image of generated) {
      assert.equal(image.data.model, 'gpt-image-2')
      const inputs = edges.filter(edge => edge.target === image.id)
      assert.ok(inputs.some(edge => byId.get(edge.source).type === 'text'))
      for (const edge of inputs) {
        const input = byId.get(edge.source)
        if (input.type === 'image') assert.equal(edge.type, 'imageOrder')
        if (input.type === 'text' && inputs.filter(item => byId.get(item.source).type === 'text').length > 1) {
          assert.equal(edge.type, 'promptOrder')
        }
      }
      for (const key of ['promptOrder', 'imageOrder']) {
        const orders = inputs.filter(edge => edge.data?.[key]).map(edge => edge.data[key]).sort()
        assert.deepEqual(orders, orders.map((_, index) => index + 1))
      }
    }
  })
}

const graphByLabel = (id) => {
  const { nodes, edges } = getWorkflowById(id).createNodes(start)
  return {
    byLabel: new Map(nodes.map(node => [node.data.label, node])),
    links: edges.map(edge => ({
      source: nodes.find(node => node.id === edge.source).data.label,
      target: nodes.find(node => node.id === edge.target).data.label,
      type: edge.type,
      order: edge.data
    }))
  }
}

test('paired generation nodes merge into their existing result positions and keep downstream references', () => {
  const cases = [
    ['multi-angle-storyboard', '角色图结果', { x: 850, y: 520 }, ['角色提示词'], ['正视 (Front View)', '侧视 (Side View)', '后视 (Back View)', "俯视 (Top/Bird's Eye View)"]],
    ['drama-character-design', '正面角色图（参考基准）', { x: 1250, y: 100 }, ['角色描述', '风格参考图（可选）', '正面全身提示词'], ['侧面半身图', '表情特写图', '背面全身图']],
    ['drama-scene-background', '基础场景图（参考基准）', { x: 1250, y: 100 }, ['场景描述', '基础场景提示词'], ['傍晚场景', '夜晚场景', '雨天场景']],
    ['picture-book-generator', '角色1参考图', { x: 1730, y: -350 }, ['角色1:小白兔米米'], ['第1页插图', '第2页插图', '第3页插图', '第4页插图']],
    ['picture-book-generator', '角色2参考图', { x: 1730, y: -50 }, ['角色2:小狐狸橙橙'], ['第3页插图', '第4页插图']]
  ]
  for (const [id, label, position, inputs, outputs] of cases) {
    const { byLabel, links } = graphByLabel(id)
    assert.deepEqual(byLabel.get(label).position, position)
    assert.equal(byLabel.get(label).data.model, 'gpt-image-2')
    assert.deepEqual(links.filter(edge => edge.target === label).map(edge => edge.source), inputs)
    assert.deepEqual(links.filter(edge => edge.source === label).map(edge => edge.target), outputs)
    assert.ok(links.filter(edge => edge.source === label).every(edge => edge.type === 'imageOrder'))
  }
})

test('workflow lookup and existing LLM nodes remain intact', () => {
  assert.equal(WORKFLOW_TEMPLATES.length, 5)
  assert.equal(getWorkflowsByCategory('drama').length, 2)
  assert.equal(getWorkflowById('missing'), undefined)
  const { nodes } = getWorkflowById('picture-book-generator').createNodes(start)
  assert.equal(nodes.filter(node => node.type === 'llmConfig').length, 2)
  assert.ok(nodes.filter(node => node.type === 'llmConfig').every(node => node.data.model === 'gpt-5.6-sol'))
})
