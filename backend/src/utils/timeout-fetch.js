/* global AbortController, clearTimeout, fetch, setTimeout */

const createAbortError = (label, timeoutMs) => {
  const error = new Error(`${label} request timed out after ${timeoutMs}ms`)
  error.name = 'AbortError'
  return error
}

export const createTimeoutFetch = (baseFetch = fetch, timeoutMs, label = 'Upstream') => {
  return async (url, init = {}) => {
    const controller = new AbortController()
    const timeout = setTimeout(() => {
      controller.abort(createAbortError(label, timeoutMs))
    }, timeoutMs)

    if (init.signal?.aborted) {
      controller.abort(init.signal.reason)
    } else if (init.signal?.addEventListener) {
      init.signal.addEventListener('abort', () => controller.abort(init.signal.reason), { once: true })
    }

    try {
      return await baseFetch(url, {
        ...init,
        signal: controller.signal
      })
    } finally {
      clearTimeout(timeout)
    }
  }
}
