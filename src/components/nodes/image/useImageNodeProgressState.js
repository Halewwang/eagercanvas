import { computed, getCurrentInstance, onUnmounted, ref, watch } from 'vue'
import {
  getImageNodeFinishProgressNextValue,
  getImageNodeProgressBarStyle,
  getImageNodeProgressNextValue,
  getImageNodeProgressPercent,
  getImageNodeUploadProgressStyle
} from '@/utils/imageNodeLayout'

const getDefaultWindow = () => (typeof window === 'undefined' ? null : window)

export const useImageNodeProgressState = ({
  clearIntervalFn = (timer) => getDefaultWindow()?.clearInterval(timer),
  clearTimeoutFn = (timer) => getDefaultWindow()?.clearTimeout(timer),
  error = () => '',
  loading = () => false,
  setIntervalFn = (callback, delay) => getDefaultWindow()?.setInterval(callback, delay),
  setTimeoutFn = (callback, delay) => getDefaultWindow()?.setTimeout(callback, delay)
} = {}) => {
  const showUploadProgress = ref(false)
  const uploadProgress = ref(0)
  const uploadStage = ref('idle')
  const progressValue = ref(0)
  const showProgress = ref(false)
  const progressTimer = ref(null)
  const progressFinishTimer = ref(null)

  const progressPercent = computed(() => getImageNodeProgressPercent(progressValue.value))
  const progressBarStyle = computed(() => getImageNodeProgressBarStyle(progressValue.value))
  const uploadProgressStyle = computed(() => getImageNodeUploadProgressStyle({
    progress: uploadProgress.value,
    stage: uploadStage.value
  }))

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
      progressValue.value = getImageNodeProgressNextValue(progressValue.value)
    }, 120)
  }

  const finishProgress = () => {
    clearProgressTimers()
    progressTimer.value = setIntervalFn(() => {
      progressValue.value = getImageNodeFinishProgressNextValue(progressValue.value)
      if (progressValue.value >= 100) {
        clearProgressTimers()
        progressFinishTimer.value = setTimeoutFn(() => {
          showProgress.value = false
          progressValue.value = 0
        }, 120)
      }
    }, 16)
  }

  watch(loading, (loadingNow) => {
    if (loadingNow) {
      startProgress()
      return
    }
    if (error()) {
      resetProgress()
      return
    }
    if (showProgress.value) finishProgress()
  }, { immediate: true })

  if (getCurrentInstance()) {
    onUnmounted(() => clearProgressTimers())
  }

  return {
    clearProgressTimers,
    progressBarStyle,
    progressPercent,
    progressValue,
    resetProgress,
    showProgress,
    showUploadProgress,
    uploadProgress,
    uploadProgressStyle,
    uploadStage
  }
}

export default useImageNodeProgressState
