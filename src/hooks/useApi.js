/**
 * API Hooks | API Hooks
 * Simplified hooks for open source version | 开源版简化 hooks
 */

import { useApiConfig } from './useApiConfig'
import { useChat } from './api/useChatApi.js'
import { useImageGeneration, useImageTools } from './api/useImageApi.js'
import { useVideoGeneration } from './api/useVideoApi.js'

export { useApiState } from './api/useApiState.js'
export { useChat } from './api/useChatApi.js'
export { useImageGeneration, useImageTools } from './api/useImageApi.js'
export { useVideoGeneration } from './api/useVideoApi.js'

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
