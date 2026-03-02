/**
 * Normalize API/Runtime errors for UI display.
 */
export const getErrorMessage = (error, fallback = 'Request failed') => {
  if (!error) return fallback
  if (typeof error === 'string') return error
  if (typeof error.message === 'string' && error.message.trim()) return error.message
  return fallback
}

