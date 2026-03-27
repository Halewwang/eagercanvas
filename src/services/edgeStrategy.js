/**
 * Edge Strategy Service | 边策略服务
 * Handles edge connection logic based on node types
 */
import { nodes, edges } from '../stores/canvas'

const IMAGE_TARGET_TYPES = new Set(['image', 'imageConfig'])
const VIDEO_TARGET_TYPES = new Set(['video', 'videoConfig'])
const MODEL3D_TARGET_TYPES = new Set(['model3d', 'model3dConfig'])
const MODEL3D_VIEW_TYPES = new Set(['left', 'right', 'back', 'top', 'bottom', 'left_front', 'right_front'])

const getNodeById = (id) => nodes.value.find((node) => node.id === id)

const isImageTarget = (type) => IMAGE_TARGET_TYPES.has(type)
const isVideoTarget = (type) => VIDEO_TARGET_TYPES.has(type)
const isModel3DTarget = (type) => MODEL3D_TARGET_TYPES.has(type)

const getNextOrderedValue = (targetId, edgeType) => {
  const sameTargetEdges = edges.value.filter((edge) => edge.target === targetId && edge.type === edgeType)
  return sameTargetEdges.length + 1
}

const getImageRoleData = () => ({
  slot: 'first_frame_image',
  imageRole: 'first_frame_image'
})

const normalizePromptEdgeData = (targetId) => {
  const nextOrder = getNextOrderedValue(targetId, 'promptOrder')
  return {
    slot: 'prompts',
    promptOrder: nextOrder
  }
}

const normalizeImageRefEdgeData = (targetId) => {
  const nextOrder = getNextOrderedValue(targetId, 'imageOrder')
  return {
    slot: 'references',
    imageOrder: nextOrder
  }
}

const normalize3DViewEdgeData = (viewType) => {
  const safeViewType = MODEL3D_VIEW_TYPES.has(String(viewType || '').trim()) ? String(viewType).trim() : 'left'
  return {
    slot: 'multi_view',
    viewType: safeViewType
  }
}

const getSemanticConnection = (sourceNode, targetNode, params) => {
  if (!sourceNode || !targetNode) return params
  if (params?.type || params?.data?.slot) return params

  if (sourceNode.type === 'image' && isVideoTarget(targetNode.type)) {
    return {
      ...params,
      type: 'imageRole',
      data: getImageRoleData()
    }
  }

  if (sourceNode.type === 'text' && (isImageTarget(targetNode.type) || isVideoTarget(targetNode.type))) {
    return {
      ...params,
      type: 'promptOrder',
      data: normalizePromptEdgeData(params.target)
    }
  }

  if (sourceNode.type === 'text' && isModel3DTarget(targetNode.type)) {
    return {
      ...params,
      type: 'default',
      data: {
        slot: 'prompts'
      }
    }
  }

  if (sourceNode.type === 'image' && isImageTarget(targetNode.type)) {
    return {
      ...params,
      type: 'imageOrder',
      data: normalizeImageRefEdgeData(params.target)
    }
  }

  if (sourceNode.type === 'image' && isModel3DTarget(targetNode.type)) {
    return {
      ...params,
      type: 'model3dView',
      data: normalize3DViewEdgeData(params.data?.viewType || params.targetHandle)
    }
  }

  return params
}

const sortByOrder = (items) => items.sort((a, b) => a.order - b.order || a.index - b.index)

const getOrderedValue = (edge, key, fallbackValue) => {
  const parsed = Number(edge?.data?.[key])
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallbackValue
}

export const resolveNodeInputs = (targetNodeId) => {
  const targetNode = getNodeById(targetNodeId)
  const incomingEdges = edges.value.filter((edge) => edge.target === targetNodeId)

  const promptEntries = []
  const imageReferenceEntries = []
  let firstFrame = null
  let lastFrame = null
  const videoReferenceEntries = []
  const multiViewImages = []

  incomingEdges.forEach((edge, index) => {
    const sourceNode = getNodeById(edge.source)
    if (!sourceNode || sourceNode.id === targetNodeId) return

    if (sourceNode.type === 'text') {
      const content = String(sourceNode.data?.content || '').trim()
      if (!content) return

      promptEntries.push({
        edgeId: edge.id,
        nodeId: sourceNode.id,
        value: content,
        content,
        order: getOrderedValue(edge, 'promptOrder', promptEntries.length + 1),
        index
      })
      return
    }

    if (sourceNode.type !== 'image') return

    const imageValue = sourceNode.data?.base64 || sourceNode.data?.url
    if (!imageValue) return

    if (isImageTarget(targetNode?.type)) {
      imageReferenceEntries.push({
        edgeId: edge.id,
        nodeId: sourceNode.id,
        value: imageValue,
        imageData: imageValue,
        order: getOrderedValue(edge, 'imageOrder', imageReferenceEntries.length + 1),
        index
      })
      return
    }

    if (isModel3DTarget(targetNode?.type)) {
      const viewType = String(edge.data?.viewType || edge.targetHandle || '').trim()
      if (!MODEL3D_VIEW_TYPES.has(viewType)) return
      multiViewImages.push({
        edgeId: edge.id,
        nodeId: sourceNode.id,
        value: imageValue,
        image: imageValue,
        viewType,
        index
      })
      return
    }

    if (!isVideoTarget(targetNode?.type)) return

    const role = edge.data?.slot || edge.data?.imageRole || 'first_frame_image'
    const entry = {
      edgeId: edge.id,
      nodeId: sourceNode.id,
      value: imageValue,
      image: imageValue,
      role,
      index
    }

    if (role === 'first_frame_image' && !firstFrame) {
      firstFrame = entry
      return
    }

    if (role === 'last_frame_image' && !lastFrame) {
      lastFrame = entry
      return
    }

    videoReferenceEntries.push(entry)
  })

  sortByOrder(promptEntries)
  sortByOrder(imageReferenceEntries)

  return {
    prompts: promptEntries,
    prompt: promptEntries.map((item) => item.content).join('\n\n').trim(),
    references: imageReferenceEntries,
    refImages: imageReferenceEntries.map((item) => item.value),
    firstFrame,
    lastFrame,
    referenceImages: videoReferenceEntries,
    first_frame_image: firstFrame?.value || '',
    last_frame_image: lastFrame?.value || '',
    images: videoReferenceEntries.map((item) => item.value),
    multiViewImages,
    multi_view_images: multiViewImages.map((item) => ({
      viewType: item.viewType,
      value: item.value
    }))
  }
}

export const isConnectionValid = (params) => {
  const sourceNode = getNodeById(params?.source)
  const targetNode = getNodeById(params?.target)
  if (!sourceNode || !targetNode) return false
  if (sourceNode.id === targetNode.id) return false

  if (isImageTarget(targetNode.type)) {
    return ['text', 'image', 'imageConfig'].includes(sourceNode.type)
  }

  if (isVideoTarget(targetNode.type)) {
    return ['text', 'image', 'videoConfig'].includes(sourceNode.type)
  }

  if (isModel3DTarget(targetNode.type)) {
    if (sourceNode.type === 'image') return !params?.targetHandle || params.targetHandle === 'left'
    if (sourceNode.type === 'text') return !params?.targetHandle || params.targetHandle === 'left'
    return ['text', 'image', 'model3dConfig'].includes(sourceNode.type)
  }

  return true
}

export const edgeStrategy = {
  /**
   * Determine edge properties based on connection params
   * 根据连接参数确定边属性
   * @param {object} params - Connection params from Vue Flow (source, target, handles)
   * @returns {object} Edge object ready to be added
   */
  resolve: (params) => {
    const sourceNode = getNodeById(params.source)
    const targetNode = getNodeById(params.target)
    return getSemanticConnection(sourceNode, targetNode, params)
  }
}

export default edgeStrategy
