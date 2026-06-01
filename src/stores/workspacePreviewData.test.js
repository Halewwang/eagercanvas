import assert from 'node:assert/strict'
import test from 'node:test'

const previewData = await import('./workspacePreviewData.js').catch(() => ({}))

test('workspace preview data exposes an isolated Share Templates debug project', () => {
  assert.equal(typeof previewData.getLocalPreviewWorkspace, 'function')
  assert.equal(typeof previewData.getLocalPreviewTemplates, 'function')
  assert.equal(typeof previewData.getLocalPreviewTemplateById, 'function')

  assert.deepEqual(previewData.getLocalPreviewWorkspace(), {
    id: 'local-preview-workspace',
    slug: 'local-preview',
    name: 'Local Preview Workspace',
    role: 'member'
  })

  const templates = previewData.getLocalPreviewTemplates()
  assert.equal(templates.length, 2)
  assert.equal(templates[0].id, 'local-preview-share-template')
  assert.equal(templates[0].title, 'Product Scene Workflow')
  assert.equal(templates[0].ownerDisplayName, 'Local Preview')
  assert.equal(templates[0].isPublished, true)
  assert.equal(templates[0].icon, 'ImageOutline')
  assert.equal(templates[1].id, 'local-preview-share-template-display')
  assert.equal(templates[1].title, 'Product Display Workflow')
  assert.ok(Array.isArray(templates[0].canvasData.nodes))
  assert.ok(templates[0].canvasData.nodes.length >= 9)
  assert.ok(Array.isArray(templates[0].canvasData.edges))
  assert.ok(templates[0].canvasData.edges.length >= 9)
  assert.ok(templates[0].canvasData.nodes.some((node) => node.type === 'image' && node.data?.previewImageUrl))
  assert.ok(templates[0].canvasData.nodes.some((node) => node.type === 'text' && node.data?.content))
  assert.ok(templates[1].canvasData.nodes.some((node) => node.type === 'image' && node.data?.previewImageUrl))
  assert.ok(templates[1].canvasData.edges.length >= 10)

  templates[0].title = 'Mutated title'
  assert.equal(previewData.getLocalPreviewTemplates()[0].title, 'Product Scene Workflow')
  assert.equal(
    previewData.getLocalPreviewTemplateById('local-preview-share-template').id,
    'local-preview-share-template'
  )
  assert.equal(previewData.getLocalPreviewTemplateById('missing-template'), null)
})
