export const shouldApplyRemoteProjectSnapshot = ({
  refreshedProjectId = '',
  activeRouteProjectId = '',
  currentCanvasProjectId = '',
  hasPendingCanvasChanges = false
} = {}) => {
  const incomingProjectId = String(refreshedProjectId || '').trim()
  const routeProjectId = String(activeRouteProjectId || '').trim()
  const liveProjectId = String(currentCanvasProjectId || '').trim()

  if (!incomingProjectId || !routeProjectId || incomingProjectId !== routeProjectId) {
    return false
  }

  if (liveProjectId && incomingProjectId !== liveProjectId) {
    return false
  }

  if (hasPendingCanvasChanges) {
    return false
  }

  return true
}

const isTransientRemoteMediaUrl = (value = '') => {
  const raw = String(value || '').trim()
  if (!raw) return false
  return /[?&](token|signature|expires_in|X-Amz-Signature|X-Amz-Expires|GoogleAccessId)=/i.test(raw)
}

const hasUsableUrl = (value, now = Date.now()) => {
  const raw = String(value || '').trim()
  if (!raw) return false

  if (!isTransientRemoteMediaUrl(raw)) return true

  try {
    const parsed = new URL(raw)
    const expiresIn = Number(parsed.searchParams.get('expires_in') || parsed.searchParams.get('X-Amz-Expires') || 0)
    const issuedAtRaw =
      parsed.searchParams.get('created_at')
      || parsed.searchParams.get('issued_at')
      || parsed.searchParams.get('X-Amz-Date')
      || ''

    let issuedAtMs = 0
    if (/^\d+$/.test(issuedAtRaw)) {
      issuedAtMs = Number(issuedAtRaw)
      if (issuedAtMs < 1e12) issuedAtMs *= 1000
    } else if (issuedAtRaw) {
      const parsedIssuedAt = Date.parse(issuedAtRaw)
      issuedAtMs = Number.isFinite(parsedIssuedAt) ? parsedIssuedAt : 0
    }

    if (expiresIn > 0 && issuedAtMs > 0) {
      return issuedAtMs + expiresIn * 1000 > now
    }
  } catch {
    return false
  }

  return false
}

export const recoverMissingNodeMedia = ({
  nodes = [],
  edges = [],
  assets = [],
  now = Date.now()
} = {}) => {
  const assetMap = new Map()
  const safeAssets = Array.isArray(assets) ? assets : []

  safeAssets.forEach((asset) => {
    const sourceNodeId = String(asset?.sourceNodeId || '').trim()
    const url = String(asset?.url || '').trim()
    if (!sourceNodeId || !url) return
    const list = assetMap.get(sourceNodeId) || []
    list.push(asset)
    assetMap.set(sourceNodeId, list)
  })

  let restoredCount = 0
  const restoredNodeIds = []
  const nextNodes = (Array.isArray(nodes) ? nodes : []).map((node) => {
    if (!node || typeof node !== 'object') return node

    if (node.type === 'image' || node.type === 'video') {
      const currentUrl = String(node?.data?.url || '').trim()
      const currentPreviewUrl = String(node?.data?.previewUrl || '').trim()
      const currentBase64 = String(node?.data?.base64 || '').trim()
      const hasRecoverableGap =
        !hasUsableUrl(currentUrl, now)
        && !currentPreviewUrl
        && !currentBase64
      if (!hasRecoverableGap) return node

      const expectedKind = node.type === 'video' ? 'video' : 'image'
      const candidateIds = Array.from(new Set([
        String(node.id || '').trim(),
        String(node?.data?.sourceConfigId || '').trim(),
        ...(Array.isArray(edges) ? edges : [])
          .filter((edge) => edge?.target === node.id)
          .map((edge) => String(edge?.source || '').trim())
      ].filter(Boolean)))

      let matchedAsset = null
      for (const candidateId of candidateIds) {
        const candidates = assetMap.get(candidateId) || []
        matchedAsset = candidates.find((asset) => String(asset?.kind || '').trim() === expectedKind && String(asset?.url || '').trim())
        if (matchedAsset) break
      }

      if (!matchedAsset) return node

      restoredCount += 1
      restoredNodeIds.push(node.id)
      return {
        ...node,
        data: {
          ...(node.data || {}),
          url: matchedAsset.url,
          previewUrl: '',
          base64: '',
          loading: false,
          error: '',
          persistStatus: 'saved',
          persistError: '',
          updatedAt: now
        }
      }
    }

    return node
  })

  return {
    nodes: nextNodes,
    restoredCount,
    restoredNodeIds
  }
}
