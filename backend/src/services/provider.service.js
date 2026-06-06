import { HttpError } from '../utils/http.js'
import { callProvider, callProviderStream } from './providers/http-client.js'
import { resolveImageGenerationRequest } from './providers/image-request.js'
import { getProviderAdapter } from './providers/index.js'
import {
  isKlingTaskId,
  isKlingVideoModel,
  isTopazVideoEnhancePayload
} from './providers/dashboard302.adapter.js'
import { normalizeImageResponse } from './providers/image-response.js'
import { isOpenAiVideoModel, isOpenAiVideoTaskId } from './providers/openai.adapter.js'
import { isSeedanceModel } from './providers/seedance.adapter.js'
import { queueProviderIssue } from './issue-events.service.js'

const getPayloadModel = (payload = {}) =>
  String(payload.model || payload.model_name || payload.payload?.model || payload.payload?.model_name || '').trim()

const observeProviderFailure = (error, context = {}) => {
  queueProviderIssue(error, {
    provider: context.provider || context.requestOptions?.provider || context.requestOptions?.apiName || '',
    model: context.model || getPayloadModel(context.payload),
    payload: context.payload,
    upstreamEndpoint: context.upstreamEndpoint,
    operation: context.operation
  }).catch(() => {})
}

const withProviderObservation = async (context, fn) => {
  try {
    return await fn()
  } catch (error) {
    observeProviderFailure(error, context)
    throw error
  }
}

export const providerChatCompletions = (payload, requestOptions = {}) =>
  withProviderObservation({
    operation: 'chat_completions',
    payload,
    requestOptions,
    upstreamEndpoint: '/v1/chat/completions'
  }, () => callProvider('/v1/chat/completions', payload, 'POST', requestOptions))

export const providerChatCompletionsStream = (payload = {}, requestOptions = {}) =>
  withProviderObservation({
    operation: 'chat_completions_stream',
    payload,
    requestOptions,
    upstreamEndpoint: '/v1/chat/completions'
  }, () => callProviderStream('/v1/chat/completions', {
    ...payload,
    stream: true,
    stream_options: {
      include_usage: true,
      ...(payload.stream_options || {})
    }
  }, 'POST', requestOptions))

export const providerGenerateImage = async (payload = {}, requestOptions = {}) => {
  return withProviderObservation({
    operation: 'image_generation',
    payload,
    requestOptions,
    upstreamEndpoint: 'image_generation'
  }, async () => {
    const request = resolveImageGenerationRequest(payload)
    if (request.kind === 'adapter') {
      return getProviderAdapter(request.adapter).imageGeneration(request.payload, requestOptions)
    }

    const raw = await callProvider(request.path, request.payload, request.method, requestOptions)
    const normalized = normalizeImageResponse(raw)
    if (!Array.isArray(normalized.data) || normalized.data.length === 0) {
      throw new HttpError(502, 'No image output from provider', 'NO_IMAGE_OUTPUT')
    }
    return normalized
  })
}

export const providerImageStatus = async (taskId, requestOptions = {}) => {
  return withProviderObservation({
    operation: 'image_status',
    payload: { task_id: taskId, model: requestOptions?.model },
    requestOptions,
    upstreamEndpoint: 'image_status'
  }, async () => {
    const safeTaskId = String(taskId || '').trim()
    if (!safeTaskId) {
      throw new HttpError(400, 'Image task id is required', 'IMAGE_TASK_ID_REQUIRED')
    }

    if (String(requestOptions?.model || '').trim().toLowerCase() === 'gpt-image-2') {
      return getProviderAdapter('openai').pollTaskStatus(safeTaskId, requestOptions)
    }

    return getProviderAdapter('dashboard302').pollTaskStatus(safeTaskId, requestOptions)
  })
}

export const providerRemoveBackground = async (payload = {}, requestOptions = {}) => {
  return withProviderObservation({
    operation: 'remove_background',
    payload,
    requestOptions,
    provider: 'photoroom',
    upstreamEndpoint: 'remove_background'
  }, () => getProviderAdapter('photoroom').removeBackground(payload, requestOptions))
}

export const providerCreateVideo = async (payload = {}, requestOptions = {}) => {
  return withProviderObservation({
    operation: 'video_generation',
    payload,
    requestOptions,
    upstreamEndpoint: 'video_generation'
  }, async () => {
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
  })
}

export const providerVideoStatus = async (taskId, requestOptions = {}) => {
  return withProviderObservation({
    operation: 'video_status',
    payload: { task_id: taskId, model: requestOptions?.model },
    requestOptions,
    upstreamEndpoint: 'video_status'
  }, async () => {
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
  })
}
