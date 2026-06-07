import assert from 'node:assert/strict'
import test from 'node:test'

import { resolveGroupOutputContexts } from './groupContextInputs.js'

test('group output contexts collect ordered text prompts and image references for one downstream target', () => {
  const nodes = [
    { id: 'text-b', type: 'text', position: { x: 20, y: 80 }, data: { content: 'Second prompt' } },
    { id: 'image-a', type: 'image', position: { x: 40, y: 20 }, data: { previewUrl: 'blob:preview-a' } },
    { id: 'text-a', type: 'text', position: { x: 10, y: 20 }, data: { content: 'First prompt' } },
    { id: 'image-b', type: 'image', position: { x: 80, y: 20 }, data: { url: 'https://cdn.example/ref-b.png' } },
    { id: 'empty-text', type: 'text', position: { x: 0, y: 0 }, data: { content: '   ' } },
    { id: 'empty-image', type: 'image', position: { x: 0, y: 0 }, data: {} },
    { id: 'downstream', type: 'image', position: { x: 500, y: 20 }, data: {} }
  ]
  const groups = [
    {
      id: 'group-1',
      name: 'Field 1',
      nodeIds: ['text-b', 'image-a', 'text-a', 'image-b', 'empty-text', 'empty-image'],
      outputLinks: [{ id: 'group-link-1', targetNodeId: 'downstream', kind: 'image-output', createdAt: 100 }]
    }
  ]

  const result = resolveGroupOutputContexts({ targetNodeId: 'downstream', nodes, groups })

  assert.deepEqual(result.prompts.map((entry) => entry.content), ['First prompt', 'Second prompt'])
  assert.deepEqual(result.references.map((entry) => entry.value), [
    'blob:preview-a',
    'https://cdn.example/ref-b.png'
  ])
  assert.deepEqual(result.groupContexts, [{
    linkId: 'group-link-1',
    groupId: 'group-1',
    groupName: 'Field 1',
    targetNodeId: 'downstream',
    promptCount: 2,
    referenceCount: 2,
    promptNodeIds: ['text-a', 'text-b'],
    referenceNodeIds: ['image-a', 'image-b']
  }])
})
