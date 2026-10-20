import { getGptImageGenerationSettings } from '@/utils/gptImageParameters.js'
import { getImageRatioFromDimensions } from '@/utils/imageDimensions.js'

const hasMedia = (data = {}) => ['url', 'previewUrl', 'base64'].some(key => data[key])
const hasValue = value => Array.isArray(value) ? value.some(Boolean) : String(value || '').trim() !== ''

const getLegacyGenerationData = (data = {}) => {
  const [width, height] = String(data.size || '').split('x').map(Number)
  const settings = getGptImageGenerationSettings({
    ...data,
    generationRatio: data.generationRatio ?? data.exportRatio ?? data.ratio ?? data.aspect_ratio ?? (width && height ? getImageRatioFromDimensions(width, height) : undefined),
    generationResolution: data.generationResolution ?? data.resolution ?? (width && height ? (Math.max(width, height) >= 3000 ? '4k' : Math.max(width, height) >= 1700 ? '2k' : '1k') : undefined)
  })
  return {
    generationRatio: settings.ratio,
    generationResolution: settings.resolution,
  }
}

export const migrateLegacyImageConfigNodes = (canvas = {}) => {
  const { nodes = [], edges = [], groups = [] } = canvas
  if (!Array.isArray(nodes) || !nodes.some(node => node.type === 'imageConfig')) return canvas

  const nodeById = new Map(nodes.map(node => [node.id, node]))
  const replacements = new Map()
  const removed = new Set()
  const inheritedData = new Map()

  for (const config of nodes.filter(node => node.type === 'imageConfig')) {
    const outputs = [...new Set(edges.filter(edge => edge.source === config.id && nodeById.get(edge.target)?.type === 'image').map(edge => edge.target))]
    // Grouped nodes keep their identity so migration cannot erase or merge groups.
    const affectsGroups = groups.some(group => group.nodeIds?.includes(config.id))
    if (!outputs.length || hasMedia(config.data) || affectsGroups) {
      replacements.set(config.id, [config.id])
      continue
    }
    replacements.set(config.id, outputs)
    removed.add(config.id)
    for (const id of outputs) {
      const data = { ...(inheritedData.get(id) || nodeById.get(id).data) }
      const defaults = {
        ...getLegacyGenerationData(config.data),
        model: config.data?.model,
        prompt: config.data?.prompt,
        sourcePrompt: hasValue(config.data?.sourcePrompt) ? config.data.sourcePrompt : config.data?.prompt,
        sourceRefImages: config.data?.sourceRefImages,
        // Old assets may still be indexed by the removed configuration ID.
        sourceConfigId: config.id
      }
      for (const [key, value] of Object.entries(defaults)) {
        if (!hasValue(data[key]) && hasValue(value)) data[key] = value
      }
      inheritedData.set(id, data)
    }
  }

  const replace = id => replacements.get(id) || [id]
  const nextNodes = nodes.filter(node => !removed.has(node.id)).map(node => {
    if (node.type !== 'imageConfig') return inheritedData.has(node.id) ? { ...node, data: inheritedData.get(node.id) } : node
    const data = { ...node.data, ...getLegacyGenerationData(node.data) }
    for (const key of ['generationQuality', 'background', 'exportRatio', 'exportSize', 'quality', 'resolution', 'aspect_ratio']) delete data[key]
    if (!hasValue(data.sourcePrompt) && hasValue(data.prompt)) data.sourcePrompt = data.prompt
    if (!hasMedia(data)) {
      delete data.size
      delete data.ratio
    }
    return { ...node, type: 'image', data }
  })

  const seenEdges = new Set()
  const nextEdges = edges.flatMap(edge => {
    if (removed.has(edge.source) && replace(edge.source).includes(edge.target)) return []
    return replace(edge.source).flatMap(source => replace(edge.target).flatMap(target => {
      if (source === target) return []
      const key = JSON.stringify([source, target, edge.sourceHandle, edge.targetHandle, edge.type, edge.data])
      if (seenEdges.has(key)) return []
      seenEdges.add(key)
      return [{ ...edge, source, target, id: source === edge.source && target === edge.target ? edge.id : `${edge.id}_${source}_${target}` }]
    }))
  })

  return {
    ...canvas,
    nodes: nextNodes,
    edges: nextEdges,
    groups: groups.map(group => ({
      ...group,
      nodeIds: [...new Set((group.nodeIds || []).flatMap(replace))],
      ...(Array.isArray(group.outputLinks) ? {
        outputLinks: group.outputLinks.flatMap(link => replace(link.targetNodeId).map(targetNodeId => ({
          ...link,
          targetNodeId,
          id: targetNodeId === link.targetNodeId ? link.id : `${link.id}_${targetNodeId}`
        })))
      } : {})
    }))
  }
}
