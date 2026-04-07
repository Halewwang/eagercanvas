const extractProviderResponseRequestId = (response) => {
  const candidates = [
    response?.headers?.get?.('request-id'),
    response?.headers?.get?.('x-request-id'),
    response?.headers?.get?.('x-302-request-id')
  ]
  const found = candidates.find((value) => value !== undefined && value !== null && String(value).trim() !== '')
  return found ? String(found).trim() : ''
}

export const attachProviderResponseMetadata = (data = {}, response) => {
  const requestId = extractProviderResponseRequestId(response)
  if (!requestId || !data || typeof data !== 'object' || Array.isArray(data)) return data

  if (!data.request_id && !data.requestId) data.request_id = requestId
  if (data.raw && typeof data.raw === 'object' && !Array.isArray(data.raw)) {
    if (!data.raw.request_id && !data.raw.requestId) data.raw.request_id = requestId
  } else if (!data.raw) {
    data.raw = { request_id: requestId }
  }
  return data
}
