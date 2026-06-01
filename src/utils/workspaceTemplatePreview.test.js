import assert from 'node:assert/strict'
import test from 'node:test'

const preview = await import('./workspaceTemplatePreview.js').catch(() => ({}))

test('workspace template preview helpers count and fit all canvas nodes', () => {
  assert.equal(typeof preview.getWorkspaceTemplateNodeCount, 'function')
  assert.equal(typeof preview.getWorkspaceTemplatePreviewNodes, 'function')

  const canvasData = {
    nodes: [
      {
        id: 'text-1',
        type: 'text',
        position: { x: 100, y: 120 },
        data: { text: 'Opening scene' }
      },
      {
        id: 'image-1',
        type: 'image',
        position: { x: 560, y: 260 },
        data: { label: 'Reference image' }
      }
    ]
  }

  assert.equal(preview.getWorkspaceTemplateNodeCount(canvasData), 2)

  const nodes = preview.getWorkspaceTemplatePreviewNodes(canvasData)
  assert.equal(nodes.length, 2)
  assert.equal(nodes[0].label, 'Opening scene')
  assert.equal(nodes[1].label, 'Reference image')

  for (const node of nodes) {
    assert.match(node.style.left, /%$/)
    assert.match(node.style.top, /%$/)
    assert.match(node.style.width, /%$/)
    assert.match(node.style.height, /%$/)
  }
})
