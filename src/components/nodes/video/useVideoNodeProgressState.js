import { computed, getCurrentInstance, onUnmounted, ref, watch } from 'vue'

const getDefaultWindow = () => (typeof window === 'undefined' ? undefined : window)
const resolveSource = (source) => (typeof source === 'function' ? source() : source?.value)
const clampPercent = (value) => Math.max(0, Math.min(100, value))

export const getVideoNodeProgressNextValue = (value) => {
  if (value < 70) return Math.min(value + 3, 98)
  if (value < 90) return Math.min(value + 1.2, 98)
  if (value < 98) return Math.min(value + 0.35, 98)
  return Math.min(value, 98)
}

export const useVideoNodeProgressState = ({
  clearIntervalFn = (timer) => getDefaultWindow()?.clearInterval?.(timer),
  clearTimeoutFn = (timer) => getDefaultWindow()?.clearTimeout?.(timer),
  error: errorSource,
  hasVideo: hasVideoSource,
  loading: loadingSource,
  setIntervalFn = (callback, delay) => getDefaultWindow()?.setInterval?.(callback, delay),
  setTimeoutFn = (callback, delay) => getDefaultWindow()?.setTimeout?.(callback, delay)
}) => {
  const progressValue = ref(0)
  const showProgress = ref(false)
  const progressTimer = ref(null)
  const progressFinishTimer = ref(null)

  const loading = computed(() => Boolean(resolveSource(loadingSource)))
  const hasVideo = computed(() => Boolean(resolveSource(hasVideoSource)))
  const error = computed(() => resolveSource(errorSource))
  const progressPercent = computed(() => Math.round(progressValue.value))
  const progressBarStyle = computed(() => ({ width: `${clampPercent(progressValue.value)}%` }))

  const clearProgressTimers = () => {
    if (progressTimer.value) {
      clearIntervalFn(progressTimer.value)
      progressTimer.value = null
    }
    if (progressFinishTimer.value) {
      clearTimeoutFn(progressFinishTimer.value)
      progressFinishTimer.value = null
    }
  }

  const resetProgress = () => {
    clearProgressTimers()
    showProgress.value = false
    progressValue.value = 0
  }

  const startProgress = () => {
    clearProgressTimers()
    progressValue.value = 0
    showProgress.value = true
    progressTimer.value = setIntervalFn(() => {
      progressValue.value = getVideoNodeProgressNextValue(progressValue.value)
    }, 120)
  }

  const finishProgress = () => {
    clearProgressTimers()
    progressTimer.value = setIntervalFn(() => {
      progressValue.value = Math.min(100, progressValue.value + 4.5)
      if (progressValue.value >= 100) {
        clearProgressTimers()
        progressFinishTimer.value = setTimeoutFn(() => {
          showProgress.value = false
          progressValue.value = 0
        }, 120)
      }
    }, 16)
  }

  watch(
    loading,
    (loadingNow) => {
      if (loadingNow && !hasVideo.value) {
        startProgress()
        return
      }
      if (error.value) {
        resetProgress()
        return
      }
      if (showProgress.value) finishProgress()
    },
    { immediate: true }
  )

  if (getCurrentInstance()) {
    onUnmounted(() => clearProgressTimers())
  }

  return {
    clearProgressTimers,
    progressBarStyle,
    progressPercent,
    progressValue,
    resetProgress,
    showProgress
  }
}
