const PROVIDER_BRAND_PATTERN = /302/i

export const normalizeProviderVisibleMessage = (message, fallback = '模型服务商请求失败') => {
  const text = String(message || '').trim()
  const safeFallback = String(fallback || '模型服务商请求失败').trim() || '模型服务商请求失败'
  if (!text || PROVIDER_BRAND_PATTERN.test(text)) return safeFallback
  return text
}
