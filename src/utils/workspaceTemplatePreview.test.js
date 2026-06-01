import assert from 'node:assert/strict'
import test from 'node:test'

const preview = await import('./workspaceTemplatePreview.js').catch(() => ({}))

test('workspace template preview helpers extract capped image assets for grid previews', () => {
  assert.equal(typeof preview.getWorkspaceTemplateNodeCount, 'function')
  assert.equal(typeof preview.getWorkspaceTemplatePreviewAssets, 'function')
  assert.equal(typeof preview.getWorkspaceTemplatePreviewGridSize, 'function')

  const canvasData = {
    nodes: [
      {
        id: 'text-1',
        type: 'text',
        position: { x: 100, y: 120 },
        data: {
          content: 'Opening scene prompt copy',
          label: 'Opening scene',
          previewUrl: 'https://cdn.example.com/text-preview.jpg'
        }
      },
      {
        id: 'image-1',
        type: 'image',
        position: { x: 560, y: 260 },
        data: {
          label: 'Reference image',
          previewImageUrl: 'https://cdn.example.com/preview.jpg'
        }
      },
      {
        id: 'image-2',
        type: 'image',
        position: { x: 880, y: 260 },
        data: {
          label: 'Generated image',
          url: 'https://cdn.example.com/full.jpg'
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

  assert.equal(preview.getWorkspaceTemplateNodeCount(canvasData), 3)

  const assets = preview.getWorkspaceTemplatePreviewAssets(canvasData)
  assert.equal(assets.length, 2)
  assert.deepEqual(assets.map((asset) => asset.id), ['image-1', 'image-2'])
  assert.equal(assets[0].label, 'Reference image')
  assert.equal(assets[0].url, 'https://cdn.example.com/preview.jpg')
  assert.equal(assets[1].url, 'https://cdn.example.com/full.jpg')
  assert.equal(preview.getWorkspaceTemplatePreviewGridSize(canvasData), 3)
})

test('workspace template preview keeps the photo wall to a maximum of 9 image assets', () => {
  const buildCanvasData = (count) => ({
    nodes: Array.from({ length: count }, (_, index) => ({
      id: `image-${index}`,
      type: 'image',
      data: {
        label: `Image ${index + 1}`,
        previewImageUrl: `https://cdn.example.com/${index + 1}.jpg`
      }
    }))
  })

  assert.equal(preview.getWorkspaceTemplatePreviewGridSize(buildCanvasData(0)), 0)
  assert.equal(preview.getWorkspaceTemplatePreviewGridSize(buildCanvasData(9)), 3)
  assert.equal(preview.getWorkspaceTemplatePreviewGridSize(buildCanvasData(10)), 3)
  assert.equal(preview.getWorkspaceTemplatePreviewGridSize(buildCanvasData(37)), 3)
  assert.equal(preview.getWorkspaceTemplatePreviewAssets(buildCanvasData(90)).length, 9)
})
