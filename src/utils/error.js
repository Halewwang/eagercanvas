/**
 * Normalize API/Runtime errors for UI display.
 */
export const getErrorMessage = (error, fallback = 'Request failed') => {
  if (!error) return fallback
  if (typeof error === 'string') return error
  const message = String(error?.message || '').trim()
  if (/^network error$/i.test(message) || /^failed to fetch$/i.test(message)) {
    return '无法连接到服务端，请稍后重试；如果已分配 API Key 仍报错，请联系管理员检查后台服务配置。'
  }
  if (typeof error.message === 'string' && error.message.trim()) return error.message
  return fallback
}
