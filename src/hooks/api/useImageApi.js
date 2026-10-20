import { getCurrentScope, onScopeDispose, ref } from 'vue'
import { generateImage, getImageGenerationTask } from '@/api'
import { getModelByName, resolveImageModelKey } from '@/config/models'
import { getGptImageGenerationSettings } from '@/utils/gptImageParameters'
import { useApiState } from './useApiState.js'
import {
  IMAGE_REQUEST_TIMEOUT_MS,
  getImageTaskId,
  getImageTaskStatus,
  isPendingImageTaskStatus,
  normalizeGeneratedImages
} from './imageApiCore.js'

/**
 * Image generation composable | 图片生成组合式函数
 */
const abortError = () => Object.assign(new Error('Image task polling paused'), { name: 'AbortError' })
const waitForPoll = (signal) => new Promise((resolve, reject) => {
  const finish = () => { signal?.removeEventListener('abort', cancel); resolve() }
  const timer = setTimeout(finish, 5000)
  const cancel = () => { clearTimeout(timer); reject(abortError()) }
  if (signal?.aborted) cancel()
  else signal?.addEventListener('abort', cancel, { once: true })
})

export const useImageGeneration = () => {
  const scopeController = new AbortController()
  if (getCurrentScope()) onScopeDispose(() => scopeController.abort())
  const { loading, error, status, reset, setLoading, setError, setSuccess } = useApiState()

  const images = ref([])
  const currentImage = ref(null)

  const pollImageTask = async (id, timeoutMs = IMAGE_REQUEST_TIMEOUT_MS, signal) => {
    status.value = 'polling'
    const startedAt = Date.now()
    const pollRequestTimeout = 60000
    const doneStatuses = new Set(['completed', 'complete', 'succeeded', 'success', 'done', 'finished', 'succeed'])
    const transientErrorStatuses = new Set([408, 425, 429, 500, 502, 503, 504])

    while (Date.now() - startedAt < timeoutMs) {
      if (signal?.aborted) throw abortError()
      let result
      try {
        result = await getImageGenerationTask(id, {
          timeout: Math.min(pollRequestTimeout, timeoutMs),
          signal,
          silentErrorToast: true,
          silentNetworkErrorToast: true
        })
      } catch (pollErr) {
        if (signal?.aborted) throw abortError()
        const statusCode = Number(pollErr?.response?.status || pollErr?.status || 0)
        const isTimeout = pollErr?.code === 'ECONNABORTED' || /timeout/i.test(String(pollErr?.message || ''))
        const isTransient = isTimeout || transientErrorStatuses.has(statusCode) || !statusCode
        if (!isTransient) {
          throw pollErr
        }

        await waitForPoll(signal)
        continue
      }

      const generatedImages = normalizeGeneratedImages(result)
      if (generatedImages.length > 0) return generatedImages

      const resultStatus = getImageTaskStatus(result)
      if (['failed', 'error', 'cancelled', 'canceled'].includes(resultStatus)) {
        throw Object.assign(new Error(result?.error?.message || result?.message || '图片生成失败'), { imageTaskTerminal: true })
      }
      if (doneStatuses.has(resultStatus)) {
        throw new Error('No image output')
      }

      await waitForPoll(signal)
    }

    throw new Error('图片生成仍在处理中，请稍后重试。')
  }

  /**
   * Generate image with fixed params | 固定参数生成图片
   * @param {Object} params - { model, prompt, size, n, image (optional ref image) }
   */
  const generate = async (params, { onSubmitted, signal = scopeController.signal } = {}) => {
    setLoading(true)
    images.value = []
    currentImage.value = null

    try {
      const model = resolveImageModelKey(params.model)
      const modelConfig = getModelByName(model)

      // Build request data | 构建请求数据
      const requestData = {
        model,
        model_name: model,
        prompt: params.prompt
      }
      if (params.projectId) requestData.projectId = params.projectId

      const settings = getGptImageGenerationSettings({
        generationRatio: params.generationRatio ?? params.aspect_ratio ?? params.ratio ?? params.size,
        generationResolution: params.generationResolution ?? params.resolution
      })
      requestData.size = settings.ratio
      requestData.resolution = settings.resolution
      requestData.n = 1
      if (params.tool) requestData.tool = params.tool
      if (params.image_url) requestData.image_url = params.image_url
      if (params.sourceNodeId) requestData.sourceNodeId = params.sourceNodeId
      for (const key of ['horizontal_angle', 'vertical_angle', 'zoom']) {
        if (params[key] !== undefined && params[key] !== null) {
          requestData[key] = params[key]
        }
      }

      // Add reference image if provided | 添加参考图
      if (params.image) {
        if (Array.isArray(params.image)) {
          const references = params.image.filter((value) => typeof value === 'string' && value.trim())
          if (modelConfig.maxReferenceImages && references.length > modelConfig.maxReferenceImages) {
            throw new Error(`最多支持 ${modelConfig.maxReferenceImages} 张参考图，请移除多余图片后重试。`)
          }
          if (references.length) {
            requestData.image = references[0]
            requestData.images = references
          }
        } else {
          requestData.image = params.image
        }
      }

      // Call API | 调用 API
      const response = await generateImage(requestData, {
        signal,
        requestType: 'json',
        endpoint: modelConfig?.endpoint || '/images/generations',
        timeout: Number(modelConfig?.requestTimeoutMs || IMAGE_REQUEST_TIMEOUT_MS)
      })

      // Parse response (OpenAI format) | 解析响应
      let generatedImages = normalizeGeneratedImages(response)
      if (generatedImages.length === 0) {
        const taskStatus = getImageTaskStatus(response)
        const id = getImageTaskId(response)
        if (id && isPendingImageTaskStatus(taskStatus)) {
          await onSubmitted?.(id)
          generatedImages = await pollImageTask(id, Number(modelConfig?.requestTimeoutMs || IMAGE_REQUEST_TIMEOUT_MS), signal)
        }
      }

      if (generatedImages.length === 0) {
        throw new Error('No image output')
      }

      images.value = generatedImages
      currentImage.value = generatedImages[0] || null
      setSuccess()
      return generatedImages
    } catch (err) {
      setError(err)
      throw err
    }
  }

  const resume = async (taskId, { signal = scopeController.signal } = {}) => {
    setLoading(true)
    try {
      const output = await pollImageTask(taskId, 1800000, signal)
      images.value = output
      currentImage.value = output[0] || null
      setSuccess()
      return output
    } catch (err) {
      setError(err)
      throw err
    }
  }

  return { loading, error, status, images, currentImage, generate, resume, reset }
}
