/**
 * API Hooks | API Hooks
 * Simplified hooks for open source version | 开源版简化 hooks
 */

import { ref, reactive, onUnmounted } from 'vue'
import {
  generateImage,
  removeBackground,
  create3DTask,
  get3DTaskStatus,
  createVideoTask,
  getVideoTaskStatus,
  streamChatCompletions
} from '@/api'
import { DEFAULT_CHAT_MODEL, getModelByName, resolve3DModelKey } from '@/config/models'
import { useApiConfig } from './useApiConfig'

const IMAGE_REQUEST_TIMEOUT_MS = 180000

/**
 * Base API state hook | 基础 API 状态 Hook
 */
export const useApiState = () => {
  const loading = ref(false)
  const error = ref(null)
  const status = ref('idle')

  const reset = () => {
    loading.value = false
    error.value = null
    status.value = 'idle'
  }

  const setLoading = (isLoading) => {
    loading.value = isLoading
    status.value = isLoading ? 'running' : status.value
  }

  const setError = (err) => {
    error.value = err
    status.value = 'error'
    loading.value = false
  }

  const setSuccess = () => {
    status.value = 'success'
    loading.value = false
    error.value = null
  }

  return { loading, error, status, reset, setLoading, setError, setSuccess }
}

const IMAGE_BASE_SIZE_BY_RATIO = {
  '1:1': { w: 1024, h: 1024 },
  '3:2': { w: 1152, h: 768 },
  '2:3': { w: 768, h: 1152 },
  '4:3': { w: 1152, h: 864 },
  '3:4': { w: 864, h: 1152 },
  '4:5': { w: 896, h: 1120 },
  '5:4': { w: 1120, h: 896 },
  '16:9': { w: 1280, h: 720 },
  '9:16': { w: 720, h: 1280 },
  '21:9': { w: 1680, h: 720 }
}

const ratioFromSize = (size) => {
  const [w, h] = String(size || '').split('x').map(Number)
  if (!w || !h) return '1:1'
  const ratio = w / h
  if (Math.abs(ratio - 1) < 0.02) return '1:1'
  if (Math.abs(ratio - 3 / 2) < 0.03) return '3:2'
  if (Math.abs(ratio - 2 / 3) < 0.03) return '2:3'
  if (Math.abs(ratio - 16 / 9) < 0.03) return '16:9'
  if (Math.abs(ratio - 9 / 16) < 0.03) return '9:16'
  if (Math.abs(ratio - 4 / 3) < 0.03) return '4:3'
  if (Math.abs(ratio - 3 / 4) < 0.03) return '3:4'
  if (Math.abs(ratio - 4 / 5) < 0.03) return '4:5'
  if (Math.abs(ratio - 5 / 4) < 0.03) return '5:4'
  if (Math.abs(ratio - 21 / 9) < 0.03) return '21:9'
  return '1:1'
}

const normalizeResolution = (value) => {
  const safe = String(value || '').trim().toLowerCase()
  if (safe === '1k' || safe === '2k' || safe === '4k') return safe
  return ''
}

const resolutionFromSize = (size, ratioKey = '') => {
  const [w, h] = String(size || '').split('x').map(Number)
  if (!w || !h) return '1k'
  const ratio = ratioKey || ratioFromSize(size)
  const base = IMAGE_BASE_SIZE_BY_RATIO[ratio] || IMAGE_BASE_SIZE_BY_RATIO['1:1']
  const scale = Math.max(w / base.w, h / base.h)
  if (scale >= 3.5) return '4k'
  if (scale >= 1.8) return '2k'
  return '1k'
}

/**
 * Chat composable | 问答组合式函数
 */
export const useChat = (options = {}) => {
  const { loading, error, status, reset, setLoading, setError, setSuccess } = useApiState()

  const messages = ref([])
  const currentResponse = ref('')
  let abortController = null

  const send = async (content, stream = true) => {
    setLoading(true)
    currentResponse.value = ''

    try {
      const msgList = [
        ...(options.systemPrompt ? [{ role: 'system', content: options.systemPrompt }] : []),
        ...messages.value,
        { role: 'user', content }
      ]

      if (stream) {
        status.value = 'streaming'
        abortController = new AbortController()
        let fullResponse = ''

        const resolvedModel = typeof options.model === 'function' ? options.model() : options.model
        for await (const chunk of streamChatCompletions(
          { model: resolvedModel || DEFAULT_CHAT_MODEL, messages: msgList },
          abortController.signal
        )) {
          fullResponse += chunk
          currentResponse.value = fullResponse
        }

        messages.value.push({ role: 'user', content })
        messages.value.push({ role: 'assistant', content: fullResponse })
        setSuccess()
        return fullResponse
      }
    } catch (err) {
      if (err.name !== 'AbortError') {
        setError(err)
        throw err
      }
    }
  }

  const stop = () => {
    if (abortController) {
      abortController.abort()
      abortController = null
    }
  }

  const clear = () => {
    messages.value = []
    currentResponse.value = ''
    reset()
  }

  onUnmounted(() => stop())

  return { loading, error, status, messages, currentResponse, send, stop, clear, reset }
}

/**
 * Image generation composable | 图片生成组合式函数
 * Simplified for open source - fixed input/output format
 */
export const useImageGeneration = () => {
  const { loading, error, status, reset, setLoading, setError, setSuccess } = useApiState()

  const images = ref([])
  const currentImage = ref(null)

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
        timeout: IMAGE_REQUEST_TIMEOUT_MS
      })

      // Parse response (OpenAI format) | 解析响应
      const data = response.data || response
      const generatedImages = (Array.isArray(data) ? data : [data]).map(item => ({
        url: item.url || item.b64_json || item,
        revisedPrompt: item.revised_prompt || ''
      }))

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

export const useModel3DGeneration = () => {
  const { loading, error, status, reset, setLoading, setError, setSuccess } = useApiState()

  const model = ref(null)
  const taskId = ref('')
  const progress = reactive({
    attempt: 0,
    maxAttempts: 120,
    percentage: 0
  })
  let pollAbortController = null
  const cancelRequested = ref(false)

  const getTaskId = (task) => {
    const candidates = [
      task?.jobId,
      task?.job_id,
      task?.JobId,
      task?.id,
      task?.Response?.JobId,
      task?.Response?.job_id,
      task?.data?.jobId,
      task?.data?.JobId
    ]
    const found = candidates.find((value) => value !== undefined && value !== null && String(value).trim() !== '')
    return found ? String(found) : ''
  }

  const getTaskStatus = (result) => String(
    result?.status ||
    result?.Response?.Status ||
    result?.data?.status ||
    result?.data?.Response?.Status ||
    ''
  ).toLowerCase()

  const getAssets = (result) => {
    const candidates = [
      ...(Array.isArray(result?.assets) ? result.assets : []),
      ...(Array.isArray(result?.Response?.ResultFile3Ds) ? result.Response.ResultFile3Ds : []),
      ...(Array.isArray(result?.data?.assets) ? result.data.assets : []),
      ...(Array.isArray(result?.data?.Response?.ResultFile3Ds) ? result.data.Response.ResultFile3Ds : [])
    ]

    const assetUrls = {}
    let previewImageUrl = String(
      result?.previewImageUrl ||
      result?.PreviewImageUrl ||
      result?.Response?.PreviewImageUrl ||
      result?.data?.previewImageUrl ||
      ''
    ).trim()

    candidates.forEach((item) => {
      const type = String(item?.type || item?.Type || '').trim().toLowerCase()
      const url = String(item?.url || item?.Url || '').trim()
      const preview = String(item?.previewImageUrl || item?.PreviewImageUrl || '').trim()
      if (type && url) {
        assetUrls[type] = url
      }
      if (!previewImageUrl && preview) {
        previewImageUrl = preview
      }
    })

    const orderedTypes = ['glb', 'obj', 'fbx', 'stl', 'usdz', 'zip']
    const primaryUrl = orderedTypes
      .map((type) => String(assetUrls[type] || '').trim())
      .find(Boolean) || ''
    const viewerUrl = String(assetUrls.glb || assetUrls.obj || '').trim()

    return {
      previewImageUrl,
      assetUrls,
      primaryUrl,
      viewerUrl
    }
  }

  const doneStatuses = new Set(['completed', 'succeeded', 'success', 'done', 'finished'])

  const generate = async (params) => {
    if (loading.value) {
      throw new Error('已有 3D 任务正在执行')
    }

    cancelRequested.value = false
    setLoading(true)
    model.value = null
    taskId.value = ''
    progress.attempt = 0
    progress.percentage = 0

    try {
      const requestData = {
        model: resolve3DModelKey(params.model),
        prompt: params.prompt || '',
        multiViewImages: Array.isArray(params.multiViewImages) ? params.multiViewImages : [],
        generateType: params.generateType || 'Normal',
        enablePBR: !!params.enablePBR,
        faceCount: params.faceCount ?? '',
        resultFormat: params.resultFormat || '',
        polygonType: params.polygonType || ''
      }

      const task = await create3DTask(requestData)
      const createAssets = getAssets(task)
      const createStatus = getTaskStatus(task)
      if (createAssets.primaryUrl && (!createStatus || doneStatuses.has(createStatus))) {
        model.value = {
          ...createAssets,
          raw: task
        }
        setSuccess()
        return model.value
      }

      const id = getTaskId(task)
      if (!id) {
        throw new Error('未获取到 3D 任务 ID')
      }

      taskId.value = id
      status.value = 'polling'

      const maxAttempts = 120
      const interval = 5000

      for (let i = 0; i < maxAttempts; i += 1) {
        progress.attempt = i + 1
        progress.percentage = Math.min(Math.round((i / maxAttempts) * 100), 99)
        if (cancelRequested.value) throw new Error('3D 生成已取消')

        let result
        try {
          pollAbortController = new AbortController()
          result = await get3DTaskStatus(id, {
            signal: pollAbortController.signal
          })
        } finally {
          pollAbortController = null
        }

        const resultStatus = getTaskStatus(result)
        const resultAssets = getAssets(result)
        if (resultAssets.primaryUrl) {
          progress.percentage = 100
          model.value = {
            ...resultAssets,
            raw: result
          }
          setSuccess()
          return model.value
        }

        if (['failed', 'error', 'cancelled', 'canceled'].includes(resultStatus)) {
          throw new Error(result?.message || result?.Response?.ErrorMsg || '3D 生成失败')
        }

        await new Promise((resolve) => setTimeout(resolve, interval))
      }

      throw new Error('3D 生成超时')
    } catch (err) {
      setError(err)
      throw err
    } finally {
      pollAbortController = null
      cancelRequested.value = false
    }
  }

  const stop = () => {
    cancelRequested.value = true
    if (pollAbortController) {
      pollAbortController.abort()
      pollAbortController = null
    }
    loading.value = false
    status.value = 'idle'
  }

  return { loading, error, status, model, taskId, progress, generate, stop, reset }
}

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
  let pollAbortController = null
  const cancelRequested = ref(false)

  const getTaskId = (task) => {
    const candidates = [
      task?.task_id,
      task?.taskId,
      task?.id,
      task?.task?.task_id,
      task?.raw?.task_id,
      task?.raw?.task?.task_id,
      task?.data?.task_id,
      task?.data?.taskId,
      task?.data?.id,
      task?.data?.data?.task_id,
      task?.data?.data?.id
    ]
    const found = candidates.find((value) => value !== undefined && value !== null && String(value).trim() !== '')
    return found ? String(found) : ''
  }

  const getTaskStatus = (result) => {
    return String(
      result?.status ||
      result?.task?.status ||
      result?.raw?.status ||
      result?.raw?.task?.status ||
      result?.raw?.task?.task_status ||
      result?.task_status ||
      result?.data?.status ||
      result?.data?.task_status ||
      result?.data?.state ||
      ''
    ).toLowerCase()
  }

  const doneStatuses = new Set(['completed', 'succeeded', 'success', 'done', 'finished', 'succeed', 'successed'])
  const transientErrorStatuses = new Set([408, 425, 429, 500, 502, 503, 504])

  const getVideoUrl = (result) => {
    return (
      result?.url ||
      result?.video_url ||
      result?.data?.url ||
      result?.data?.video_url ||
      result?.data?.task_result?.video_url ||
      result?.data?.task_result?.video?.url ||
      result?.data?.task_result?.videos?.[0]?.url ||
      result?.task_result?.video_url ||
      result?.task_result?.video?.url ||
      result?.task_result?.videos?.[0]?.url ||
      result?.raw?.video_url ||
      result?.raw?.task?.task_result?.videos?.[0]?.url ||
      result?.raw?.output?.[0]?.url ||
      result?.detail?.draft_info?.downloadable_url ||
      result?.data?.detail?.draft_info?.downloadable_url ||
      result?.data?.[0]?.url ||
      result?.output?.[0]?.url ||
      ''
    )
  }

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

    try {
      const modelConfig = getModelByName(params.model)
      
      // Build request data | 构建请求数据
      const requestData = {
        model: params.model,
        model_name: params.model,
        prompt: params.prompt || ''
      }
      // Add optional params | 添加可选参数
      if (params.first_frame_image) requestData.first_frame_image = params.first_frame_image
      if (params.last_frame_image) requestData.last_frame_image = params.last_frame_image
      if (params.ratio) {
        requestData.aspect_ratio = params.ratio
      }
      if (params.size) requestData.size = params.size
      const normalizedDuration = Number(params.duration ?? params.dur)
      if (Number.isFinite(normalizedDuration) && normalizedDuration > 0) {
        requestData.duration = normalizedDuration
        requestData.seconds = normalizedDuration
      }
      if (Array.isArray(params.images) && params.images.length > 0) {
        requestData.images = params.images
      }

      // Call API | 调用 API
      const endpoint = '/videos'
      const task = await createVideoTask(requestData, {
        requestType: 'json',
        endpoint: endpoint
      })

      // Check if async (need polling) | 检查是否异步
      const isAsync = modelConfig?.async !== false

      // If has video URL directly, return | 如果直接有视频 URL，返回
      const createStatus = getTaskStatus(task)
      const createVideoUrl = getVideoUrl(task)

      if (!isAsync || (createVideoUrl && (!createStatus || doneStatuses.has(createStatus)))) {
        const videoUrl = createVideoUrl
        video.value = { url: videoUrl, ...task }
        setSuccess()
        return video.value
      }

      // Get task ID for polling | 获取任务 ID 用于轮询
      const id = getTaskId(task)
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
          pollAbortController = new AbortController()
          // Pass silentErrorToast option to request
          result = await getVideoTaskStatus(id, {
            silentErrorToast: true,
            signal: pollAbortController.signal
          })
        } catch (pollErr) {
          if (cancelRequested.value) {
            throw new Error('视频生成已取消')
          }

          const statusCode = Number(pollErr?.response?.status || pollErr?.status || 0)
          // 408, 429, 5xx are transient. 0/undefined (network error) also transient.
          const isTransient = transientErrorStatuses.has(statusCode) || !statusCode
          if (!isTransient) throw pollErr
          
          // Wait before retry
          await new Promise(resolve => setTimeout(resolve, interval))
          continue
        }
        finally {
          pollAbortController = null
        }
        
        const resultStatus = getTaskStatus(result)
        const resultVideoUrl = getVideoUrl(result)

        // Check for completion | 检查是否完成
        if (resultVideoUrl) {
          progress.percentage = 100
          video.value = { url: resultVideoUrl, ...result }
          setSuccess()
          return video.value
        }

        if (doneStatuses.has(resultStatus) && resultVideoUrl) {
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
        await new Promise(resolve => setTimeout(resolve, interval))
      }

      throw new Error('视频生成超时')
    } catch (err) {
      setError(err)
      throw err
    } finally {
      pollAbortController = null
      cancelRequested.value = false
    }
  }

  const stop = () => {
    if (!loading.value && status.value !== 'polling') return
    cancelRequested.value = true
    if (pollAbortController) {
      pollAbortController.abort()
      pollAbortController = null
    }
    loading.value = false
    status.value = 'idle'
  }

  return { loading, error, status, video, taskId, progress, generate, stop, reset }
}

/**
 * Combined API composable | 综合 API 组合式函数
 */
export const useApi = () => {
  const config = useApiConfig()
  const chat = useChat()
  const image = useImageGeneration()
  const imageTools = useImageTools()
  const videoGen = useVideoGeneration()

  return { config, chat, image, imageTools, video: videoGen }
}
