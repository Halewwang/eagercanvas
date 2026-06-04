import { ref } from 'vue'
import { generateImage, getImageGenerationTask, removeBackground } from '@/api'
import { getModelByName } from '@/config/models'
import { useApiState } from './useApiState.js'
import {
  IMAGE_REQUEST_TIMEOUT_MS,
  getImageTaskId,
  getImageTaskStatus,
  isPendingImageTaskStatus,
  normalizeGeneratedImages,
  normalizeResolution,
  ratioFromSize,
  resolutionFromSize
} from './imageApiCore.js'

/**
 * Image generation composable | 图片生成组合式函数
 * Simplified for open source - fixed input/output format
 */
export const useImageGeneration = () => {
  const { loading, error, status, reset, setLoading, setError, setSuccess } = useApiState()

  const images = ref([])
  const currentImage = ref(null)

  const pollImageTask = async (id, timeoutMs = IMAGE_REQUEST_TIMEOUT_MS) => {
    status.value = 'polling'
    const startedAt = Date.now()
    const interval = 5000
    const pollRequestTimeout = 60000
    const doneStatuses = new Set(['completed', 'complete', 'succeeded', 'success', 'done', 'finished', 'succeed'])
    const transientErrorStatuses = new Set([408, 425, 429, 500, 502, 503, 504])

    while (Date.now() - startedAt < timeoutMs) {
      let result
      try {
        result = await getImageGenerationTask(id, {
          timeout: Math.min(pollRequestTimeout, timeoutMs),
          silentErrorToast: true,
          silentNetworkErrorToast: true
        })
      } catch (pollErr) {
        const statusCode = Number(pollErr?.response?.status || pollErr?.status || 0)
        const isTimeout = pollErr?.code === 'ECONNABORTED' || /timeout/i.test(String(pollErr?.message || ''))
        const isTransient = isTimeout || transientErrorStatuses.has(statusCode) || !statusCode
        if (!isTransient) throw pollErr

        await new Promise(resolve => setTimeout(resolve, interval))
        continue
      }

      const generatedImages = normalizeGeneratedImages(result)
      if (generatedImages.length > 0) return generatedImages

      const resultStatus = getImageTaskStatus(result)
      if (['failed', 'error', 'cancelled', 'canceled'].includes(resultStatus)) {
        throw new Error(result?.error?.message || result?.message || '图片生成失败')
      }
      if (doneStatuses.has(resultStatus)) {
        throw new Error('No image output')
      }

      await new Promise(resolve => setTimeout(resolve, interval))
    }

    throw new Error('图片生成仍在处理中，请稍后重试。')
  }

  /**
   * Generate image with fixed params | 固定参数生成图片
   * @param {Object} params - { model, prompt, size, n, image (optional ref image) }
   */
  const generate = async (params) => {
    setLoading(true)
    images.value = []
    currentImage.value = null

    try {
      const modelConfig = getModelByName(params.model)

      // Build request data | 构建请求数据
      const requestData = {
        model: params.model,
        model_name: params.model,
        prompt: params.prompt
      }
      if (params.projectId) requestData.projectId = params.projectId

      requestData.size = params.size || modelConfig?.defaultParams?.size || '1024x1024'
      requestData.quality = params.quality || modelConfig?.defaultParams?.quality || 'standard'

      const aspectRatio = String(params.aspect_ratio || params.ratio || ratioFromSize(requestData.size) || '1:1')
      const resolution =
        normalizeResolution(params.resolution) ||
        normalizeResolution(params.quality) ||
        resolutionFromSize(requestData.size, aspectRatio)

      requestData.aspect_ratio = aspectRatio
      requestData.resolution = resolution || '1k'
      requestData.enable_sync_mode = params.enable_sync_mode ?? true
      requestData.enable_base64_output = params.enable_base64_output ?? false
      if (params.tools && typeof params.tools === 'object' && !Array.isArray(params.tools)) {
        requestData.tools = params.tools
      }
      if (params.tool) requestData.tool = params.tool
      for (const key of ['background', 'output_format', 'output_compression', 'moderation']) {
        if (params[key] !== undefined && params[key] !== null && String(params[key]).trim() !== '') {
          requestData[key] = params[key]
        }
      }
      if (params.image_url) requestData.image_url = params.image_url
      for (const key of ['horizontal_angle', 'vertical_angle', 'zoom']) {
        if (params[key] !== undefined && params[key] !== null) {
          requestData[key] = params[key]
        }
      }

      // Add reference image if provided | 添加参考图
      if (params.image) {
        if (Array.isArray(params.image)) {
          requestData.image = params.image[0]
          requestData.images = params.image
        } else {
          requestData.image = params.image
        }
      }

      // Call API | 调用 API
      const response = await generateImage(requestData, {
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
          generatedImages = await pollImageTask(id, Number(modelConfig?.requestTimeoutMs || IMAGE_REQUEST_TIMEOUT_MS))
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

  return { loading, error, status, images, currentImage, generate, reset }
}

export const useImageTools = () => {
  const { loading, error, status, reset, setLoading, setError, setSuccess } = useApiState()

  const removeBg = async (params = {}) => {
    setLoading(true)

    try {
      const response = await removeBackground({
        image: params.image,
        size: params.size || 'full',
        format: params.format || 'png',
        channels: params.channels || 'rgba',
        crop: params.crop ?? false,
        despill: params.despill ?? false,
        bg_color: params.bgColor || ''
      })

      const data = response?.data || response
      const url =
        data?.url ||
        data?.data?.[0]?.url ||
        data?.data?.url ||
        ''

      if (!url) {
        throw new Error('No image output')
      }

      setSuccess()
      return { url, raw: data }
    } catch (err) {
      setError(err)
      throw err
    }
  }

  return { loading, error, status, removeBg, reset }
}
