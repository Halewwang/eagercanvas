const LOCAL_PREVIEW_WORKSPACE = {
  id: 'local-preview-workspace',
  slug: 'local-preview',
  name: 'Local Preview Workspace',
  role: 'member'
}

const MOCK_IMAGE_A = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 180 240"%3E%3Crect width="180" height="240" fill="%23f5efe7"/%3E%3Ccircle cx="90" cy="88" r="42" fill="%23d8b79b"/%3E%3Cpath d="M38 178c30-42 74-44 104 0" fill="%23a98467"/%3E%3C/svg%3E'
const MOCK_IMAGE_B = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 180 240"%3E%3Crect width="180" height="240" fill="%23f6f1ea"/%3E%3Cpath d="M50 62h82v120H50z" fill="%23ddc8b5"/%3E%3Ccircle cx="74" cy="104" r="22" fill="%23b8876b"/%3E%3Ccircle cx="112" cy="124" r="18" fill="%23d8a784"/%3E%3C/svg%3E'
const MOCK_IMAGE_C = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 180 240"%3E%3Crect width="180" height="240" fill="%23efe8de"/%3E%3Cpath d="M42 180c16-54 72-96 96-118 12 58-4 106-42 144z" fill="%23c8aa78"/%3E%3Cpath d="M54 88c36 12 62 38 76 78" fill="none" stroke="%23866b4a" stroke-width="8"/%3E%3C/svg%3E'
const MOCK_IMAGE_D = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 180 240"%3E%3Crect width="180" height="240" fill="%23f2eee8"/%3E%3Crect x="42" y="40" width="96" height="160" rx="12" fill="%23fff8ee"/%3E%3Ccircle cx="90" cy="112" r="36" fill="%23c39a74"/%3E%3Cpath d="M62 174h56" stroke="%23947b62" stroke-width="10" stroke-linecap="round"/%3E%3C/svg%3E'

const createTextNode = ({ id, x, y, label, content }) => ({
  id,
  type: 'text',
  position: { x, y },
  data: { label, content }
})

const createImageNode = ({ id, x, y, label, image }) => ({
  id,
  type: 'image',
  position: { x, y },
  data: {
    label,
    ratio: '3:4',
    url: image,
    previewImageUrl: image,
    error: ''
  }
})

const createEdge = (id, source, target) => ({ id, source, target })

const LOCAL_PREVIEW_TEMPLATES = [
  {
    id: 'local-preview-share-template',
    workspaceId: 'local-preview-workspace',
    sourceProjectId: 'local-preview-source-project',
    ownerUserId: 'dev-bypass-user',
    ownerDisplayName: 'Local Preview',
    title: 'Product Scene Workflow',
    description: 'Multi-node product image and scene workflow mock',
    coverUrl: '',
    icon: 'ImageOutline',
    canvasData: {
      nodes: [
        createTextNode({
          id: 'debug-scene-brief',
          x: 80,
          y: 180,
          label: 'Brief',
          content: 'Build a product scene workflow from reference images, lighting notes, and final delivery variants.'
        }),
        createImageNode({ id: 'debug-scene-reference-a', x: 100, y: 560, label: 'Reference A', image: MOCK_IMAGE_A }),
        createImageNode({ id: 'debug-scene-reference-b', x: 100, y: 980, label: 'Reference B', image: MOCK_IMAGE_C }),
        createTextNode({
          id: 'debug-scene-prompt',
          x: 560,
          y: 360,
          label: 'Scene prompt',
          content: 'Soft daylight, quiet editorial styling, centered product, restrained background texture.'
        }),
        createImageNode({ id: 'debug-scene-mood', x: 600, y: 820, label: 'Mood image', image: MOCK_IMAGE_D }),
        createImageNode({ id: 'debug-scene-output-a', x: 1040, y: 260, label: 'Scene draft', image: MOCK_IMAGE_B }),
        createImageNode({ id: 'debug-scene-output-b', x: 1040, y: 720, label: 'Alternate draft', image: MOCK_IMAGE_C }),
        createTextNode({
          id: 'debug-scene-refine',
          x: 1480,
          y: 300,
          label: 'Refine',
          content: 'Select the best draft, keep product identity, improve detail, and balance contrast.'
        }),
        createImageNode({ id: 'debug-scene-final', x: 1900, y: 560, label: 'Final image', image: MOCK_IMAGE_D })
      ],
      edges: [
        createEdge('debug-scene-edge-brief-prompt', 'debug-scene-brief', 'debug-scene-prompt'),
        createEdge('debug-scene-edge-ref-a-prompt', 'debug-scene-reference-a', 'debug-scene-prompt'),
        createEdge('debug-scene-edge-ref-b-mood', 'debug-scene-reference-b', 'debug-scene-mood'),
        createEdge('debug-scene-edge-prompt-output-a', 'debug-scene-prompt', 'debug-scene-output-a'),
        createEdge('debug-scene-edge-prompt-output-b', 'debug-scene-prompt', 'debug-scene-output-b'),
        createEdge('debug-scene-edge-mood-output-b', 'debug-scene-mood', 'debug-scene-output-b'),
        createEdge('debug-scene-edge-output-a-refine', 'debug-scene-output-a', 'debug-scene-refine'),
        createEdge('debug-scene-edge-output-b-refine', 'debug-scene-output-b', 'debug-scene-refine'),
        createEdge('debug-scene-edge-refine-final', 'debug-scene-refine', 'debug-scene-final')
      ],
      viewport: { x: 120, y: 80, zoom: 0.85 }
    },
    isPublished: true,
    publishedAt: '2026-06-01T00:00:00.000Z',
    createdAt: '2026-06-01T00:00:00.000Z',
    updatedAt: '2026-06-01T00:00:00.000Z'
  },
  {
    id: 'local-preview-share-template-display',
    workspaceId: 'local-preview-workspace',
    sourceProjectId: 'local-preview-source-project-display',
    ownerUserId: 'dev-bypass-user',
    ownerDisplayName: 'Local Preview',
    title: 'Product Display Workflow',
    description: 'Wide product display workflow mock',
    coverUrl: '',
    icon: 'ImageOutline',
    canvasData: {
      nodes: [
        createTextNode({
          id: 'debug-display-brief-a',
          x: 80,
          y: 230,
          label: 'Brief A',
          content: 'Generate a clean product display video flow with reference, product detail, and output selection.'
        }),
        createImageNode({ id: 'debug-display-reference-a', x: 100, y: 620, label: 'Reference A', image: MOCK_IMAGE_A }),
        createTextNode({
          id: 'debug-display-compose-a',
          x: 560,
          y: 430,
          label: 'Compose',
          content: 'Combine product reference and display direction into a consistent product scene.'
        }),
        createImageNode({ id: 'debug-display-scene-a', x: 980, y: 260, label: 'Display draft', image: MOCK_IMAGE_B }),
        createImageNode({ id: 'debug-display-scene-b', x: 980, y: 800, label: 'Detail draft', image: MOCK_IMAGE_C }),
        createTextNode({
          id: 'debug-display-brief-b',
          x: 1440,
          y: 160,
          label: 'Brief B',
          content: 'Create alternate packaging detail and product cutaway options for the same campaign.'
        }),
        createImageNode({ id: 'debug-display-reference-b', x: 1460, y: 570, label: 'Reference B', image: MOCK_IMAGE_D }),
        createTextNode({
          id: 'debug-display-merge',
          x: 1900,
          y: 430,
          label: 'Merge',
          content: 'Merge selected drafts, match color temperature, and prepare final delivery options.'
        }),
        createImageNode({ id: 'debug-display-final-a', x: 2320, y: 280, label: 'Final A', image: MOCK_IMAGE_B }),
        createImageNode({ id: 'debug-display-final-b', x: 2320, y: 780, label: 'Final B', image: MOCK_IMAGE_D })
      ],
      edges: [
        createEdge('debug-display-edge-brief-compose', 'debug-display-brief-a', 'debug-display-compose-a'),
        createEdge('debug-display-edge-ref-compose', 'debug-display-reference-a', 'debug-display-compose-a'),
        createEdge('debug-display-edge-compose-scene-a', 'debug-display-compose-a', 'debug-display-scene-a'),
        createEdge('debug-display-edge-compose-scene-b', 'debug-display-compose-a', 'debug-display-scene-b'),
        createEdge('debug-display-edge-brief-b-ref-b', 'debug-display-brief-b', 'debug-display-reference-b'),
        createEdge('debug-display-edge-scene-a-merge', 'debug-display-scene-a', 'debug-display-merge'),
        createEdge('debug-display-edge-scene-b-merge', 'debug-display-scene-b', 'debug-display-merge'),
        createEdge('debug-display-edge-ref-b-merge', 'debug-display-reference-b', 'debug-display-merge'),
        createEdge('debug-display-edge-merge-final-a', 'debug-display-merge', 'debug-display-final-a'),
        createEdge('debug-display-edge-merge-final-b', 'debug-display-merge', 'debug-display-final-b')
      ],
      viewport: { x: 160, y: 100, zoom: 0.65 }
    },
    isPublished: true,
    publishedAt: '2026-06-01T00:00:00.000Z',
    createdAt: '2026-06-01T00:00:00.000Z',
    updatedAt: '2026-06-01T00:00:00.000Z'
  }
]

const clone = (value) => JSON.parse(JSON.stringify(value))

export const getLocalPreviewWorkspace = () => clone(LOCAL_PREVIEW_WORKSPACE)

export const getLocalPreviewTemplates = () => clone(LOCAL_PREVIEW_TEMPLATES)

export const getLocalPreviewTemplateById = (templateId) => {
  const id = String(templateId || '').trim()
  const template = LOCAL_PREVIEW_TEMPLATES.find((item) => item.id === id)
  return template ? clone(template) : null
}
