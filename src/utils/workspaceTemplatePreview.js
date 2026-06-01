const MAX_PREVIEW_ASSETS = 81

const getNodes = (canvasData = {}) => {
  const nodes = Array.isArray(canvasData?.nodes) ? canvasData.nodes : []
  return nodes.filter((node) => node?.id)
}

const getNodeLabel = (node = {}) => {
  const data = node.data || {}
  const raw = data.label || data.name || data.fileName || node.type || 'Image'
  return String(raw).trim().slice(0, 60) || 'Image'
}

const firstNonEmpty = (values = []) =>
  String(values.find((value) => String(value || '').trim()) || '').trim()

const getNodePreviewImageUrl = (node = {}) => {
  const data = node.data || {}
  const type = String(node.type || '').toLowerCase()
  if (type !== 'image') return ''

  const previewUrl = firstNonEmpty([
    data.previewImageUrl,
    data.previewUrl,
    data.thumbnail,
    data.coverUrl,
    data.base64,
    data.imageUrl,
    data.generatedImageUrl,
    data.resultUrl,
    data.outputUrl,
    data.output?.imageUrl,
    data.result?.imageUrl
  ])
  if (previewUrl) return previewUrl

  return firstNonEmpty([
    data.url,
    data.output?.url,
    data.result?.url
  ])
}

export const getWorkspaceTemplateNodeCount = (canvasData = {}) => getNodes(canvasData).length

export const getWorkspaceTemplatePreviewAssets = (canvasData = {}) => {
  const assets = []
  for (const node of getNodes(canvasData)) {
    const url = getNodePreviewImageUrl(node)
    if (!url) continue
    assets.push({
      id: node.id,
      label: getNodeLabel(node),
      url
    })
    if (assets.length >= MAX_PREVIEW_ASSETS) break
  }
  return assets
}

export const getWorkspaceTemplatePreviewGridSize = (canvasData = {}) => {
  const count = getWorkspaceTemplatePreviewAssets(canvasData).length
  if (count <= 0) return 0
  if (count <= 9) return 3
  if (count <= 36) return 6
  return 9
}
