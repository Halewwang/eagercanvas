const getDefaultStorage = () => {
  if (typeof localStorage === 'undefined') return null
  return localStorage
}

export const getStoredValue = (key, fallback = '', { storage = getDefaultStorage() } = {}) => {
  try {
    return storage?.getItem?.(key) || fallback
  } catch {
    return fallback
  }
}

export const setStoredValue = (key, value, { storage = getDefaultStorage() } = {}) => {
  try {
    if (value) {
      storage?.setItem?.(key, value)
    } else {
      storage?.removeItem?.(key)
    }
  } catch {
    // Storage can be unavailable in private mode, tests, or restricted embeds.
  }
}

export const removeStoredValue = (key, { storage = getDefaultStorage() } = {}) => {
  try {
    storage?.removeItem?.(key)
  } catch {
    // Storage can be unavailable in private mode, tests, or restricted embeds.
  }
}
