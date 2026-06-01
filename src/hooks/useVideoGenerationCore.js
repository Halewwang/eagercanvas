const createAbortError = () => {
  if (typeof DOMException === 'function') {
    return new DOMException('Aborted', 'AbortError')
  }
  const error = new Error('Aborted')
  error.name = 'AbortError'
  return error
}

export const isAbortError = (error) => error?.name === 'AbortError'

export const waitForAbortableDelay = (ms, signal, timers = globalThis) => new Promise((resolve, reject) => {
  if (signal?.aborted) {
    reject(createAbortError())
    return
  }

  let timer = null
  const clearTimer = () => {
    if (timer === null) return
    timers.clearTimeout(timer)
    timer = null
  }
  const handleAbort = () => {
    clearTimer()
    reject(createAbortError())
  }

  timer = timers.setTimeout(() => {
    signal?.removeEventListener?.('abort', handleAbort)
    timer = null
    resolve()
  }, ms)

  signal?.addEventListener?.('abort', handleAbort, { once: true })
})
