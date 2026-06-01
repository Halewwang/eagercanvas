import { toRaw } from 'vue'

export const cloneCanvasData = (value) => {
  const rawValue = toRaw(value)

  if (typeof structuredClone === 'function') {
    try {
      return structuredClone(rawValue)
    } catch {
      // Preserve the previous JSON-compatible clone behavior for non-cloneable values.
    }
  }

  return JSON.parse(JSON.stringify(rawValue))
}
