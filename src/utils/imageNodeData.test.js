import assert from 'node:assert/strict'
import test from 'node:test'

import * as imageNodeData from './imageNodeData.js'
import {
  getImageNodeActiveInputKeys,
  getImageNodeInputStatusList,
  getImageNodeSourceRefImages,
  getImageNodePersistencePatch,
  getImageNodeCanvasSaveSnapshot,
  getImageNodeSaveFeedback,
  getImageNodeLinkedCreateData,
  getImageNodeLinkedUpdatePatch,
  getNearestImageNodeSourceConfig,
  getImageNodeEnhancementRequest,
  getImageNodeToolSaveMessages,
  getImageNodeToolSaveMessage,
  getImageNodeToolReplacementPatch,
  getImageNodeToolLinkedResultPatch,
  getImageNodeGenerationSaveMessage,
  getImageNodeReplacementSaveMessage,
  getImageNodeReplacementPreviewPatch,
  getImageNodeReplacementUploadedPatch,
  getImageNodeReplacementErrorPatch,
  getImageNodeUploadMetadata,
  getImageNodeUploadPreviewPatch,
  getImageNodeUploadedPatch,
  getImageNodeUploadFailureOutcome,
  getImageNodeUploadSaveOutcome
} from './imageNodeData.js'

test('image node source refs trim, flatten, remove blanks, and keep first occurrence order', () => {
  assert.deepEqual(getImageNodeSourceRefImages(
    [' https://asset/a.png ', '', null],
    ['https://asset/b.png', 'https://asset/a.png'],
    ' https://asset/c.png ',
    ['https://asset/b.png']
  ), [
    'https://asset/a.png',
    'https://asset/b.png',
    'https://asset/c.png'
  ])
})

test('image node active input keys follow incoming text and image node data', () => {
  const nodes = [
    { id: 'text-1', type: 'text', data: { content: 'Describe it' } },
    { id: 'text-empty', type: 'text', data: { content: '   ' } },
    { id: 'image-1', type: 'image', data: { previewUrl: 'blob:preview' } },
    { id: 'image-2', type: 'image', data: { base64: 'data:image/png;base64,abc' } },
    { id: 'other', type: 'text', data: { content: 'Ignored' } }
  ]
  const edges = [
    { source: 'text-1', target: 'target' },
    { source: 'text-empty', target: 'target' },
    { source: 'image-1', target: 'target' },
    { source: 'image-2', target: 'target' },
    { source: 'other', target: 'different-target' },
    { source: 'missing', target: 'target' }
  ]

  assert.deepEqual(getImageNodeActiveInputKeys({ edges, nodes, targetNodeId: 'target' }), new Set(['prompt', 'reference']))
  assert.deepEqual(getImageNodeInputStatusList({
    activeKeys: new Set(['reference']),
    labels: { prompt: 'Prompt', reference: 'Reference Picture' }
  }), [
    { key: 'prompt', label: 'Prompt', active: false },
    { key: 'reference', label: 'Reference Picture', active: true }
  ])
})

test('image node persistence patch preserves saved and temporary image state mapping', () => {
  assert.deepEqual(getImageNodePersistencePatch({
    persistedUrl: 'https://cdn.example/image.png',
    displayUrl: 'https://cdn.example/image.png',
    persisted: true
  }, {
    loading: false
  }, {
    now: 1234
  }), {
    url: 'https://cdn.example/image.png',
    previewUrl: '',
    base64: '',
    persistStatus: 'saved',
    persistError: '',
    updatedAt: 1234,
    loading: false
  })

  assert.deepEqual(getImageNodePersistencePatch({
    persistedUrl: '',
    displayUrl: 'blob:temporary',
    persisted: false,
    persistError: 'Generated image persistence failed. Please retry.'
  }, {}, {
    now: 2345
  }), {
    url: '',
    previewUrl: 'blob:temporary',
    base64: '',
    persistStatus: 'pending',
    persistError: 'Generated image persistence failed. Please retry.',
    updatedAt: 2345
  })
})

test('image node save feedback keeps existing synced, local-only, temporary, and failed modes', () => {
  assert.deepEqual(getImageNodeCanvasSaveSnapshot({
    localSaved: 1,
    remoteSynced: '',
    hasTransientMedia: null
  }), {
    localSaved: true,
    remoteSynced: false,
    hasTransientMedia: false
  })

  assert.deepEqual(getImageNodeSaveFeedback(true, {}), {
    persistStatus: 'saved',
    persistError: '',
    mode: 'synced'
  })
  assert.deepEqual(getImageNodeSaveFeedback(false, { remoteSynced: true }), {
    persistStatus: 'saved',
    persistError: '',
    mode: 'synced'
  })
  assert.deepEqual(getImageNodeSaveFeedback(false, { localSaved: true, hasTransientMedia: false }), {
    persistStatus: 'saved',
    persistError: '',
    mode: 'local-only'
  })
  assert.deepEqual(getImageNodeSaveFeedback(false, { hasTransientMedia: true }), {
    persistStatus: 'error',
    persistError: 'Image uses a temporary address and was not fully saved.',
    mode: 'temporary'
  })
  assert.deepEqual(getImageNodeSaveFeedback(false, {}), {
    persistStatus: 'error',
    persistError: 'Project save failed. Refresh may lose this image.',
    mode: 'failed'
  })
})

test('image node save feedback patch preserves persisted status fields and timestamp', () => {
  assert.equal(typeof imageNodeData.getImageNodeSaveFeedbackPatch, 'function')
  assert.deepEqual(imageNodeData.getImageNodeSaveFeedbackPatch({
    saveFeedback: {
      persistStatus: 'saved',
      persistError: ''
    },
    now: 12345
  }), {
    persistStatus: 'saved',
    persistError: '',
    updatedAt: 12345
  })

  assert.deepEqual(imageNodeData.getImageNodeSaveFeedbackPatch({
    saveFeedback: {
      persistStatus: 'error',
      persistError: 'Project save failed. Refresh may lose this image.'
    },
    now: 67890
  }), {
    persistStatus: 'error',
    persistError: 'Project save failed. Refresh may lose this image.',
    updatedAt: 67890
  })

  assert.deepEqual(imageNodeData.getImageNodeSaveFeedbackPatch({ now: 24680 }), {
    persistStatus: '',
    persistError: '',
    updatedAt: 24680
  })
})

test('image node model params patch preserves capsule field names', () => {
  assert.equal(typeof imageNodeData.getImageNodeModelParamsPatch, 'function')
  assert.deepEqual(imageNodeData.getImageNodeModelParamsPatch({
    model: 'gpt-image-2',
    size: '1536x1024',
    quality: 'high',
    background: 'transparent',
    outputFormat: 'webp',
    ratio: '3:2',
    resolution: '2k'
  }), {
    model: 'gpt-image-2',
    size: '1536x1024',
    quality: 'high',
    background: 'transparent',
    output_format: 'webp',
    ratio: '3:2',
    resolution: '2k'
  })
})

test('image node size params patch preserves ratio and resolution fields', () => {
  assert.equal(typeof imageNodeData.getImageNodeSizeParamsPatch, 'function')
  assert.deepEqual(imageNodeData.getImageNodeSizeParamsPatch({
    size: '1024x1024',
    ratio: '1:1',
    resolution: '1k'
  }), {
    size: '1024x1024',
    ratio: '1:1',
    resolution: '1k'
  })
})

test('image node linked create data preserves defaults and payload overrides', () => {
  assert.deepEqual(getImageNodeLinkedCreateData({
    defaults: {
      model: 'gemini-default',
      quality: 'standard',
      size: '1024x1024',
      ratio: '1:1',
      resolution: '1k'
    },
    payload: {
      model: 'gpt-image-2',
      size: '1536x1024',
      ratio: '3:2',
      loading: 1,
      label: '4K Enhanced Image',
      sourceConfigId: 'config-1',
      sourcePrompt: 'prompt',
      sourceRefImages: ['https://asset/a.png'],
      persistStatus: 'saving',
      persistError: 'pending'
    },
    now: 3456
  }), {
    model: 'gpt-image-2',
    quality: 'standard',
    size: '1536x1024',
    ratio: '3:2',
    resolution: '1k',
    url: '',
    previewUrl: '',
    base64: '',
    fileType: 'image/png',
    label: '4K Enhanced Image',
    loading: true,
    sourceConfigId: 'config-1',
    sourcePrompt: 'prompt',
    sourceRefImages: ['https://asset/a.png'],
    error: '',
    persistStatus: 'saving',
    persistError: 'pending',
    updatedAt: 3456
  })
})

test('image node linked update patch keeps optional label behavior', () => {
  assert.deepEqual(getImageNodeLinkedUpdatePatch({
    defaults: {
      model: 'gemini-default',
      quality: 'standard',
      size: '1024x1024',
      ratio: '1:1',
      resolution: '1k'
    },
    payload: {
      previewUrl: 'blob:temporary',
      fileType: 'image/webp',
      sourceRefImages: 'not-array',
      error: 'Generation failed'
    },
    now: 4567
  }), {
    model: 'gemini-default',
    quality: 'standard',
    size: '1024x1024',
    ratio: '1:1',
    resolution: '1k',
    url: '',
    previewUrl: 'blob:temporary',
    base64: '',
    fileType: 'image/webp',
    loading: false,
    sourceConfigId: '',
    sourcePrompt: '',
    sourceRefImages: [],
    error: 'Generation failed',
    persistStatus: '',
    persistError: '',
    updatedAt: 4567
  })

  assert.equal(Object.hasOwn(getImageNodeLinkedUpdatePatch({ payload: {}, now: 1 }), 'label'), false)
  assert.equal(getImageNodeLinkedUpdatePatch({ payload: { label: 'Result' }, now: 1 }).label, 'Result')
})

test('image node linked position keeps existing horizontal offset and width fallback', () => {
  assert.equal(typeof imageNodeData.getImageNodeLinkedPosition, 'function')
  assert.deepEqual(imageNodeData.getImageNodeLinkedPosition({
    currentNode: { id: 'image-1', position: { x: 120, y: 48 } },
    stageWidth: '512px'
  }), {
    x: 806,
    y: 48
  })

  assert.deepEqual(imageNodeData.getImageNodeLinkedPosition({
    currentNode: { id: 'image-1', position: { x: -20, y: 10 } },
    stageWidth: ''
  }), {
    x: 474,
    y: 10
  })

  assert.equal(imageNodeData.getImageNodeLinkedPosition({ currentNode: null, stageWidth: '512px' }), null)
})

test('image node linked selection state marks only the new node as selected', () => {
  assert.equal(typeof imageNodeData.getImageNodeLinkedSelectionState, 'function')
  assert.deepEqual(imageNodeData.getImageNodeLinkedSelectionState({
    nodes: [
      { id: 'source', selected: true, data: { label: 'Source', selected: true } },
      { id: 'result', selected: false },
      { id: 'other', selected: false, data: { label: 'Other' } }
    ],
    selectedNodeId: 'result'
  }), [
    { id: 'source', selected: false, data: { label: 'Source', selected: false } },
    { id: 'result', selected: true, data: { selected: true } },
    { id: 'other', selected: false, data: { label: 'Other', selected: false } }
  ])
})

test('image node nearest source config prefers explicit config before recursive image inputs', () => {
  const nodes = [
    { id: 'target', type: 'image', data: { sourceConfigId: 'direct-config' } },
    { id: 'direct-config', type: 'imageConfig', data: { model: 'direct-model' } },
    { id: 'nested-image', type: 'image', data: {} },
    { id: 'nested-config', type: 'imageConfig', data: { model: 'nested-model' } },
    { id: 'loop-image', type: 'image', data: {} }
  ]
  const edges = [
    { source: 'nested-image', target: 'target' },
    { source: 'nested-config', target: 'nested-image' },
    { source: 'loop-image', target: 'loop-image' }
  ]

  assert.equal(getNearestImageNodeSourceConfig({
    nodes,
    edges,
    startNodeId: 'target'
  })?.id, 'direct-config')

  assert.equal(getNearestImageNodeSourceConfig({
    nodes: nodes.map((node) => node.id === 'target' ? { ...node, data: {} } : node),
    edges,
    startNodeId: 'target'
  })?.id, 'nested-config')

  assert.equal(getNearestImageNodeSourceConfig({
    nodes,
    edges,
    startNodeId: 'loop-image'
  }), null)
})

test('image node enhancement request preserves source config priority and 4k request fields', () => {
  const request = getImageNodeEnhancementRequest({
    sourceConfig: {
      id: 'config-1',
      type: 'imageConfig',
      data: {
        model: 'gpt-image-2',
        size: '1536x1024',
        quality: 'high',
        ratio: '3:2'
      }
    },
    sourceInputs: {
      prompt: ' Config prompt ',
      refImages: ['config-ref', '', 'config-ref']
    },
    currentNodeData: {
      model: 'node-model',
      size: '1024x1024',
      quality: 'standard',
      ratio: '1:1',
      sourceConfigId: 'node-config',
      sourcePrompt: 'Inherited prompt',
      sourceRefImages: ['inherited-ref']
    },
    displayImageUrl: ' self-image ',
    localImageModel: 'local-model',
    localImageQuality: 'local-quality',
    localImageRatio: '9:16',
    localImageSize: '720x1280',
    projectId: 'project-1',
    defaultImageModel: 'default-model',
    defaultImageSize: '1024x1024',
    defaultEnhancePrompt: 'Enhance this image',
    findNearestSizeKey: (ratio, resolution) => `${ratio}:${resolution}`,
    getRatioFromSizeKey: (size) => `ratio:${size}`
  })

  assert.deepEqual(request, {
    model: 'gpt-image-2',
    projectId: 'project-1',
    prompt: 'Config prompt',
    size: '3:2:4k',
    quality: 'high',
    ratio: '3:2',
    aspect_ratio: '3:2',
    resolution: '4k',
    image: ['config-ref', 'self-image'],
    sourceConfigId: 'config-1',
    sourcePrompt: 'Config prompt',
    sourceRefImages: ['config-ref', 'self-image']
  })
})

test('image node enhancement request falls back to self image defaults and returns null without inputs', () => {
  assert.deepEqual(getImageNodeEnhancementRequest({
    currentNodeData: {},
    displayImageUrl: 'self-image',
    localImageModel: 'local-model',
    localImageQuality: 'standard',
    localImageRatio: '',
    localImageSize: '1024x1024',
    projectId: 'project-2',
    defaultImageModel: 'default-model',
    defaultImageSize: '1024x1024',
    defaultEnhancePrompt: 'Enhance default',
    findNearestSizeKey: () => '',
    getRatioFromSizeKey: () => '1:1'
  }), {
    model: 'local-model',
    projectId: 'project-2',
    prompt: 'Enhance default',
    size: '1024x1024',
    quality: 'standard',
    ratio: '1:1',
    aspect_ratio: '1:1',
    resolution: '4k',
    image: ['self-image'],
    sourceConfigId: '',
    sourcePrompt: 'Enhance default',
    sourceRefImages: ['self-image']
  })

  assert.equal(getImageNodeEnhancementRequest({
    currentNodeData: {},
    displayImageUrl: '',
    localImageModel: 'local-model',
    localImageQuality: 'standard',
    localImageRatio: '',
    localImageSize: '',
    projectId: 'project-2',
    defaultImageModel: 'default-model',
    defaultImageSize: '1024x1024',
    defaultEnhancePrompt: 'Enhance default',
    findNearestSizeKey: () => '',
    getRatioFromSizeKey: () => '1:1'
  }), null)
})

test('image node tool save message maps shared save feedback modes to typed copy', () => {
  const messages = {
    synced: 'Tool result created',
    localOnly: 'Tool result saved locally',
    temporary: 'Tool result is temporary',
    failed: 'Tool result save failed'
  }

  assert.deepEqual(getImageNodeToolSaveMessage({
    saveFeedback: { mode: 'synced' },
    messages
  }), {
    type: 'success',
    text: 'Tool result created'
  })

  assert.deepEqual(getImageNodeToolSaveMessage({
    saveFeedback: { mode: 'local-only' },
    messages
  }), {
    type: 'success',
    text: 'Tool result saved locally'
  })

  assert.deepEqual(getImageNodeToolSaveMessage({
    saveFeedback: { mode: 'temporary' },
    messages
  }), {
    type: 'warning',
    text: 'Tool result is temporary'
  })

  assert.deepEqual(getImageNodeToolSaveMessage({
    saveFeedback: { mode: 'failed' },
    saveState: { hasTransientMedia: true },
    messages
  }), {
    type: 'warning',
    text: 'Tool result is temporary'
  })

  assert.deepEqual(getImageNodeToolSaveMessage({
    saveFeedback: { mode: 'failed' },
    persisted: false,
    messages
  }), {
    type: 'warning',
    text: 'Tool result is temporary'
  })

  assert.deepEqual(getImageNodeToolSaveMessage({
    saveFeedback: { mode: 'failed' },
    messages
  }), {
    type: 'warning',
    text: 'Tool result save failed'
  })
})

test('image node tool save message presets keep per-tool copy out of the component', () => {
  assert.deepEqual(getImageNodeToolSaveMessages('enhance-4k'), {
    synced: '4K enhanced image created',
    localOnly: '4K enhanced image saved in the current project',
    temporary: '4K result is only shown temporarily. Please retry until it is saved.',
    failed: 'Project save failed after 4K enhancement. Please retry save.'
  })

  assert.deepEqual(getImageNodeToolSaveMessages('remove-background'), {
    synced: 'Background removed and linked',
    localOnly: 'Background removed and saved in the current project',
    temporary: 'Background removed, but the result is only shown temporarily. Please retry.',
    failed: 'Background removed, but project save failed. Please retry save.'
  })

  assert.deepEqual(getImageNodeToolSaveMessages('multi-angle-replace'), {
    synced: 'Multi-angle result applied',
    localOnly: 'Multi-angle result saved in the current project',
    temporary: 'Multi-angle result is only shown temporarily. Please retry until it is saved.',
    failed: 'Image uploaded, but project save failed. Please retry save.'
  })

  assert.deepEqual(getImageNodeToolSaveMessages('multi-angle-create'), {
    synced: 'Multi-angle result created',
    localOnly: 'Multi-angle result saved in the current project',
    temporary: 'Multi-angle result is only shown temporarily. Please retry until it is saved.',
    failed: 'Project save failed after multi-angle generation. Please retry save.'
  })

  assert.deepEqual(getImageNodeToolSaveMessages('wedding-3x3'), {
    synced: 'Wedding 3x3 result created',
    localOnly: 'Wedding 3x3 result saved in the current project',
    temporary: 'Wedding 3x3 result is only shown temporarily. Please retry until it is saved.',
    failed: 'Project save failed after Wedding 3x3 generation. Please retry save.'
  })

  assert.deepEqual(getImageNodeToolSaveMessages('unknown-tool'), {})
})

test('image node tool save message works with preset messages', () => {
  assert.deepEqual(getImageNodeToolSaveMessage({
    saveFeedback: { mode: 'local-only' },
    messages: getImageNodeToolSaveMessages('multi-angle-create')
  }), {
    type: 'success',
    text: 'Multi-angle result saved in the current project'
  })

  assert.deepEqual(getImageNodeToolSaveMessage({
    saveFeedback: { mode: 'failed' },
    persisted: false,
    messages: getImageNodeToolSaveMessages('wedding-3x3')
  }), {
    type: 'warning',
    text: 'Wedding 3x3 result is only shown temporarily. Please retry until it is saved.'
  })
})

test('image node tool pending patch preserves payload while normalizing loading media state', () => {
  assert.equal(typeof imageNodeData.getImageNodeToolPendingPatch, 'function')
  assert.deepEqual(imageNodeData.getImageNodeToolPendingPatch({
    label: 'Multi Angle Pending',
    url: 'https://temporary/result.png',
    previewUrl: 'blob:preview',
    base64: 'data:image/png;base64,abc',
    error: 'previous error',
    sourcePrompt: 'prompt',
    sourceRefImages: ['https://asset/ref.png']
  }), {
    label: 'Multi Angle Pending',
    url: '',
    previewUrl: 'blob:preview',
    base64: '',
    loading: true,
    error: '',
    sourcePrompt: 'prompt',
    sourceRefImages: ['https://asset/ref.png']
  })
})

test('image node action pending patch marks current node busy without clearing media', () => {
  assert.equal(typeof imageNodeData.getImageNodeActionPendingPatch, 'function')
  assert.deepEqual(imageNodeData.getImageNodeActionPendingPatch(), {
    loading: true,
    error: ''
  })
})

test('image node action error patch clears loading and preserves failure message', () => {
  assert.equal(typeof imageNodeData.getImageNodeActionErrorPatch, 'function')
  assert.deepEqual(imageNodeData.getImageNodeActionErrorPatch({
    message: 'Image generation failed'
  }), {
    loading: false,
    error: 'Image generation failed'
  })

  assert.deepEqual(imageNodeData.getImageNodeActionErrorPatch({
    fallbackMessage: 'Generation stopped'
  }), {
    loading: false,
    error: 'Generation stopped'
  })
})

test('image node tool error patch clears generated media and keeps fallback message behavior', () => {
  assert.equal(typeof imageNodeData.getImageNodeToolErrorPatch, 'function')
  assert.deepEqual(imageNodeData.getImageNodeToolErrorPatch({
    payload: { message: 'Provider timed out' },
    fallbackMessage: 'Multi-angle generation failed'
  }), {
    url: '',
    base64: '',
    loading: false,
    error: 'Provider timed out'
  })

  assert.deepEqual(imageNodeData.getImageNodeToolErrorPatch({
    payload: {},
    fallbackMessage: 'Wedding 3x3 generation failed'
  }), {
    url: '',
    base64: '',
    loading: false,
    error: 'Wedding 3x3 generation failed'
  })
})

test('image node tool replacement patch preserves persisted and temporary result mapping', () => {
  assert.deepEqual(getImageNodeToolReplacementPatch({
    persistence: {
      persistedUrl: 'https://cdn.example/result.png',
      displayUrl: 'https://cdn.example/result.png',
      persisted: true
    },
    previousPersistedUrl: 'https://cdn.example/original.png',
    size: '1536x1024',
    ratio: '3:2',
    resolution: '2k',
    fileType: 'image/webp',
    transientPersistError: 'Multi-angle result is only shown temporarily. Please retry.',
    now: 2468
  }), {
    url: 'https://cdn.example/result.png',
    previewUrl: '',
    base64: '',
    persistStatus: 'saved',
    persistError: '',
    updatedAt: 2468,
    size: '1536x1024',
    ratio: '3:2',
    resolution: '2k',
    fileType: 'image/webp',
    error: ''
  })

  assert.deepEqual(getImageNodeToolReplacementPatch({
    persistence: {
      persistedUrl: '',
      displayUrl: 'blob:temporary',
      persisted: false,
      persistError: 'Generic persistence failed'
    },
    previousPersistedUrl: 'https://cdn.example/original.png',
    size: '1024x1024',
    ratio: '1:1',
    resolution: '1k',
    transientPersistError: 'Multi-angle result is only shown temporarily. Please retry.',
    now: 9753
  }), {
    url: 'https://cdn.example/original.png',
    previewUrl: 'blob:temporary',
    base64: '',
    persistStatus: 'error',
    persistError: 'Multi-angle result is only shown temporarily. Please retry.',
    updatedAt: 9753,
    size: '1024x1024',
    ratio: '1:1',
    resolution: '1k',
    fileType: 'image/png',
    error: ''
  })
})

test('image node tool linked result patch preserves pending tool output state', () => {
  assert.deepEqual(getImageNodeToolLinkedResultPatch({
    persistence: {
      persistedUrl: '',
      displayUrl: 'blob:multi-angle',
      persisted: false,
      persistError: 'Multi-angle persistence failed. Please retry.'
    },
    payload: {
      fileType: 'image/webp',
      size: '1536x1024',
      ratio: '3:2',
      resolution: '2k'
    },
    defaults: {
      size: '1024x1024',
      ratio: '1:1',
      resolution: '1k'
    },
    transientPersistError: 'Multi-angle result is only shown temporarily. Please retry.',
    now: 8642
  }), {
    url: '',
    previewUrl: 'blob:multi-angle',
    base64: '',
    persistStatus: 'pending',
    persistError: 'Multi-angle result is only shown temporarily. Please retry.',
    updatedAt: 8642,
    loading: false,
    shouldSave: false,
    error: '',
    fileType: 'image/webp',
    size: '1536x1024',
    ratio: '3:2',
    resolution: '2k'
  })

  assert.deepEqual(getImageNodeToolLinkedResultPatch({
    persistence: {
      persistedUrl: 'https://cdn.example/wedding.png',
      displayUrl: 'https://cdn.example/wedding.png',
      persisted: true
    },
    payload: {
      label: 'Wedding Result',
      quality: 'high',
      sourcePrompt: 'wedding prompt',
      sourceRefImages: ['https://asset/ref.png']
    },
    defaults: {
      size: '1024x1024',
      ratio: '1:1',
      resolution: '1k',
      quality: 'standard'
    },
    labelFallback: 'Wedding 3x3 Result',
    includeQuality: true,
    includeSource: true,
    transientPersistError: 'Wedding 3x3 result is only shown temporarily. Please retry.',
    now: 9754
  }), {
    url: 'https://cdn.example/wedding.png',
    previewUrl: '',
    base64: '',
    persistStatus: 'saved',
    persistError: '',
    updatedAt: 9754,
    loading: false,
    shouldSave: true,
    error: '',
    label: 'Wedding Result',
    fileType: 'image/png',
    size: '1024x1024',
    ratio: '1:1',
    resolution: '1k',
    quality: 'high',
    sourcePrompt: 'wedding prompt',
    sourceRefImages: ['https://asset/ref.png']
  })
})

test('image node tool linked create patch preserves direct create output state', () => {
  assert.equal(typeof imageNodeData.getImageNodeToolLinkedCreatePatch, 'function')
  assert.deepEqual(imageNodeData.getImageNodeToolLinkedCreatePatch({
    persistence: {
      persistedUrl: '',
      displayUrl: 'blob:multi-angle-create',
      persisted: false,
      persistError: 'Multi-angle persistence failed. Please retry.'
    },
    payload: {
      fileType: 'image/webp',
      size: '1536x1024',
      ratio: '3:2',
      resolution: '2k'
    },
    defaults: {
      size: '1024x1024',
      ratio: '1:1',
      resolution: '1k'
    },
    now: 2222
  }), {
    url: '',
    previewUrl: 'blob:multi-angle-create',
    base64: '',
    persistStatus: 'pending',
    persistError: 'Multi-angle persistence failed. Please retry.',
    updatedAt: 2222,
    fileType: 'image/webp',
    size: '1536x1024',
    ratio: '3:2',
    resolution: '2k'
  })

  assert.deepEqual(imageNodeData.getImageNodeToolLinkedCreatePatch({
    persistence: {
      persistedUrl: 'https://cdn.example/wedding-create.png',
      displayUrl: 'https://cdn.example/wedding-create.png',
      persisted: true
    },
    payload: {
      quality: 'high',
      sourcePrompt: 'wedding prompt',
      sourceRefImages: ['https://asset/ref.png']
    },
    defaults: {
      size: '1024x1024',
      ratio: '1:1',
      resolution: '1k',
      quality: 'standard'
    },
    labelFallback: 'Wedding 3x3 Result',
    includeQuality: true,
    includeSource: true,
    now: 3333
  }), {
    url: 'https://cdn.example/wedding-create.png',
    previewUrl: '',
    base64: '',
    persistStatus: 'saved',
    persistError: '',
    updatedAt: 3333,
    label: 'Wedding 3x3 Result',
    fileType: 'image/png',
    size: '1024x1024',
    ratio: '1:1',
    resolution: '1k',
    quality: 'high',
    sourcePrompt: 'wedding prompt',
    sourceRefImages: ['https://asset/ref.png']
  })
})

test('image node enhancement result patch preserves request lineage and persistence state', () => {
  assert.equal(typeof imageNodeData.getImageNodeEnhancementResultPatch, 'function')
  assert.deepEqual(imageNodeData.getImageNodeEnhancementResultPatch({
    persistence: {
      persistedUrl: 'https://cdn.example/enhanced.png',
      displayUrl: 'https://cdn.example/enhanced.png',
      persisted: true
    },
    request: {
      size: '2048x2048',
      ratio: '1:1',
      resolution: '4k',
      sourceConfigId: 'config-1',
      sourcePrompt: 'enhance prompt',
      sourceRefImages: ['https://asset/ref.png']
    },
    now: 24680
  }), {
    url: 'https://cdn.example/enhanced.png',
    previewUrl: '',
    base64: '',
    persistStatus: 'saved',
    persistError: '',
    updatedAt: 24680,
    loading: false,
    shouldSave: true,
    fileType: 'image/png',
    size: '2048x2048',
    ratio: '1:1',
    resolution: '4k',
    sourceConfigId: 'config-1',
    sourcePrompt: 'enhance prompt',
    sourceRefImages: ['https://asset/ref.png']
  })
})

test('image node enhancement error patch preserves request lineage and fallback message', () => {
  assert.equal(typeof imageNodeData.getImageNodeEnhancementErrorPatch, 'function')
  assert.deepEqual(imageNodeData.getImageNodeEnhancementErrorPatch({
    message: 'Provider rejected the image',
    request: {
      size: '2048x1536',
      ratio: '4:3',
      resolution: '4k',
      sourceConfigId: 'config-2',
      sourcePrompt: 'restore details',
      sourceRefImages: ['https://asset/source.png']
    }
  }), {
    loading: false,
    error: 'Provider rejected the image',
    size: '2048x1536',
    ratio: '4:3',
    resolution: '4k',
    sourceConfigId: 'config-2',
    sourcePrompt: 'restore details',
    sourceRefImages: ['https://asset/source.png']
  })

  assert.equal(imageNodeData.getImageNodeEnhancementErrorPatch({
    request: {},
    fallbackMessage: '4K enhancement failed'
  }).error, '4K enhancement failed')
})

test('image node remove background result patch preserves persistence and display metadata', () => {
  assert.equal(typeof imageNodeData.getImageNodeRemoveBackgroundResultPatch, 'function')
  assert.deepEqual(imageNodeData.getImageNodeRemoveBackgroundResultPatch({
    persistence: {
      persistedUrl: 'https://cdn.example/no-bg.png',
      displayUrl: 'https://cdn.example/no-bg.png',
      persisted: true
    },
    defaults: {
      size: '1536x1024',
      ratio: '3:2',
      resolution: '2k'
    },
    now: 13579
  }), {
    url: 'https://cdn.example/no-bg.png',
    previewUrl: '',
    base64: '',
    persistStatus: 'saved',
    persistError: '',
    updatedAt: 13579,
    size: '1536x1024',
    ratio: '3:2',
    resolution: '2k',
    fileType: 'image/png'
  })

  assert.deepEqual(imageNodeData.getImageNodeRemoveBackgroundResultPatch({
    persistence: {
      displayUrl: 'blob:no-bg',
      persisted: false,
      persistError: 'Background removal persistence failed. Please retry.'
    },
    defaults: {},
    now: 97531
  }), {
    url: '',
    previewUrl: 'blob:no-bg',
    base64: '',
    persistStatus: 'pending',
    persistError: 'Background removal persistence failed. Please retry.',
    updatedAt: 97531,
    size: '',
    ratio: '',
    resolution: '',
    fileType: 'image/png'
  })
})

test('image node upload save outcome preserves progress stage and feedback copy', () => {
  assert.deepEqual(getImageNodeUploadSaveOutcome({
    saveFeedback: { mode: 'synced' }
  }), {
    uploadStage: 'success',
    uploadProgress: 100,
    resetDelayMs: 900,
    message: {
      type: 'success',
      text: 'Upload complete and saved'
    }
  })

  assert.deepEqual(getImageNodeUploadSaveOutcome({
    saveFeedback: { mode: 'local-only' }
  }), {
    uploadStage: 'success',
    uploadProgress: 100,
    resetDelayMs: 900,
    message: {
      type: 'success',
      text: 'Upload complete and saved in the current project'
    }
  })

  assert.deepEqual(getImageNodeUploadSaveOutcome({
    saveFeedback: { mode: 'temporary' }
  }), {
    uploadStage: 'error',
    uploadProgress: 100,
    resetDelayMs: 2200,
    message: {
      type: 'warning',
      text: 'Upload succeeded, but the image is still temporary. Refresh may lose it.'
    }
  })

  assert.deepEqual(getImageNodeUploadSaveOutcome({
    saveFeedback: { mode: 'failed' }
  }), {
    uploadStage: 'error',
    uploadProgress: 100,
    resetDelayMs: 2200,
    message: {
      type: 'warning',
      text: 'Upload succeeded, but project save failed. Please retry save.'
    }
  })

  assert.deepEqual(getImageNodeUploadSaveOutcome({
    saveFeedback: { mode: 'unknown' },
    saveState: { hasTransientMedia: true }
  }), {
    uploadStage: 'error',
    uploadProgress: 100,
    resetDelayMs: 2200,
    message: {
      type: 'warning',
      text: 'Upload succeeded, but the image is still temporary. Refresh may lose it.'
    }
  })

  assert.deepEqual(getImageNodeUploadSaveOutcome({
    saveFeedback: { mode: 'unknown' },
    saveState: { hasTransientMedia: false }
  }), {
    uploadStage: 'error',
    uploadProgress: 100,
    resetDelayMs: 2200,
    message: {
      type: 'warning',
      text: 'Project save failed after upload. Please retry save.'
    }
  })
})

test('image node upload metadata maps dimensions to ratio and stable size', () => {
  assert.deepEqual(getImageNodeUploadMetadata({
    width: 1920,
    height: 1080,
    currentSize: '1024x1024'
  }), {
    ratio: '16:9',
    size: '1920x1080'
  })

  assert.deepEqual(getImageNodeUploadMetadata({
    width: 997,
    height: 333,
    currentSize: '1024x1024'
  }), {
    ratio: '997:333',
    size: '997x333'
  })

  assert.deepEqual(getImageNodeUploadMetadata({
    width: 0,
    height: 720,
    currentSize: '1536x1024'
  }), {
    ratio: '1:1',
    size: '1536x1024'
  })
})

test('image node upload preview patch preserves file metadata and temporary preview state', () => {
  assert.deepEqual(getImageNodeUploadPreviewPatch({
    previewUrl: 'blob:http://local/image',
    file: { name: 'source.png', type: 'image/png' },
    currentData: { sourcePrompt: ' keep prompt ' },
    isLocalPreviewMode: false,
    metadata: { ratio: '16:9', size: '1920x1080' },
    now: 1234
  }), {
    previewUrl: 'blob:http://local/image',
    base64: '',
    fileName: 'source.png',
    fileType: 'image/png',
    label: 'Image',
    updatedAt: 1234,
    loading: false,
    error: '',
    persistStatus: 'uploading',
    persistError: '',
    sourcePrompt: 'keep prompt',
    sourceRefImages: ['blob:http://local/image'],
    ratio: '16:9',
    size: '1920x1080'
  })
})

test('image node uploaded patch swaps preview state for persisted cloud state', () => {
  assert.deepEqual(getImageNodeUploadedPatch({
    uploadedUrl: 'https://cdn.example/image.png',
    file: { name: 'source.png', type: 'image/png' },
    currentData: { sourcePrompt: ' keep prompt ' },
    now: 5678
  }), {
    url: 'https://cdn.example/image.png',
    previewUrl: '',
    base64: '',
    fileName: 'source.png',
    fileType: 'image/png',
    updatedAt: 5678,
    error: '',
    sourcePrompt: 'keep prompt',
    sourceRefImages: ['https://cdn.example/image.png'],
    persistStatus: 'saving',
    persistError: ''
  })
})

test('image node replacement preview patch preserves current replacement display state', () => {
  assert.deepEqual(getImageNodeReplacementPreviewPatch({
    previousPersistedUrl: 'https://cdn.example/original.png',
    previewSource: 'data:image/png;base64,next',
    size: '1536x1024',
    ratio: '3:2',
    resolution: '2k',
    fileType: 'image/webp',
    isLocalPreviewMode: false,
    now: 1122
  }), {
    url: 'https://cdn.example/original.png',
    previewUrl: 'data:image/png;base64,next',
    base64: '',
    size: '1536x1024',
    ratio: '3:2',
    resolution: '2k',
    fileType: 'image/webp',
    updatedAt: 1122,
    error: '',
    persistStatus: 'saving',
    persistError: ''
  })
})

test('image node replacement upload patches preserve success and failure states', () => {
  assert.deepEqual(getImageNodeReplacementUploadedPatch({
    uploadedUrl: 'https://cdn.example/replaced.png',
    now: 3344
  }), {
    url: 'https://cdn.example/replaced.png',
    previewUrl: '',
    base64: '',
    updatedAt: 3344,
    error: '',
    persistStatus: 'saving',
    persistError: ''
  })

  assert.deepEqual(getImageNodeReplacementErrorPatch({
    previousPersistedUrl: 'https://cdn.example/original.png',
    previewSource: 'data:image/png;base64,next',
    restorePreviewState: true,
    now: 5566
  }), {
    url: 'https://cdn.example/original.png',
    previewUrl: 'data:image/png;base64,next',
    base64: '',
    persistStatus: 'error',
    persistError: 'Image upload failed. The new result is only shown temporarily.',
    updatedAt: 5566
  })

  assert.deepEqual(getImageNodeReplacementErrorPatch({
    restorePreviewState: false,
    now: 7788
  }), {
    persistStatus: 'error',
    persistError: 'Image upload failed. The new result is only shown temporarily.',
    updatedAt: 7788
  })
})

test('image node upload failure outcome preserves progress stage and save fallback copy', () => {
  assert.equal(typeof imageNodeData.getImageNodeUploadFailurePatch, 'function')
  assert.deepEqual(imageNodeData.getImageNodeUploadFailurePatch({ now: 13579 }), {
    persistStatus: 'error',
    persistError: 'Image upload failed. The selected file is only shown temporarily.',
    updatedAt: 13579
  })

  assert.deepEqual(getImageNodeUploadFailureOutcome({
    savedOk: true
  }), {
    uploadStage: 'error',
    uploadProgress: 100,
    resetDelayMs: 2200,
    message: {
      type: 'warning',
      text: 'Upload failed. The selected file is only shown temporarily.'
    }
  })

  assert.deepEqual(getImageNodeUploadFailureOutcome({
    savedOk: false,
    saveState: { hasTransientMedia: true }
  }), {
    uploadStage: 'error',
    uploadProgress: 100,
    resetDelayMs: 2200,
    message: {
      type: 'warning',
      text: 'Upload failed. The selected file is only shown temporarily.'
    }
  })

  assert.deepEqual(getImageNodeUploadFailureOutcome({
    savedOk: false,
    saveState: { hasTransientMedia: false }
  }), {
    uploadStage: 'error',
    uploadProgress: 100,
    resetDelayMs: 2200,
    message: {
      type: 'warning',
      text: 'Upload failed and the project could not be saved. Please retry.'
    }
  })
})

test('image node generation save message preserves create and regenerate feedback copy', () => {
  assert.deepEqual(getImageNodeGenerationSaveMessage({
    saveFeedback: { mode: 'synced' },
    savedOk: true,
    mode: 'create'
  }), {
    type: 'success',
    text: 'Image generated'
  })

  assert.deepEqual(getImageNodeGenerationSaveMessage({
    saveFeedback: { mode: 'synced' },
    savedOk: true,
    mode: 'regenerate'
  }), {
    type: 'success',
    text: 'Image regenerated'
  })

  assert.deepEqual(getImageNodeGenerationSaveMessage({
    saveFeedback: { mode: 'local-only' },
    mode: 'create'
  }), {
    type: 'success',
    text: 'Image generated and saved in the current project'
  })

  assert.deepEqual(getImageNodeGenerationSaveMessage({
    saveFeedback: { mode: 'local-only' },
    mode: 'regenerate'
  }), {
    type: 'success',
    text: 'Image regenerated in the current project'
  })

  assert.deepEqual(getImageNodeGenerationSaveMessage({
    saveFeedback: { mode: 'temporary' }
  }), {
    type: 'warning',
    text: 'Image generated, but the result is still temporary. Refresh may lose it.'
  })

  assert.deepEqual(getImageNodeGenerationSaveMessage({
    saveFeedback: { mode: 'failed' }
  }), {
    type: 'warning',
    text: 'Image generated and uploaded, but project save failed. Please retry save.'
  })

  assert.deepEqual(getImageNodeGenerationSaveMessage({
    saveFeedback: { mode: 'unknown' },
    saveState: { hasTransientMedia: true },
    savedOk: false
  }), {
    type: 'warning',
    text: 'Image generated, but the result is still temporary. Refresh may lose it.'
  })

  assert.deepEqual(getImageNodeGenerationSaveMessage({
    saveFeedback: { mode: 'unknown' },
    saveState: { hasTransientMedia: false },
    savedOk: false
  }), {
    type: 'warning',
    text: 'Image generated and uploaded, but project save failed. Please retry save.'
  })
})

test('image node replacement save message preserves silent synced and fallback copy', () => {
  assert.equal(getImageNodeReplacementSaveMessage({
    saveFeedback: { mode: 'synced' },
    savedOk: true
  }), null)

  assert.deepEqual(getImageNodeReplacementSaveMessage({
    saveFeedback: { mode: 'local-only' }
  }), {
    type: 'success',
    text: 'Image replacement saved in the current project'
  })

  assert.deepEqual(getImageNodeReplacementSaveMessage({
    saveFeedback: { mode: 'temporary' }
  }), {
    type: 'warning',
    text: 'The new image is only shown temporarily. Refresh may lose it.'
  })

  assert.deepEqual(getImageNodeReplacementSaveMessage({
    saveFeedback: { mode: 'failed' }
  }), {
    type: 'warning',
    text: 'Project save failed after image replacement.'
  })

  assert.deepEqual(getImageNodeReplacementSaveMessage({
    saveFeedback: { mode: 'unknown' },
    saveState: { hasTransientMedia: true },
    savedOk: false
  }), {
    type: 'warning',
    text: 'The new image is only shown temporarily. Refresh may lose it.'
  })

  assert.deepEqual(getImageNodeReplacementSaveMessage({
    saveFeedback: { mode: 'unknown' },
    saveState: { hasTransientMedia: false },
    savedOk: false
  }), {
    type: 'warning',
    text: 'Project save failed after image replacement.'
  })

  assert.equal(getImageNodeReplacementSaveMessage({
    saveFeedback: { mode: 'unknown' },
    savedOk: true
  }), null)
})
