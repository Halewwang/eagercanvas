import { HttpError } from '../utils/http.js'
import { resolveImageGenerationRequest } from './providers/image-request.js'
import { getProviderAdapter } from './providers/index.js'
import {
  isKlingTaskId,
  isKlingVideoModel,
  isTopazVideoEnhancePayload
} from './providers/dashboard302.adapter.js'
import { createEnbrandChatCompletion, createEnbrandChatCompletionStream } from './providers/enbrand.adapter.js'
import { createApimartImage, getApimartImageTask } from './providers/apimart.adapter.js'
import { isOpenAiVideoModel, isOpenAiVideoTaskId } from './providers/openai.adapter.js'
import { isSeedanceModel } from './providers/seedance.adapter.js'

export const providerChatCompletions = async (payload, requestOptions = {}) =>
  createEnbrandChatCompletion(payload, requestOptions)

export const providerChatCompletionsStream = async (payload = {}, requestOptions = {}) =>
  createEnbrandChatCompletionStream(payload, requestOptions)

export const providerGenerateImage = async (payload = {}, requestOptions = {}) => {
  const request = resolveImageGenerationRequest(payload)
  return createApimartImage(request.payload, requestOptions)
}

export const providerImageStatus = (taskId, requestOptions = {}) =>
  getApimartImageTask(taskId, requestOptions)

export const providerRemoveBackground = async () => {
  throw new HttpError(410, 'The legacy background removal provider has been removed', 'BACKGROUND_REMOVAL_UNSUPPORTED')
}

export const providerCreateVideo = async (payload = {}, requestOptions = {}) => {
  if (isTopazVideoEnhancePayload(payload)) {
    return getProviderAdapter('dashboard302').videoGeneration(payload, requestOptions)
  }

  const model = String(payload.model_name || payload.model || '').trim()
  if (isSeedanceModel(model)) {
    return getProviderAdapter('seedance').videoGeneration(payload, requestOptions)
  }
  if (isOpenAiVideoModel(model)) {
    return getProviderAdapter('openai').videoGeneration(payload, requestOptions)
  }
  if (isKlingVideoModel(model)) {
    return getProviderAdapter('dashboard302').videoGeneration(payload, requestOptions)
  }

  return getProviderAdapter('dashboard302-video').videoGeneration(payload, requestOptions)
}

export const providerVideoStatus = async (taskId, requestOptions = {}) => {
  const safeTaskId = String(taskId || '')
  const mayBeSeedance = safeTaskId.startsWith('cgt-')
  const mayBeKling = isKlingTaskId(safeTaskId)
  const mayBeSora = isOpenAiVideoTaskId(safeTaskId)
  const mayBeWaveSpeed = /^[0-9a-f]{32}$/i.test(safeTaskId)

  if (!mayBeSeedance) {
    try {
      return await getProviderAdapter('dashboard302').pollTaskStatus(taskId, {
        ...requestOptions,
        statusProvider: 'topaz'
      })
    } catch {
      // Fall through
    }
  }

  if (mayBeSeedance) {
    try {
      return await getProviderAdapter('seedance').pollTaskStatus(taskId, requestOptions)
    } catch {
      // Fall through
    }
  }

  if (mayBeSora) {
    try {
      return await getProviderAdapter('openai').pollTaskStatus(taskId, requestOptions)
    } catch {
      // Fall through
    }
  }

  if (mayBeKling) {
    try {
      return await getProviderAdapter('dashboard302').pollTaskStatus(taskId, requestOptions)
    } catch {
      // Fall through
    }
  }

  if (mayBeWaveSpeed) {
    try {
      return await getProviderAdapter('dashboard302-video').pollTaskStatus(taskId, requestOptions)
    } catch {
      // Fall through
    }
  }

  // Try Veo / Generic Video Generation API
  try {
    return await getProviderAdapter('dashboard302-video').pollTaskStatus(taskId, requestOptions)
  } catch (error) {
    throw new HttpError(502, 'Failed to get video status', 'PROVIDER_ERROR')
  }
}
