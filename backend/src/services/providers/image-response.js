export const normalizeImageResponse = (response = {}) => {
  const urls = []
  const pushUrl = (value, mime = 'image/png') => {
    if (Array.isArray(value)) {
      value.forEach((item) => pushUrl(item, mime))
      return
    }
    if (!value) return
    const str = String(value).trim()
    if (!str) return
    if (/^https?:\/\//i.test(str) || /^data:image\//i.test(str)) {
      urls.push(str)
      return
    }
    if (/^[A-Za-z0-9+/=\s]+$/.test(str) && str.length > 120) {
      urls.push(`data:${mime};base64,${str.replace(/\s+/g, '')}`)
    }
  }

  const candidates = Array.isArray(response?.candidates) ? response.candidates : []

  for (const candidate of candidates) {
    const parts = candidate?.content?.parts || []
    for (const part of parts) {
      if (part?.url || part?.image_url || part?.imageUrl) {
        pushUrl(part?.url || part?.image_url || part?.imageUrl)
      }
      const inlineData = part?.inline_data || part?.inlineData
      if (inlineData?.data) {
        const mime = inlineData.mime_type || inlineData.mimeType || 'image/png'
        pushUrl(inlineData.data, mime)
      }
      const fileData = part?.file_data || part?.fileData
      if (fileData?.file_uri || fileData?.fileUri || fileData?.url) {
        pushUrl(fileData.file_uri || fileData.fileUri || fileData.url)
      }
    }
  }

  const listCandidates = [
    ...(Array.isArray(response?.data) ? response.data : []),
    ...(Array.isArray(response?.data?.outputs) ? response.data.outputs : []),
    ...(Array.isArray(response?.data?.images) ? response.data.images : []),
    ...(Array.isArray(response?.data?.result?.images) ? response.data.result.images : []),
    ...(Array.isArray(response?.data?.task_result?.images) ? response.data.task_result.images : []),
    ...(Array.isArray(response?.data?.data) ? response.data.data : []),
    ...(Array.isArray(response?.images) ? response.images : []),
    ...(Array.isArray(response?.output) ? response.output : []),
    ...(Array.isArray(response?.result?.images) ? response.result.images : []),
    ...(Array.isArray(response?.task_result?.images) ? response.task_result.images : []),
    ...(Array.isArray(response?.outputs) ? response.outputs : [])
  ]

  for (const item of listCandidates) {
    if (typeof item === 'string') {
      pushUrl(item)
      continue
    }
    pushUrl(item?.url || item?.image_url || item?.imageUrl || item?.file_uri || item?.fileUri)
    pushUrl(item?.b64_json || item?.base64 || item?.image_base64, item?.mime_type || item?.mimeType || 'image/png')
  }

  pushUrl(response?.url || response?.image_url || response?.imageUrl)
  pushUrl(response?.data?.url || response?.data?.image_url || response?.data?.imageUrl)
  pushUrl(response?.output)
  pushUrl(response?.data?.output)
  pushUrl(response?.b64_json || response?.base64 || response?.image_base64)
  pushUrl(response?.data?.b64_json || response?.data?.base64 || response?.data?.image_base64)

  return {
    data: [...new Set(urls)].map((url) => ({ url })),
    raw: response
  }
}

export const extractPredictionMeta = (response = {}) => {
  const data = response?.data && typeof response.data === 'object' ? response.data : response
  return {
    id: String(data?.id || response?.id || '').trim(),
    status: String(data?.status || response?.status || '').trim().toLowerCase(),
    error: String(data?.error || response?.error || '').trim(),
    resultUrl: String(
      data?.urls?.get ||
      response?.urls?.get ||
      ''
    ).trim()
  }
}
