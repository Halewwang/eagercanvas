/**
 * Normalize API/Runtime errors for UI display.
 */
export const getErrorMessage = (error, fallback = 'Request failed') => {
  if (!error) return fallback
  if (typeof error === 'string') return error
  const message = String(error?.message || '').trim()
  const code = String(error?.response?.data?.code || error?.data?.code || error?.code || '').trim()
  if (code === 'SERVICE_API_KEY_RESERVED') {
    return '不能绑定系统管理 Key。请在服务商后台为该用户单独创建普通运行时 API Key 后再粘贴。'
  }
  if (code === 'DEROUTER_TIMEOUT') {
    return 'GPT Image lite 生成超时，请稍后重试。'
  }
  if (
    error?.name === 'AbortError' ||
    /^this operation was aborted$/i.test(message) ||
    /^the operation was aborted$/i.test(message)
  ) {
    return '请求超时或已被中断，请稍后重试。'
  }
  if (/^network error$/i.test(message) || /^failed to fetch$/i.test(message)) {
    return '无法连接到服务端，请稍后重试；如果已开通服务仍报错，请联系管理员检查后台服务配置。'
  }
  if (typeof error.message === 'string' && error.message.trim()) return error.message
  return fallback
}
