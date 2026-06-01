import assert from 'node:assert/strict'
import test from 'node:test'

const preview = await import('./workspaceTemplatePreview.js').catch(() => ({}))

test('workspace template preview helpers count and fit all canvas nodes', () => {
  assert.equal(typeof preview.getWorkspaceTemplateNodeCount, 'function')
  assert.equal(typeof preview.getWorkspaceTemplatePreviewNodes, 'function')
  assert.equal(typeof preview.getWorkspaceTemplatePreviewEdges, 'function')

  const canvasData = {
    nodes: [
      {
        id: 'text-1',
        type: 'text',
        position: { x: 100, y: 120 },
        data: { content: 'Opening scene prompt copy', label: 'Opening scene' }
      },
      {
        id: 'image-1',
        type: 'image',
        position: { x: 560, y: 260 },
        data: {
          label: 'Reference image',
          previewImageUrl: 'https://cdn.example.com/preview.jpg'
        }
      }
    ],
    edges: [
      {
        id: 'edge-1',
        source: 'text-1',
        target: 'image-1'
      }
    ]
  }

  assert.equal(preview.getWorkspaceTemplateNodeCount(canvasData), 2)
  const bounds = preview.getWorkspaceTemplatePreviewBounds(canvasData)
  assert.ok(bounds.width >= 3000)
  assert.ok(bounds.height >= 1700)

  const nodes = preview.getWorkspaceTemplatePreviewNodes(canvasData)
  assert.equal(nodes.length, 2)
  assert.equal(nodes[0].label, 'Opening scene')
  assert.equal(nodes[0].kind, 'text')
  assert.equal(nodes[0].text, 'Opening scene prompt copy')
  assert.equal(nodes[1].label, 'Reference image')
  assert.equal(nodes[1].kind, 'media')
  assert.equal(nodes[1].mediaUrl, 'https://cdn.example.com/preview.jpg')

  for (const node of nodes) {
    assert.match(node.style.left, /%$/)
    assert.match(node.style.top, /%$/)
    assert.match(node.style.width, /%$/)
    assert.match(node.style.height, /%$/)
  }
  assert.ok(Number.parseFloat(nodes[0].style.left) > 20)

  const edges = preview.getWorkspaceTemplatePreviewEdges(canvasData)
  assert.equal(edges.length, 1)
  assert.equal(edges[0].id, 'edge-1')
  assert.match(edges[0].path, /^M \d+(\.\d+)? \d+(\.\d+)? C /)
  assert.ok(Number(edges[0].sourceDot.cx) >= 0)
  assert.ok(Number(edges[0].targetDot.cx) <= 100)
})
