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
  assert.equal(templates.length, 1)
  assert.equal(templates[0].id, 'local-preview-share-template')
  assert.equal(templates[0].title, 'Debug Share Template')
  assert.equal(templates[0].ownerDisplayName, 'Local Preview')
  assert.equal(templates[0].isPublished, true)
  assert.equal(templates[0].icon, 'ImageOutline')
  assert.ok(Array.isArray(templates[0].canvasData.nodes))
  assert.ok(templates[0].canvasData.nodes.length > 0)

  templates[0].title = 'Mutated title'
  assert.equal(previewData.getLocalPreviewTemplates()[0].title, 'Debug Share Template')
  assert.equal(
    previewData.getLocalPreviewTemplateById('local-preview-share-template').id,
    'local-preview-share-template'
  )
  assert.equal(previewData.getLocalPreviewTemplateById('missing-template'), null)
})
