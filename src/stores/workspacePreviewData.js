const LOCAL_PREVIEW_WORKSPACE = {
  id: 'local-preview-workspace',
  slug: 'local-preview',
  name: 'Local Preview Workspace',
  role: 'member'
}

const LOCAL_PREVIEW_TEMPLATES = [
  {
    id: 'local-preview-share-template',
    workspaceId: 'local-preview-workspace',
    sourceProjectId: 'local-preview-source-project',
    ownerUserId: 'dev-bypass-user',
    ownerDisplayName: 'Local Preview',
    title: 'Debug Share Template',
    description: 'Mock project for Share Templates QA',
    coverUrl: '',
    icon: 'ImageOutline',
    canvasData: {
      nodes: [
        {
          id: 'debug-share-template-text',
          type: 'text',
          position: { x: 80, y: 80 },
          data: {
            text: 'Share Templates Debug',
            label: 'Template brief'
          }
        },
        {
          id: 'debug-share-template-image',
          type: 'image',
          position: { x: 420, y: 96 },
          data: {
            label: 'Mock cover',
            url: '',
            previewUrl: '',
            error: ''
          }
        }
      ],
      edges: [],
      viewport: { x: 120, y: 80, zoom: 0.85 }
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
