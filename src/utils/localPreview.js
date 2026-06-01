export const isLocalPreviewEnabled = (env = import.meta.env || {}) => {
  return Boolean(env?.DEV && String(env?.VITE_BYPASS_AUTH || '').trim().toLowerCase() === 'true')
}
