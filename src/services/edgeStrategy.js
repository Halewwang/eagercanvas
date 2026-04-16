/**
 * Edge Strategy Service | 边策略服务
 * Handles edge connection logic based on node types
 */
import { nodes, edges } from '../stores/canvas'
import { getVideoConnectionProfile } from '../config/models'

const IMAGE_TARGET_TYPES = new Set(['image', 'imageConfig'])
const VIDEO_TARGET_TYPES = new Set(['video', 'videoConfig'])

const getNodeById = (id) => nodes.value.find((node) => node.id === id)

const isImageTarget = (type) => IMAGE_TARGET_TYPES.has(type)
const isVideoTarget = (type) => VIDEO_TARGET_TYPES.has(type)

const getNextOrderedValue = (targetId, edgeType) => {
  const sameTargetEdges = edges.value.filter((edge) => edge.target === targetId && edge.type === edgeType)
  return sameTargetEdges.length + 1
}

const resolveVideoTargetProfile = (targetNode) => {
  if (!targetNode || !isVideoTarget(targetNode.type)) return null
  return getVideoConnectionProfile(targetNode.data?.model, targetNode.data?.o1_type)
}

const getImageRoleData = (targetNode) => {
  const profile = resolveVideoTargetProfile(targetNode)
  if (profile?.allowFirstFrame) {
    return {
      slot: 'first_frame_image',
      imageRole: 'first_frame_image'
    }
  }

  if (profile?.allowImageReference) {
    return {
      slot: 'input_reference',
      imageRole: 'input_reference'
    }
  }

  return {
    slot: 'first_frame_image',
    imageRole: 'first_frame_image'
  }
}

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

const getSemanticConnection = (sourceNode, targetNode, params) => {
  if (!sourceNode || !targetNode) return params
  if (params?.type || params?.data?.slot) return params

  if (sourceNode.type === 'image' && isVideoTarget(targetNode.type)) {
    return {
      ...params,
      type: 'imageRole',
      data: getImageRoleData(targetNode)
    }
  }

  if (sourceNode.type === 'video' && isVideoTarget(targetNode.type)) {
    return {
      ...params,
      type: 'default',
      data: {
        slot: 'video_reference'
      }
    }
  }

  if (sourceNode.type === 'text' && (isImageTarget(targetNode.type) || isVideoTarget(targetNode.type))) {
    return {
      ...params,
      type: 'promptOrder',
      data: normalizePromptEdgeData(params.target)
    }
  }

  if (sourceNode.type === 'image' && isImageTarget(targetNode.type)) {
    return {
      ...params,
      type: 'imageOrder',
      data: normalizeImageRefEdgeData(params.target)
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

    if (sourceNode.type === 'video' && isVideoTarget(targetNode?.type)) {
      const videoValue = sourceNode.data?.url
      if (!videoValue) return

      videoReferenceEntries.push({
        edgeId: edge.id,
        nodeId: sourceNode.id,
        value: videoValue,
        video: videoValue,
        role: edge.data?.slot || 'video_reference',
        index
      })
      return
    }

    if (sourceNode.type !== 'image') return

    const imageValue = sourceNode.data?.previewUrl || sourceNode.data?.base64 || sourceNode.data?.url
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

    imageReferenceEntries.push(entry)
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
    referenceImages: imageReferenceEntries,
    first_frame_image: firstFrame?.value || '',
    last_frame_image: lastFrame?.value || '',
    images: imageReferenceEntries.map((item) => item.value),
    referenceVideos: videoReferenceEntries,
    videos: videoReferenceEntries.map((item) => item.value)
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
    const profile = resolveVideoTargetProfile(targetNode)
    if (sourceNode.type === 'videoConfig') return true
    if (sourceNode.type === 'text') return Boolean(profile?.allowPrompt ?? true)
    if (sourceNode.type === 'image') {
      return Boolean(profile?.allowFirstFrame || profile?.allowLastFrame || profile?.allowImageReference)
    }
    if (sourceNode.type === 'video') {
      return Boolean(profile?.allowVideoReference)
    }
    return false
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
