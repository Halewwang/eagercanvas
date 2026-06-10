import { z } from 'zod'
import { waitUntil } from '@vercel/functions'
import { supabase } from '../config/supabase.js'
import { HttpError } from '../utils/http.js'
import {
  providerChatCompletions,
  providerChatCompletionsStream,
  providerCreateVideo,
  providerGenerateImage,
  providerImageStatus,
  providerVideoStatus
} from './provider.service.js'
import { get302RecordByRequestId, normalizeDashboardRecord } from './dashboard302.service.js'
import { resolveActiveUserServiceCredential } from './service-access.service.js'
import { buildRunProviderRequestOptions, resolveRunProviderAccess } from './run-provider-access.js'
import {
  buildImageGenerationAssets,
  buildVideoGenerationAssets,
  extractProviderVideoUrl,
  markImageResultAssetsForClientPersistence,
  persistImageResultAssets,
  persistVideoResultAsset,
  resolveVideoSourceNodeId,
  shouldPersistImageResultAssetsBeforeResponse
} from './run-assets.js'
import {
  assertVideoTaskOwnership,
  bindImageTaskOwnership,
  bindVideoTaskOwnership,
  findVideoRunContextByTask,
  resolveImageTaskContextByTask,
  syncRunStatusFromImageTask,
  syncRunStatusFromVideoTask
} from './run-task-records.js'
import {
  extractProviderRequestId,
  extractUsageSnapshot,
  insertUsageEvent,
  updateUsageEventByRunId
} from './usage-ledger.service.js'
import { findGeneratedMediaRecordByRunId, upsertGeneratedMediaRecord } from './media-library.service.js'
import { formatSseData, readChatCompletionSseStream } from '../utils/chat-sse.js'

export {
  buildImageGenerationAssets,
  buildVideoGenerationAssets,
  markImageResultAssetsForClientPersistence,
  persistDataUrlIfNeeded,
  persistImageResultAssets,
  persistRemoteUrlIfNeeded,
  shouldPersistImageResultAssetsBeforeResponse,
  persistVideoResultAsset
} from './run-assets.js'

const runSchema = z.object({
  type: z.enum(['chat', 'image', 'video']),
  projectId: z.string().uuid().optional().nullable(),
  model: z.string().optional(),
  payload: z.any()
})

const extractProviderTaskId = (result = {}) => {
  const candidates = [
    result?.task_id,
    result?.taskId,
    result?.requestId,
    result?.request_id,
    result?.id,
    result?.raw?.task_id,
    result?.raw?.requestId,
    result?.raw?.request_id,
    result?.raw?.task?.task_id,
    result?.data?.task_id,
    result?.data?.taskId,
    result?.data?.requestId,
    result?.data?.request_id,
    result?.data?.id
  ]
  const found = candidates.find((value) => value !== undefined && value !== null && String(value).trim() !== '')
  return found ? String(found) : ''
}

const LOCAL_IMAGE_RUN_TASK_PREFIX = 'local-image-run:'

const getImageRunModel = (payload = {}) =>
  String(payload.model || payload.payload?.model || payload.payload?.model_name || '').trim()

export const isGptImageLiteImageRun = (payload = {}) =>
  payload?.type === 'image' && getImageRunModel(payload).toLowerCase() === 'gpt-image-lite'

export const buildLocalImageRunTaskId = (runId = '') => {
  const safeRunId = String(runId || '').trim()
  return safeRunId ? `${LOCAL_IMAGE_RUN_TASK_PREFIX}${safeRunId}` : ''
}

export const isLocalImageRunTaskId = (taskId = '') =>
  String(taskId || '').trim().startsWith(LOCAL_IMAGE_RUN_TASK_PREFIX)

export const parseLocalImageRunTaskId = (taskId = '') => {
  const safeTaskId = String(taskId || '').trim()
  return isLocalImageRunTaskId(safeTaskId)
    ? safeTaskId.slice(LOCAL_IMAGE_RUN_TASK_PREFIX.length).trim()
    : ''
}

const isCompletedImageStatus = (status = '') =>
  ['completed', 'success', 'succeed', 'succeeded', 'done', 'finished'].includes(String(status || '').toLowerCase())

const isFailedImageStatus = (status = '') =>
  ['failed', 'error', 'cancelled', 'canceled', 'failure'].includes(String(status || '').toLowerCase())

const enrichUsageWith302Record = async (providerResponse = {}, fallbackUsage = {}) => {
  const requestId = extractProviderRequestId(providerResponse)
  if (!requestId) {
    return {
      requestId: '',
      usage: fallbackUsage
    }
  }

  try {
    const recordRsp = await get302RecordByRequestId(requestId)
    const record = normalizeDashboardRecord(recordRsp?.data ?? recordRsp)
    if (!record) {
      return { requestId, usage: fallbackUsage }
    }
    return {
      requestId,
      usage: {
        inputTokens: record.inputTokens || fallbackUsage.inputTokens || 0,
        outputTokens: record.outputTokens || fallbackUsage.outputTokens || 0,
        costUsd: Number.isFinite(record.costUsd) ? record.costUsd : (fallbackUsage.costUsd || 0),
        rawUsage: record.rawUsage || fallbackUsage.rawUsage || null
      }
    }
  } catch (error) {
    console.warn('[usage] enrich from 302 record failed', error.message || error)
    return {
      requestId,
      usage: fallbackUsage
    }
  }
}

const shouldClientPersistImageResultAssets = (payload = {}, providerResponse = {}) => {
  const model = String(payload.model || payload.payload?.model || payload.payload?.model_name || '').trim().toLowerCase()
  return model === 'gpt-image-lite' && !shouldPersistImageResultAssetsBeforeResponse(providerResponse)
}

const finalizeCompletedRun = async ({
  userId,
  run,
  payload,
  providerResponse,
  providerAccess,
  imageTaskId = '',
  latencyMs = 0
} = {}) => {
  await supabase
    .from('workflow_runs')
    .update({ status: 'completed', finished_at: new Date().toISOString() })
    .eq('id', run.id)

  const baseUsage = extractUsageSnapshot(providerResponse)
  const enrichedUsage = await enrichUsageWith302Record(providerResponse, baseUsage)
  const imageCount = Array.isArray(providerResponse?.data) ? providerResponse.data.length : 0

  await insertUsageEvent({
    userId,
    runId: run.id,
    model: payload.model || payload.payload?.model,
    apiName: providerAccess.apiName,
    providerRequestId: enrichedUsage.requestId,
    serviceCredentialId: providerAccess.serviceCredentialId,
    upstreamTaskId: imageTaskId,
    inputTokens: enrichedUsage.usage.inputTokens || 0,
    outputTokens: enrichedUsage.usage.outputTokens || 0,
    imageCount,
    videoSeconds: payload.type === 'video' ? payload.payload?.seconds || 0 : 0,
    latencyMs,
    costUsd: enrichedUsage.usage.costUsd || 0,
    estimatedCostUsd: baseUsage.costUsd || 0,
    billedCostUsd: enrichedUsage.usage.costUsd || 0,
    billingStatus: enrichedUsage.requestId ? 'billed' : 'estimated',
    rawUsage: enrichedUsage.usage.rawUsage || providerResponse?.raw || null,
    eventType: payload.type
  })

  if (payload.type === 'image') {
    await upsertGeneratedMediaRecord({
      userId,
      runId: run.id,
      projectId: payload.projectId,
      runType: 'image',
      model: payload.model || payload.payload?.model,
      prompt: payload.payload?.prompt,
      status: 'completed',
      sourceNodeId: String(payload.payload?.sourceNodeId || '').trim(),
      assets: buildImageGenerationAssets(providerResponse, String(payload.payload?.sourceNodeId || '').trim())
    })
  }
}

const queueCompletedRunFinalization = (params = {}) => {
  waitUntil(finalizeCompletedRun(params).catch((error) => {
    console.warn('[runs] completed run finalization failed', error?.message || error)
  }))
}

const finalizeImageTaskResult = async ({
  userId,
  runId = '',
  run = null,
  providerAccess = {},
  rawResult = {},
  taskId = '',
  sourceNodeId = ''
} = {}) => {
  const result = await persistImageResultAssets(rawResult)
  await syncRunStatusFromImageTask({ userId, runId, taskResult: result })

  if (!runId) return result

  const status = String(result?.status || '').toLowerCase()
  const hasAssets = Array.isArray(result?.data) && result.data.length > 0
  if (!hasAssets || !['completed', 'success', 'succeed', 'succeeded', 'done', 'finished', ''].includes(status)) {
    return result
  }

  const safeSourceNodeId = String(sourceNodeId || '').trim()
  const baseUsage = extractUsageSnapshot(result)
  const enrichedUsage = await enrichUsageWith302Record(result, baseUsage)
  const usagePatch = {
    input_tokens: enrichedUsage.usage.inputTokens || 0,
    output_tokens: enrichedUsage.usage.outputTokens || 0,
    image_count: result.data.length,
    cost_usd: enrichedUsage.usage.costUsd || 0,
    estimated_cost_usd: baseUsage.costUsd || 0,
    billed_cost_usd: enrichedUsage.usage.costUsd || 0,
    billing_status: enrichedUsage.requestId ? 'billed' : 'estimated',
    provider_request_id: enrichedUsage.requestId || extractProviderTaskId(result) || taskId,
    api_name: providerAccess.apiName || null,
    service_credential_id: providerAccess.serviceCredentialId || null,
    upstream_task_id: extractProviderTaskId(result) || taskId,
    raw_usage: enrichedUsage.usage.rawUsage || result?.raw || null
  }
  const usageEvent = await updateUsageEventByRunId(runId, usagePatch)
  if (!usageEvent) {
    await insertUsageEvent({
      userId,
      runId,
      model: run?.model || '',
      apiName: providerAccess.apiName,
      providerRequestId: usagePatch.provider_request_id,
      serviceCredentialId: providerAccess.serviceCredentialId,
      upstreamTaskId: usagePatch.upstream_task_id,
      inputTokens: enrichedUsage.usage.inputTokens || 0,
      outputTokens: enrichedUsage.usage.outputTokens || 0,
      imageCount: result.data.length,
      latencyMs: 0,
      costUsd: enrichedUsage.usage.costUsd || 0,
      estimatedCostUsd: baseUsage.costUsd || 0,
      billedCostUsd: enrichedUsage.usage.costUsd || 0,
      billingStatus: enrichedUsage.requestId ? 'billed' : 'estimated',
      rawUsage: enrichedUsage.usage.rawUsage || result?.raw || null,
      eventType: 'image'
    })
  }

  await upsertGeneratedMediaRecord({
    userId,
    runId,
    projectId: run?.project_id,
    runType: 'image',
    model: run?.model || '',
    prompt: '',
    status: 'completed',
    sourceNodeId: safeSourceNodeId,
    assets: buildImageGenerationAssets(result, safeSourceNodeId)
  })

  return result
}

const queueImageTaskResultFinalization = (params = {}) => {
  waitUntil(finalizeImageTaskResult(params).catch((error) => {
    console.warn('[runs] image task result finalization failed', error?.message || error)
  }))
}

const finalizeQueuedImageRun = async ({
  userId,
  run,
  payload,
  providerResponse,
  providerAccess,
  imageTaskId = '',
  latencyMs = 0
} = {}) => {
  const baseUsage = extractUsageSnapshot(providerResponse)
  const enrichedUsage = await enrichUsageWith302Record(providerResponse, baseUsage)
  const imageCount = Array.isArray(providerResponse?.data) ? providerResponse.data.length : 0
  const usagePatch = {
    event_type: 'image',
    input_tokens: enrichedUsage.usage.inputTokens || 0,
    output_tokens: enrichedUsage.usage.outputTokens || 0,
    image_count: imageCount,
    cost_usd: enrichedUsage.usage.costUsd || 0,
    estimated_cost_usd: baseUsage.costUsd || 0,
    billed_cost_usd: enrichedUsage.usage.costUsd || 0,
    billing_status: enrichedUsage.requestId ? 'billed' : 'estimated',
    provider_request_id: enrichedUsage.requestId || extractProviderTaskId(providerResponse) || imageTaskId,
    api_name: providerAccess.apiName || null,
    service_credential_id: providerAccess.serviceCredentialId || null,
    upstream_task_id: extractProviderTaskId(providerResponse) || imageTaskId,
    raw_usage: enrichedUsage.usage.rawUsage || providerResponse?.raw || null,
    latency_ms: latencyMs
  }

  const usageEvent = await updateUsageEventByRunId(run.id, usagePatch)
  if (!usageEvent) {
    await insertUsageEvent({
      userId,
      runId: run.id,
      model: getImageRunModel(payload),
      apiName: providerAccess.apiName,
      providerRequestId: usagePatch.provider_request_id,
      serviceCredentialId: providerAccess.serviceCredentialId,
      upstreamTaskId: usagePatch.upstream_task_id,
      inputTokens: enrichedUsage.usage.inputTokens || 0,
      outputTokens: enrichedUsage.usage.outputTokens || 0,
      imageCount,
      latencyMs,
      costUsd: enrichedUsage.usage.costUsd || 0,
      estimatedCostUsd: baseUsage.costUsd || 0,
      billedCostUsd: enrichedUsage.usage.costUsd || 0,
      billingStatus: enrichedUsage.requestId ? 'billed' : 'estimated',
      rawUsage: enrichedUsage.usage.rawUsage || providerResponse?.raw || null,
      eventType: 'image'
    })
  }

  const mediaRecord = await upsertGeneratedMediaRecord({
    userId,
    runId: run.id,
    projectId: payload.projectId,
    runType: 'image',
    model: getImageRunModel(payload),
    prompt: payload.payload?.prompt,
    status: 'completed',
    sourceNodeId: String(payload.payload?.sourceNodeId || '').trim(),
    assets: buildImageGenerationAssets(providerResponse, String(payload.payload?.sourceNodeId || '').trim())
  })

  if (!mediaRecord?.assets?.length) {
    throw new HttpError(500, 'Image output could not be saved', 'IMAGE_OUTPUT_SAVE_FAILED')
  }

  await supabase
    .from('workflow_runs')
    .update({ status: 'completed', finished_at: new Date().toISOString(), error_msg: null })
    .eq('id', run.id)
}

const markQueuedImageRunFailed = async ({
  userId,
  run,
  payload,
  error
} = {}) => {
  const message = error?.message || 'Image generation failed'
  await supabase
    .from('workflow_runs')
    .update({ status: 'failed', finished_at: new Date().toISOString(), error_msg: message })
    .eq('id', run.id)

  await upsertGeneratedMediaRecord({
    userId,
    runId: run.id,
    projectId: payload.projectId,
    runType: 'image',
    model: getImageRunModel(payload),
    prompt: payload.payload?.prompt,
    status: 'failed',
    error: message,
    sourceNodeId: String(payload.payload?.sourceNodeId || '').trim(),
    assets: []
  })
}

const executeQueuedImageRun = async (params = {}) => {
  const {
    providerRequestOptions,
    payload,
    imageTaskId,
    startedAt
  } = params

  try {
    let providerResponse = await providerGenerateImage(payload.payload, providerRequestOptions)
    providerResponse = await persistImageResultAssets(providerResponse, { persistInlineDataUrls: true })
    const imageAssets = buildImageGenerationAssets(providerResponse, String(payload.payload?.sourceNodeId || '').trim())
    if (imageAssets.length === 0) {
      throw new HttpError(502, 'No persistable image output', 'NO_IMAGE_OUTPUT')
    }

    await finalizeQueuedImageRun({
      ...params,
      providerResponse,
      imageTaskId,
      latencyMs: Date.now() - startedAt
    })
  } catch (error) {
    try {
      await markQueuedImageRunFailed({ ...params, error })
    } catch (statusError) {
      console.warn('[runs] queued image run failure record failed', statusError?.message || statusError)
    }
    console.warn('[runs] queued image run failed', error?.message || error)
  }
}

const queueImageLiteRunExecution = (params = {}) => {
  waitUntil(executeQueuedImageRun(params))
}

export const createRun = async (userId, input) => {
  const payload = runSchema.parse(input)
  const providerAccess = await resolveRunProviderAccess(userId, payload)
  const providerRequestOptions = buildRunProviderRequestOptions(providerAccess)

  const startedAt = Date.now()
  const { data: run, error: runInsertError } = await supabase
    .from('workflow_runs')
    .insert({
      user_id: userId,
      project_id: payload.projectId || null,
      type: payload.type,
      status: 'running',
      started_at: new Date().toISOString()
    })
    .select('*')
    .single()

  if (runInsertError) throw new HttpError(500, runInsertError.message, 'RUN_CREATE_FAILED')

  try {
    if (isGptImageLiteImageRun(payload)) {
      const imageTaskId = buildLocalImageRunTaskId(run.id)
      await bindImageTaskOwnership({
        userId,
        runId: run.id,
        taskId: imageTaskId,
        model: getImageRunModel(payload),
        sourceNodeId: String(payload.payload?.sourceNodeId || '').trim()
      })

      await insertUsageEvent({
        userId,
        runId: run.id,
        model: getImageRunModel(payload),
        apiName: providerAccess.apiName,
        providerRequestId: imageTaskId,
        serviceCredentialId: providerAccess.serviceCredentialId,
        upstreamTaskId: imageTaskId,
        imageCount: 0,
        latencyMs: 0,
        costUsd: 0,
        estimatedCostUsd: 0,
        billedCostUsd: 0,
        billingStatus: 'pending',
        rawUsage: null,
        eventType: 'image_task_created'
      })

      queueImageLiteRunExecution({
        userId,
        run,
        payload,
        providerAccess,
        providerRequestOptions,
        imageTaskId,
        startedAt
      })

      return {
        runId: run.id,
        status: 'running',
        result: {
          task_id: imageTaskId,
          status: 'running',
          run_id: run.id,
          provider: 'derouter'
        }
      }
    }

    let providerResponse
    if (payload.type === 'chat') {
      providerResponse = await providerChatCompletions(payload.payload, providerRequestOptions)
    } else if (payload.type === 'image') {
      providerResponse = await providerGenerateImage(payload.payload, providerRequestOptions)
      providerResponse = shouldClientPersistImageResultAssets(payload, providerResponse)
        ? markImageResultAssetsForClientPersistence(providerResponse)
        : await persistImageResultAssets(providerResponse)
    } else {
      providerResponse = await providerCreateVideo(payload.payload, providerRequestOptions)
      providerResponse = await persistVideoResultAsset(providerResponse)
    }

    const latencyMs = Date.now() - startedAt
    const isImageRun = payload.type === 'image'
    const isVideoRun = payload.type === 'video'
    const imageTaskId = isImageRun ? extractProviderTaskId(providerResponse) : ''
    const imageHasAssets = Array.isArray(providerResponse?.data) && providerResponse.data.length > 0

    if (isVideoRun) {
      const providerTaskId = extractProviderTaskId(providerResponse)
      const videoUrl = extractProviderVideoUrl(providerResponse)
      const sourceNodeId = resolveVideoSourceNodeId(payload.payload)

      await bindVideoTaskOwnership({
        userId,
        runId: run.id,
        taskId: providerTaskId,
        sourceNodeId
      })

      if (videoUrl) {
        await supabase
          .from('workflow_runs')
          .update({ status: 'completed', finished_at: new Date().toISOString() })
          .eq('id', run.id)

        const baseUsage = extractUsageSnapshot(providerResponse)
        const enrichedUsage = await enrichUsageWith302Record(providerResponse, baseUsage)
        await insertUsageEvent({
          userId,
          runId: run.id,
          model: payload.model || payload.payload?.model,
          apiName: providerAccess.apiName,
          providerRequestId: enrichedUsage.requestId || providerTaskId,
          serviceCredentialId: providerAccess.serviceCredentialId,
          upstreamTaskId: providerTaskId,
          inputTokens: enrichedUsage.usage.inputTokens || 0,
          outputTokens: enrichedUsage.usage.outputTokens || 0,
          videoSeconds: payload.payload?.seconds || payload.payload?.duration || 0,
          latencyMs,
          costUsd: enrichedUsage.usage.costUsd || 0,
          estimatedCostUsd: baseUsage.costUsd || 0,
          billedCostUsd: enrichedUsage.usage.costUsd || 0,
          billingStatus: enrichedUsage.requestId ? 'billed' : (providerTaskId ? 'pending' : 'estimated'),
          rawUsage: enrichedUsage.usage.rawUsage || providerResponse?.raw || null,
          eventType: payload.type
        })

        await upsertGeneratedMediaRecord({
          userId,
          runId: run.id,
          projectId: payload.projectId,
          runType: 'video',
          model: payload.model || payload.payload?.model,
          prompt: payload.payload?.prompt,
          status: 'completed',
          sourceNodeId,
          assets: buildVideoGenerationAssets(providerResponse, sourceNodeId)
        })

        return {
          runId: run.id,
          status: 'completed',
          result: {
            ...providerResponse,
            run_id: run.id
          }
        }
      }

      // Asynchronous video tasks should remain running until provider status endpoint reports completion.
      await supabase
        .from('workflow_runs')
        .update({ status: 'running', finished_at: null, error_msg: null })
        .eq('id', run.id)

      await insertUsageEvent({
        userId,
        runId: run.id,
        model: payload.model || payload.payload?.model,
        apiName: providerAccess.apiName,
        providerRequestId: providerTaskId,
        serviceCredentialId: providerAccess.serviceCredentialId,
        upstreamTaskId: providerTaskId,
        videoSeconds: payload.payload?.seconds || payload.payload?.duration || 0,
        latencyMs,
        costUsd: 0,
        estimatedCostUsd: 0,
        billedCostUsd: 0,
        billingStatus: providerTaskId ? 'pending' : 'estimated',
        rawUsage: providerResponse?.raw || null,
        eventType: 'video_task_created'
      })

      return {
        runId: run.id,
        status: 'running',
        result: {
          ...providerResponse,
          run_id: run.id
        }
      }
    }

    if (isImageRun && !imageHasAssets && imageTaskId) {
      await bindImageTaskOwnership({
        userId,
        runId: run.id,
        taskId: imageTaskId,
        model: payload.model || payload.payload?.model,
        sourceNodeId: String(payload.payload?.sourceNodeId || '').trim()
      })

      await supabase
        .from('workflow_runs')
        .update({ status: 'running', finished_at: null, error_msg: null })
        .eq('id', run.id)

      await insertUsageEvent({
        userId,
        runId: run.id,
        model: payload.model || payload.payload?.model,
        apiName: providerAccess.apiName,
        providerRequestId: imageTaskId,
        serviceCredentialId: providerAccess.serviceCredentialId,
        upstreamTaskId: imageTaskId,
        imageCount: 0,
        latencyMs,
        costUsd: 0,
        estimatedCostUsd: 0,
        billedCostUsd: 0,
        billingStatus: 'pending',
        rawUsage: providerResponse?.raw || null,
        eventType: 'image_task_created'
      })

      return {
        runId: run.id,
        status: 'running',
        result: {
          ...providerResponse,
          run_id: run.id
        }
      }
    }

    if (isImageRun && imageHasAssets) {
      queueCompletedRunFinalization({
        userId,
        run,
        payload,
        providerResponse,
        providerAccess,
        imageTaskId,
        latencyMs
      })

      return {
        runId: run.id,
        status: 'completed',
        result: {
          ...providerResponse,
          run_id: run.id
        }
      }
    }

    await supabase
      .from('workflow_runs')
      .update({ status: 'completed', finished_at: new Date().toISOString() })
      .eq('id', run.id)

    const baseUsage = extractUsageSnapshot(providerResponse)
    const enrichedUsage = await enrichUsageWith302Record(providerResponse, baseUsage)
    const imageCount = Array.isArray(providerResponse?.data) ? providerResponse.data.length : 0

    await insertUsageEvent({
      userId,
      runId: run.id,
      model: payload.model || payload.payload?.model,
      apiName: providerAccess.apiName,
      providerRequestId: enrichedUsage.requestId,
      serviceCredentialId: providerAccess.serviceCredentialId,
      upstreamTaskId: imageTaskId,
      inputTokens: enrichedUsage.usage.inputTokens || 0,
      outputTokens: enrichedUsage.usage.outputTokens || 0,
      imageCount,
      videoSeconds: payload.type === 'video' ? payload.payload?.seconds || 0 : 0,
      latencyMs,
      costUsd: enrichedUsage.usage.costUsd || 0,
      estimatedCostUsd: baseUsage.costUsd || 0,
      billedCostUsd: enrichedUsage.usage.costUsd || 0,
      billingStatus: enrichedUsage.requestId ? 'billed' : 'estimated',
      rawUsage: enrichedUsage.usage.rawUsage || providerResponse?.raw || null,
      eventType: payload.type
    })

    if (payload.type === 'image') {
      await upsertGeneratedMediaRecord({
        userId,
        runId: run.id,
        projectId: payload.projectId,
        runType: 'image',
        model: payload.model || payload.payload?.model,
        prompt: payload.payload?.prompt,
        status: 'completed',
        sourceNodeId: String(payload.payload?.sourceNodeId || '').trim(),
        assets: buildImageGenerationAssets(providerResponse, String(payload.payload?.sourceNodeId || '').trim())
      })
    }

    return {
      runId: run.id,
      status: 'completed',
      result: {
        ...providerResponse,
        run_id: run.id
      }
    }
  } catch (err) {
    await supabase
      .from('workflow_runs')
      .update({ status: 'failed', finished_at: new Date().toISOString(), error_msg: err.message })
      .eq('id', run.id)

    throw err
  }
}

export const getRunById = async (userId, runId) => {
  const { data, error } = await supabase
    .from('workflow_runs')
    .select('*')
    .eq('id', runId)
    .eq('user_id', userId)
    .maybeSingle()

  if (error) throw new HttpError(500, error.message, 'RUN_GET_FAILED')
  if (!data) throw new HttpError(404, 'Run not found', 'RUN_NOT_FOUND')

  return data
}

export const createChatCompletion = async (userId, payload) => {
  return createRun(userId, { type: 'chat', payload, model: payload.model })
}

const getHeaderValue = (headers, ...names) => {
  for (const name of names) {
    const value = headers?.get?.(name)
    if (value) return value
  }
  return ''
}

export const streamChatCompletion = async (userId, payload, { onEvent = () => {} } = {}) => {
  const parsed = runSchema.parse({ type: 'chat', payload, model: payload.model })
  const providerAccess = await resolveActiveUserServiceCredential(userId)
  const providerRequestOptions = providerAccess.apiKey ? { apiKey: providerAccess.apiKey } : {}

  const startedAt = Date.now()
  const { data: run, error: runInsertError } = await supabase
    .from('workflow_runs')
    .insert({
      user_id: userId,
      project_id: null,
      type: parsed.type,
      status: 'running',
      started_at: new Date().toISOString()
    })
    .select('*')
    .single()

  if (runInsertError) throw new HttpError(500, runInsertError.message, 'RUN_CREATE_FAILED')

  let response
  let content = ''
  let usage = null
  let finishReason = ''
  let doneSent = false

  try {
    response = await providerChatCompletionsStream(parsed.payload, providerRequestOptions)
    for await (const event of readChatCompletionSseStream(response)) {
      if (event.type === 'done') {
        onEvent(formatSseData('[DONE]'))
        doneSent = true
        continue
      }

      if (event.delta) content += event.delta
      if (event.usage) usage = event.usage
      if (event.finishReason) finishReason = event.finishReason
      onEvent(formatSseData(event.payload))
    }

    if (!doneSent) {
      onEvent(formatSseData('[DONE]'))
    }

    const latencyMs = Date.now() - startedAt
    const requestId = getHeaderValue(response.headers, 'x-request-id', 'x-requestid', 'cf-aigw-request-id')
    const providerResponse = {
      id: requestId || undefined,
      choices: [
        {
          message: { role: 'assistant', content },
          finish_reason: finishReason || 'stop'
        }
      ],
      usage: usage || undefined,
      raw: {
        request_id: requestId || undefined,
        streamed: true,
        usage: usage || undefined
      }
    }
    const baseUsage = extractUsageSnapshot(providerResponse)
    const enrichedUsage = await enrichUsageWith302Record(providerResponse, baseUsage)

    await supabase
      .from('workflow_runs')
      .update({ status: 'completed', finished_at: new Date().toISOString() })
      .eq('id', run.id)

    await insertUsageEvent({
      userId,
      runId: run.id,
      model: parsed.model || parsed.payload?.model,
      apiName: providerAccess.apiName,
      providerRequestId: enrichedUsage.requestId || requestId,
      serviceCredentialId: providerAccess.serviceCredentialId,
      inputTokens: enrichedUsage.usage.inputTokens || 0,
      outputTokens: enrichedUsage.usage.outputTokens || 0,
      latencyMs,
      costUsd: enrichedUsage.usage.costUsd || 0,
      estimatedCostUsd: baseUsage.costUsd || 0,
      billedCostUsd: enrichedUsage.usage.costUsd || 0,
      billingStatus: enrichedUsage.requestId ? 'billed' : (requestId ? 'pending' : 'estimated'),
      rawUsage: enrichedUsage.usage.rawUsage || providerResponse.raw,
      eventType: parsed.type
    })

    return {
      runId: run.id,
      status: 'completed',
      result: {
        ...providerResponse,
        run_id: run.id
      }
    }
  } catch (err) {
    await supabase
      .from('workflow_runs')
      .update({ status: 'failed', finished_at: new Date().toISOString(), error_msg: err.message })
      .eq('id', run.id)
    throw err
  }
}

export const createImageGeneration = async (userId, payload) => {
  return createRun(userId, { type: 'image', projectId: payload.projectId, payload, model: payload.model })
}

export const createVideoGeneration = async (userId, payload) => {
  return createRun(userId, { type: 'video', projectId: payload.projectId, payload, model: payload.model || payload.model_name })
}

const getLocalImageRunTaskResult = async ({ userId, taskId, runId }) => {
  const run = runId ? await getRunById(userId, runId).catch(() => null) : null
  const mediaRecord = runId ? await findGeneratedMediaRecordByRunId({ userId, runId }) : null
  const data = (Array.isArray(mediaRecord?.assets) ? mediaRecord.assets : [])
    .map((asset) => String(asset?.url || '').trim())
    .filter(Boolean)
    .map((url) => ({ url }))

  if (data.length > 0) {
    return {
      task_id: taskId,
      status: 'completed',
      data,
      run_id: runId
    }
  }

  const status = String(mediaRecord?.status || run?.status || 'running').toLowerCase()
  if (isFailedImageStatus(status)) {
    return {
      task_id: taskId,
      status: 'failed',
      message: mediaRecord?.error || run?.error_msg || 'Image task failed',
      run_id: runId
    }
  }

  return {
    task_id: taskId,
    status: isCompletedImageStatus(status) ? 'processing' : (status || 'running'),
    run_id: runId
  }
}

export const getVideoTask = async (_userId, taskId) => {
  await assertVideoTaskOwnership({ userId: _userId, taskId })
  const providerAccess = await resolveActiveUserServiceCredential(_userId)
  const providerRequestOptions = providerAccess.apiKey ? { apiKey: providerAccess.apiKey } : {}
  const rawResult = await providerVideoStatus(taskId, providerRequestOptions)
  const result = await persistVideoResultAsset(rawResult)
  const { runId, sourceNodeId } = await findVideoRunContextByTask({ userId: _userId, taskId })
  await syncRunStatusFromVideoTask({ userId: _userId, runId, taskResult: result })
  const status = String(result?.status || '').toLowerCase()
  if (runId && ['completed', 'success', 'succeed', 'succeeded', 'done', 'finished'].includes(status)) {
    const baseUsage = extractUsageSnapshot(result)
    const enrichedUsage = await enrichUsageWith302Record(result, baseUsage)
    await updateUsageEventByRunId(runId, {
      input_tokens: enrichedUsage.usage.inputTokens || 0,
      output_tokens: enrichedUsage.usage.outputTokens || 0,
      cost_usd: enrichedUsage.usage.costUsd || 0,
      estimated_cost_usd: baseUsage.costUsd || 0,
      billed_cost_usd: enrichedUsage.usage.costUsd || 0,
      billing_status: enrichedUsage.requestId ? 'billed' : 'estimated',
      provider_request_id: enrichedUsage.requestId || extractProviderTaskId(result) || taskId,
      api_name: providerAccess.apiName || null,
      service_credential_id: providerAccess.serviceCredentialId || null,
      upstream_task_id: extractProviderTaskId(result) || taskId,
      raw_usage: enrichedUsage.usage.rawUsage || result?.raw || null
    })

    const run = await getRunById(_userId, runId).catch(() => null)
    await upsertGeneratedMediaRecord({
      userId: _userId,
      runId,
      projectId: run?.project_id,
      runType: 'video',
      model: run?.model || '',
      status: 'completed',
      assets: buildVideoGenerationAssets(result, sourceNodeId),
      sourceNodeId
    })
  }
  return result
}

export const getImageTask = async (_userId, taskId) => {
  const imageRunContext = await resolveImageTaskContextByTask({ userId: _userId, taskId })
  if (isLocalImageRunTaskId(taskId)) {
    const runId = parseLocalImageRunTaskId(taskId)
    return getLocalImageRunTaskResult({ userId: _userId, taskId, runId })
  }

  const providerAccess = await resolveActiveUserServiceCredential(_userId)
  const runId = imageRunContext.runId
  const run = runId ? await getRunById(_userId, runId).catch(() => null) : null
  const providerRequestOptions = {
    ...(providerAccess.apiKey ? { apiKey: providerAccess.apiKey } : {}),
    model: imageRunContext.model || run?.model || ''
  }
  const rawResult = await providerImageStatus(taskId, providerRequestOptions)
  const result = markImageResultAssetsForClientPersistence(rawResult)
  const status = String(result?.status || '').toLowerCase()
  const hasAssets = Array.isArray(result?.data) && result.data.length > 0

  if (hasAssets && ['completed', 'success', 'succeed', 'succeeded', 'done', 'finished', ''].includes(status)) {
    queueImageTaskResultFinalization({
      userId: _userId,
      runId,
      run,
      providerAccess,
      rawResult,
      taskId,
      sourceNodeId: imageRunContext.sourceNodeId
    })
  } else {
    await syncRunStatusFromImageTask({ userId: _userId, runId, taskResult: result })
  }

  return result
}
