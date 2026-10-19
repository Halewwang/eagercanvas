import { resolveLocalPreviewAccessToken } from './localPreview.js'

export const applyRequestAccessToken = (
  config = {},
  {
    storedToken = '',
    env = import.meta.env || {}
  } = {}
) => {
  config.headers = config.headers || {}
  const token = resolveLocalPreviewAccessToken(storedToken, env)
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
}
