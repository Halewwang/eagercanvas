import { onUnmounted, reactive, ref } from 'vue'
import { createVideoTask, getVideoTaskStatus } from '@/api'
import { getModelByName } from '@/config/models'
import { isAbortError, waitForAbortableDelay } from '@/hooks/useVideoGenerationCore.js'
import { useApiState } from './useApiState.js'
import {
  DONE_VIDEO_STATUSES,
  TRANSIENT_VIDEO_ERROR_STATUSES,
  buildVideoRequestData,
  getVideoTaskId,
  getVideoTaskStatus as getVideoStatus,
  getVideoUrl
} from './videoApiCore.js'

/**
 * Video generation composable | 视频生成组合式函数
 * Simplified for open source - fixed input/output format with polling
 */
export const useVideoGeneration = () => {
  const { loading, error, status, reset, setLoading, setError, setSuccess } = useApiState()

  const video = ref(null)
  const taskId = ref(null)
  const progress = reactive({
    attempt: 0,
    maxAttempts: 120,
    percentage: 0
  })
  let activeVideoAbortController = null
  const cancelRequested = ref(false)

  /**
   * Generate video with fixed params | 固定参数生成视频
   * @param {Object} params - { model, prompt, first_frame_image, last_frame_image, ratio, duration }
   */
  const generate = async (params) => {
    if (loading.value) {
      throw new Error('已有视频任务正在执行')
    }

    cancelRequested.value = false
    setLoading(true)
    video.value = null
    taskId.value = null
    progress.attempt = 0
    progress.percentage = 0
    activeVideoAbortController = new AbortController()

    try {
      const modelConfig = getModelByName(params.model)

      const requestData = buildVideoRequestData(params)

      // Call API | 调用 API
      const endpoint = '/videos'
      const task = await createVideoTask(requestData, {
        requestType: 'json',
        endpoint: endpoint,
        signal: activeVideoAbortController.signal
      })

      // Check if async (need polling) | 检查是否异步
      const isAsync = modelConfig?.async !== false

      // If has video URL directly, return | 如果直接有视频 URL，返回
      const createStatus = getVideoStatus(task)
      const createVideoUrl = getVideoUrl(task)

      if (!isAsync || (createVideoUrl && (!createStatus || DONE_VIDEO_STATUSES.has(createStatus)))) {
        const videoUrl = createVideoUrl
        video.value = { url: videoUrl, ...task }
        setSuccess()
        return video.value
      }

      // Get task ID for polling | 获取任务 ID 用于轮询
      const id = getVideoTaskId(task)
      if (!id) {
        throw new Error('未获取到任务 ID')
      }

      taskId.value = id
      status.value = 'polling'

      // Poll for result | 轮询获取结果
      const maxAttempts = 120
      const interval = 5000

      for (let i = 0; i < maxAttempts; i++) {
        progress.attempt = i + 1
        progress.percentage = Math.min(Math.round((i / maxAttempts) * 100), 99)
        if (cancelRequested.value) {
          throw new Error('视频生成已取消')
        }

        let result
        try {
          // Pass silentErrorToast option to request
          result = await getVideoTaskStatus(id, {
            silentErrorToast: true,
            signal: activeVideoAbortController.signal
          })
        } catch (pollErr) {
          if (cancelRequested.value || isAbortError(pollErr)) {
            throw new Error('视频生成已取消')
          }

          const statusCode = Number(pollErr?.response?.status || pollErr?.status || 0)
          // 408, 429, 5xx are transient. 0/undefined (network error) also transient.
          const isTransient = TRANSIENT_VIDEO_ERROR_STATUSES.has(statusCode) || !statusCode
          if (!isTransient) throw pollErr

          // Wait before retry
          await waitForAbortableDelay(interval, activeVideoAbortController.signal)
          continue
        }

        const resultStatus = getVideoStatus(result)
        const resultVideoUrl = getVideoUrl(result)

        // Check for completion | 检查是否完成
        if (resultVideoUrl) {
          progress.percentage = 100
          video.value = { url: resultVideoUrl, ...result }
          setSuccess()
          return video.value
        }

        if (DONE_VIDEO_STATUSES.has(resultStatus) && resultVideoUrl) {
          // Double check logic above covers this, but for clarity:
          progress.percentage = 100
          video.value = { url: resultVideoUrl, ...result }
          setSuccess()
          return video.value
        }

        // Check for failure | 检查是否失败
        if (['failed', 'error', 'cancelled', 'canceled'].includes(resultStatus)) {
          throw new Error(result.error?.message || result.message || '视频生成失败')
        }

        // Wait before next poll | 等待下次轮询
        await waitForAbortableDelay(interval, activeVideoAbortController.signal)
      }

      throw new Error('视频生成超时')
    } catch (err) {
      if (cancelRequested.value || isAbortError(err)) {
        loading.value = false
        status.value = 'idle'
        throw new Error('视频生成已取消')
      }
      setError(err)
      throw err
    } finally {
      activeVideoAbortController = null
      cancelRequested.value = false
    }
  }

  const stop = () => {
    if (!loading.value && status.value !== 'polling') return
    cancelRequested.value = true
    if (activeVideoAbortController) {
      activeVideoAbortController.abort()
      activeVideoAbortController = null
    }
    loading.value = false
    status.value = 'idle'
  }

  onUnmounted(() => stop())

  return { loading, error, status, video, taskId, progress, generate, stop, reset }
}
