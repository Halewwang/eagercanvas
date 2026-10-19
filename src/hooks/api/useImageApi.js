import { ref } from 'vue'
import { generateImage, getImageGenerationTask } from '@/api'
import { getModelByName, resolveImageModelKey } from '@/config/models'
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
      const model = resolveImageModelKey(params.model)
      const modelConfig = getModelByName(model)

      // Build request data | 构建请求数据
      const requestData = {
        model,
        model_name: model,
        prompt: params.prompt
      }
      if (params.projectId) requestData.projectId = params.projectId

      if (modelConfig.sizes?.length) {
        requestData.size = modelConfig.sizes.includes(params.size)
          ? params.size
          : modelConfig.defaultParams?.size || modelConfig.sizes[0]
      }
      for (const [key, options] of [
        ['quality', modelConfig.qualities],
        ['background', modelConfig.backgrounds],
        ['output_format', modelConfig.outputFormats]
      ]) {
        if (!options?.length || (key === 'output_format' && options.length < 2)) continue
        requestData[key] = options.some((item) => item.key === params[key])
          ? params[key]
          : modelConfig.defaultParams?.[key] || options[0].key
      }
      if (modelConfig.ratios?.length) {
        const ratio = params.aspect_ratio || params.ratio || ratioFromSize(requestData.size)
        if (modelConfig.ratios.includes(ratio)) requestData.aspect_ratio = ratio
      }
      if (modelConfig.resolutions?.length) {
        const resolution = normalizeResolution(params.resolution) || resolutionFromSize(requestData.size, requestData.aspect_ratio)
        if (modelConfig.resolutions.some((item) => item.key === resolution)) requestData.resolution = resolution
      }
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
