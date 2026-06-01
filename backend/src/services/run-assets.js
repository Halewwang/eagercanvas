import { uploadDataUrl, uploadRemoteFile } from './upload.service.js'

export const extractProviderVideoUrl = (result = {}) =>
  result?.url ||
  result?.video_url ||
  result?.download?.url ||
  result?.data?.url ||
  result?.data?.video_url ||
  result?.data?.download?.url ||
  result?.raw?.url ||
  result?.raw?.video_url ||
  result?.raw?.download?.url ||
  result?.raw?.task_result?.video_url ||
  result?.raw?.task_result?.videos?.[0]?.url ||
  ''

export const isPersistedUploadUrl = (value = '') => String(value || '').includes('/storage/v1/object/public/uploads/')
export const isInlineDataUrl = (value = '') => /^data:image\/[^;,]+;base64,/i.test(String(value || '').trim())

export const persistRemoteUrlIfNeeded = async (url, fileName) => {
  const raw = String(url || '').trim()
  if (!raw || isPersistedUploadUrl(raw)) return raw
  return uploadRemoteFile({ url: raw, fileName }).then((result) => String(result?.url || '').trim() || raw)
}

export const persistDataUrlIfNeeded = async (dataUrl, fileName) => {
  const raw = String(dataUrl || '').trim()
  if (!raw || !isInlineDataUrl(raw)) return raw
  return uploadDataUrl({ dataUrl: raw, fileName }).then((result) => String(result?.url || '').trim() || raw)
}

export const persistImageResultAssets = async (result = {}, options = {}) => {
  const persistRemoteUrl = options.persistRemoteUrl || persistRemoteUrlIfNeeded
  const persistDataUrl = options.persistDataUrl || persistDataUrlIfNeeded
  const entries = Array.isArray(result?.data) ? [...result.data] : []
  if (!entries.length) return result

  const persistedEntries = await Promise.all(
    entries.map(async (entry, index) => {
      const remoteUrl = String(entry?.url || '').trim()
      if (!remoteUrl) return entry

      const fileName = `generated-${Date.now()}-${index}.png`
      const persistedUrl = isInlineDataUrl(remoteUrl)
        ? await persistDataUrl(remoteUrl, fileName).catch(() => remoteUrl)
        : await persistRemoteUrl(remoteUrl, fileName).catch(() => remoteUrl)

      return {
        ...entry,
        url: persistedUrl
      }
    })
  )

  return {
    ...result,
    data: persistedEntries
  }
}

export const persistVideoResultAsset = async (result = {}, options = {}) => {
  const persistRemoteUrl = options.persistRemoteUrl || persistRemoteUrlIfNeeded
  const rawUrl = String(extractProviderVideoUrl(result) || '').trim()
  if (!rawUrl) return result

  const persistedUrl = await persistRemoteUrl(
    rawUrl,
    `video-${Date.now()}.mp4`
  ).catch(() => rawUrl)

  const nextResult = {
    ...result,
    url: result?.url ? persistedUrl : result?.url,
    video_url: result?.video_url ? persistedUrl : result?.video_url
  }

  if (nextResult?.data && typeof nextResult.data === 'object') {
    nextResult.data = {
      ...nextResult.data,
      url: nextResult.data?.url ? persistedUrl : nextResult.data?.url,
      video_url: nextResult.data?.video_url ? persistedUrl : nextResult.data?.video_url,
      task_result: nextResult.data?.task_result
        ? {
            ...nextResult.data.task_result,
            video_url: nextResult.data.task_result?.video_url ? persistedUrl : nextResult.data.task_result?.video_url,
            videos: Array.isArray(nextResult.data.task_result?.videos)
              ? nextResult.data.task_result.videos.map((video, index) =>
                  index === 0 ? { ...video, url: persistedUrl } : video
                )
              : nextResult.data.task_result?.videos
          }
        : nextResult.data?.task_result
    }
  }

  if (nextResult?.task_result && typeof nextResult.task_result === 'object') {
    nextResult.task_result = {
      ...nextResult.task_result,
      video_url: nextResult.task_result?.video_url ? persistedUrl : nextResult.task_result?.video_url,
      videos: Array.isArray(nextResult.task_result?.videos)
        ? nextResult.task_result.videos.map((video, index) =>
            index === 0 ? { ...video, url: persistedUrl } : video
          )
        : nextResult.task_result?.videos
    }
  }

  if (nextResult?.raw && typeof nextResult.raw === 'object') {
    nextResult.raw = {
      ...nextResult.raw,
      url: nextResult.raw?.url ? persistedUrl : nextResult.raw?.url,
      video_url: nextResult.raw?.video_url ? persistedUrl : nextResult.raw?.video_url,
      task_result: nextResult.raw?.task_result
        ? {
            ...nextResult.raw.task_result,
            video_url: nextResult.raw.task_result?.video_url ? persistedUrl : nextResult.raw.task_result?.video_url,
            videos: Array.isArray(nextResult.raw.task_result?.videos)
              ? nextResult.raw.task_result.videos.map((video, index) =>
                  index === 0 ? { ...video, url: persistedUrl } : video
                )
              : nextResult.raw.task_result?.videos
          }
        : nextResult.raw?.task_result
    }
  }

  return nextResult
}

export const buildImageGenerationAssets = (result = {}, sourceNodeId = '') =>
  (Array.isArray(result?.data) ? result.data : [])
    .map((item, index) => {
      const url = String(item?.url || '').trim()
      if (!url || isInlineDataUrl(url)) return null
      return {
        kind: 'image',
        url,
        previewUrl: url,
        fileName: `generated-${index + 1}.png`,
        fileType: 'image/png',
        origin: 'generation',
        ...(sourceNodeId ? { sourceNodeId } : {})
      }
    })
    .filter(Boolean)

export const resolveVideoSourceNodeId = (...candidates) => {
  for (const candidate of candidates) {
    const value = String(
      candidate?.sourceNodeId ||
      candidate?.source_node_id ||
      ''
    ).trim()
    if (value) return value
  }
  return ''
}

export const buildVideoGenerationAssets = (result = {}, sourceNodeId = '') => {
  const url = String(extractProviderVideoUrl(result) || '').trim()
  if (!url) return []
  const safeSourceNodeId = resolveVideoSourceNodeId(result, { sourceNodeId })
  return [{
    kind: 'video',
    url,
    previewUrl: url,
    fileName: 'generated-video.mp4',
    fileType: 'video/mp4',
    origin: 'generation',
    ...(safeSourceNodeId ? { sourceNodeId: safeSourceNodeId } : {})
  }]
}
