export const defaultCanvasData = {
  nodes: [],
  edges: [],
  viewport: { x: 100, y: 50, zoom: 0.8 }
}

export const cloneProjectCanvasData = (canvasData) => JSON.parse(JSON.stringify(canvasData || defaultCanvasData))

export const getProjectCanvasDataKey = (canvasData) => JSON.stringify(canvasData || defaultCanvasData)

export const isPersistedProjectUploadUrl = (value = '') =>
  String(value || '').includes('/storage/v1/object/public/uploads/')

export const mapProjectFromApi = (row = {}) => ({
  id: row.id,
  name: row.name,
  thumbnail: row.thumbnail_url || '',
  workspaceId: row.workspace_id || '',
  accessMode: row.access_mode || 'private',
  accessSource: row.access_source || '',
  permission: row.permission || 'owner',
  ownerUserId: row.user_id || row.owner_user_id || '',
  ownerDisplayName: row.owner_display_name || '',
  ownerAvatarUrl: row.owner_avatar_url || '',
  ownerUsername: row.owner_username || '',
  ownerEmail: row.owner_email || '',
  createdAt: row.created_at,
  updatedAt: row.updated_at,
  lastOpenedAt: null,
  serverUpdatedAt: row.updated_at,
  readState: 'remote',
  canvasData: Object.prototype.hasOwnProperty.call(row || {}, 'canvas_json')
    ? (row.canvas_json || { ...defaultCanvasData })
    : undefined
})

export const mapProjectToApi = (project = {}) => ({
  name: project.name,
  canvasData: project.canvasData,
  // Only persist stable public URLs as project thumbnail.
  // Data URLs can break backend validation and autosave flow.
  thumbnailUrl: isPersistedProjectUploadUrl(String(project.thumbnail || ''))
    ? String(project.thumbnail)
    : null
})

const getNodeMediaUrl = (node) => {
  const url = String(node?.data?.url || '').trim()
  // Blob URLs are session-scoped and cannot survive refresh.
  if (!url || url.startsWith('blob:')) return ''
  if (!isPersistedProjectUploadUrl(url)) return ''
  return url
}

export const toTs = (value) => {
  const ts = new Date(value || 0).getTime()
  return Number.isFinite(ts) ? ts : 0
}

const getNodeUpdatedTs = (node) => {
  const data = node?.data || {}
  return Math.max(toTs(data.updatedAt), toTs(data.createdAt), 0)
}

const pickLatestNodeUrl = (list) => {
  let latestNode = null
  let latestTs = -1

  for (const node of list) {
    const url = getNodeMediaUrl(node)
    if (!url) continue
    const ts = getNodeUpdatedTs(node)
    if (ts >= latestTs) {
      latestTs = ts
      latestNode = node
    }
  }

  return latestNode ? getNodeMediaUrl(latestNode) : ''
}

export const resolveProjectThumbnail = (canvasData, currentThumbnail = '') => {
  const list = Array.isArray(canvasData?.nodes) ? canvasData.nodes : []
  if (list.length === 0) return currentThumbnail || ''

  const imageThumbnail = pickLatestNodeUrl(list.filter((node) => node?.type === 'image'))
  if (imageThumbnail) return imageThumbnail

  const videoThumbnail = pickLatestNodeUrl(list.filter((node) => node?.type === 'video'))
  if (videoThumbnail) return videoThumbnail

  return currentThumbnail || ''
}

export const toProjectSummary = (project = {}, now = new Date().toISOString()) => ({
  id: project.id,
  name: project.name,
  thumbnail: project.thumbnail || '',
  workspaceId: project.workspaceId || '',
  accessMode: project.accessMode || 'private',
  accessSource: project.accessSource || '',
  permission: project.permission || 'owner',
  ownerUserId: project.ownerUserId || '',
  ownerDisplayName: project.ownerDisplayName || '',
  ownerAvatarUrl: project.ownerAvatarUrl || '',
  ownerUsername: project.ownerUsername || '',
  ownerEmail: project.ownerEmail || '',
  createdAt: project.createdAt || now,
  updatedAt: project.updatedAt || now,
  lastOpenedAt: project.lastOpenedAt || null,
  serverUpdatedAt: project.serverUpdatedAt || null
})

export const getProjectActivityTs = (project) => Math.max(
  toTs(project?.updatedAt),
  toTs(project?.createdAt)
)

export const sortProjectsByActivity = (list = []) =>
  [...(Array.isArray(list) ? list : [])].sort((a, b) => {
    const delta = getProjectActivityTs(b) - getProjectActivityTs(a)
    if (delta !== 0) return delta
    return toTs(b?.createdAt) - toTs(a?.createdAt)
  })

export const mergeCachedProjectSummaries = (cachedProjects = [], currentProjects = []) => {
  const currentById = new Map((Array.isArray(currentProjects) ? currentProjects : [])
    .filter((project) => project?.id)
    .map((project) => [project.id, project]))
  const cachedIds = new Set()
  const isCurrentProjectFreshEnough = (currentProject, cachedProject) => {
    const currentTs = Math.max(toTs(currentProject?.serverUpdatedAt), toTs(currentProject?.updatedAt))
    const cachedTs = Math.max(toTs(cachedProject?.serverUpdatedAt), toTs(cachedProject?.updatedAt))
    return !cachedTs || currentTs >= cachedTs
  }

  const mergedCached = (Array.isArray(cachedProjects) ? cachedProjects : [])
    .filter((project) => project?.id)
    .map((cachedProject) => {
      cachedIds.add(cachedProject.id)
      const currentProject = currentById.get(cachedProject.id)

      if (
        cachedProject.remoteSynced === true
        && currentProject?.readState === 'remote'
        && isCurrentProjectFreshEnough(currentProject, cachedProject)
      ) {
        return {
          ...cachedProject,
          ...currentProject,
          lastOpenedAt: cachedProject.lastOpenedAt || currentProject.lastOpenedAt || null
        }
      }

      return {
        ...cachedProject,
        readState: cachedProject.readState || 'local-cache'
      }
    })

  const remoteOnly = Array.from(currentById.values())
    .filter((project) => project?.readState === 'remote' && !cachedIds.has(project.id))

  return [...mergedCached, ...remoteOnly]
}

export const hasCanvasContent = (canvasData) => {
  const nodes = Array.isArray(canvasData?.nodes) ? canvasData.nodes.length : 0
  const edges = Array.isArray(canvasData?.edges) ? canvasData.edges.length : 0
  const groups = Array.isArray(canvasData?.groups) ? canvasData.groups.length : 0
  return nodes > 0 || edges > 0 || groups > 0
}

export const getProjectBaseVersion = (project, fallbackVersion = null) =>
  String(project?.serverUpdatedAt || fallbackVersion || project?.updatedAt || '').trim() || null
