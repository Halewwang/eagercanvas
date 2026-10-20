import { z } from 'zod'
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
import { resolveRunProviderAccess } from './run-provider-access.js'
import {
  buildImageGenerationAssets,
  buildVideoGenerationAssets,
  extractProviderVideoUrl,
  persistImageResultAssets,
  persistVideoResultAsset,
  resolveVideoSourceNodeId
} from './run-assets.js'
import {
  assertVideoTaskOwnership,
  bindImageTaskOwnership,
  claimImageTaskPoll,
  updateImageTaskContext,
  bindVideoTaskOwnership,
  findVideoRunContextByTask,
  resolveImageTaskContextByTask,
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

export const parseRunInput = (input) => {
  const run = runSchema.parse(input)
  if (run.type === 'video') return run
  const model = run.type === 'chat' ? 'gpt-5.6-sol' : 'gpt-image-2'
  for (const requested of [run.model, run.payload?.model, run.payload?.model_name]) {
    if (requested && requested !== model) {
      throw new HttpError(400, `Unsupported ${run.type} model: ${requested}`, 'UNSUPPORTED_MODEL')
    }
  }
  return { ...run, model, payload: { ...run.payload, model } }
}

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
const IMAGE_TASK_TIMEOUT_MS = 30 * 60 * 1000

const getImageRunModel = (payload = {}) =>
  String(payload.model || payload.payload?.model || payload.payload?.model_name || '').trim()

export const isQueuedImageRun = (payload = {}) => payload?.type === 'image'

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

const finalizeImageRun = async ({
  userId,
  run,
  payload,
  providerResponse,
  providerAccess,
  imageTaskId = '',
  latencyMs = 0,
  persistedResponse = null,
  savePersistedResponse = async () => {},
  existingMediaRecord = null
} = {}) => {
  const baseUsage = extractUsageSnapshot(providerResponse)
  const requestId = extractProviderRequestId(providerResponse)
  const imageCount = Array.isArray(providerResponse?.data) ? providerResponse.data.length : 0
  const usagePatch = {
    event_type: 'image',
    input_tokens: baseUsage.inputTokens || 0,
    output_tokens: baseUsage.outputTokens || 0,
    image_count: imageCount,
    cost_usd: baseUsage.costUsd || 0,
    estimated_cost_usd: baseUsage.costUsd || 0,
    billed_cost_usd: 0,
    billing_status: 'estimated',
    provider_request_id: requestId || extractProviderTaskId(providerResponse) || imageTaskId,
    api_name: providerAccess.apiName || null,
    service_credential_id: providerAccess.serviceCredentialId || null,
    upstream_task_id: extractProviderTaskId(providerResponse) || imageTaskId,
    raw_usage: baseUsage.rawUsage || providerResponse?.raw || null,
    latency_ms: latencyMs
  }

  // Durable image checkpoints are created only after the provider usage is saved.
  if (!persistedResponse) {
    const usageEvent = await updateUsageEventByRunId(run.id, usagePatch)
    if (!usageEvent) throw new HttpError(500, 'Image usage could not be saved', 'IMAGE_USAGE_SAVE_FAILED')
  }

  providerResponse = persistedResponse || await persistImageResultAssets(providerResponse, { persistInlineDataUrls: true, requirePersistedAssets: true })
  if (!persistedResponse) await savePersistedResponse(providerResponse)
  const imageAssets = buildImageGenerationAssets(providerResponse, String(payload.payload?.sourceNodeId || '').trim())
  if (imageAssets.length === 0) {
    throw new HttpError(502, 'No persistable image output', 'NO_IMAGE_OUTPUT')
  }

  const mediaRecord = existingMediaRecord?.assets?.length ? existingMediaRecord : await upsertGeneratedMediaRecord({
    userId,
    runId: run.id,
    projectId: payload.projectId,
    runType: 'image',
    model: getImageRunModel(payload),
    prompt: payload.payload?.prompt,
    status: 'completed',
    sourceNodeId: String(payload.payload?.sourceNodeId || '').trim(),
    assets: imageAssets
  })

  if (!mediaRecord?.assets?.length) {
    throw new HttpError(500, 'Image output could not be saved', 'IMAGE_OUTPUT_SAVE_FAILED')
  }

  const { error } = await supabase
    .from('workflow_runs')
    .update({ status: 'completed', finished_at: new Date().toISOString(), error_msg: null })
    .eq('id', run.id)
    .eq('user_id', userId)
  if (error) throw new HttpError(500, error.message, 'IMAGE_RUN_STATUS_SAVE_FAILED')
  return providerResponse
}

const markImageRunFailed = async ({
  userId,
  run,
  payload,
  error
} = {}) => {
  const message = error?.message || 'Image generation failed'
  const { error: statusError } = await supabase
    .from('workflow_runs')
    .update({ status: 'failed', finished_at: new Date().toISOString(), error_msg: message })
    .eq('id', run.id)
    .eq('user_id', userId)
  if (statusError) throw new HttpError(500, statusError.message, 'IMAGE_RUN_STATUS_SAVE_FAILED')

  const mediaRecord = await upsertGeneratedMediaRecord({
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
  if (!mediaRecord) throw new HttpError(500, 'Image failure could not be saved', 'IMAGE_OUTPUT_SAVE_FAILED')
}

export const createRun = async (userId, input) => {
  const payload = parseRunInput(input)
  const providerAccess = await resolveRunProviderAccess(userId, payload)

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
    if (isQueuedImageRun(payload)) {
      const imageTaskId = buildLocalImageRunTaskId(run.id)
      const requestContext = {
        type: 'image', projectId: payload.projectId || null, model: getImageRunModel(payload),
        payload: { model: getImageRunModel(payload), prompt: payload.payload?.prompt || '', sourceNodeId: String(payload.payload?.sourceNodeId || '').trim(),
          size: payload.payload?.size || '1:1', resolution: payload.payload?.resolution || '1k', n: 1 }
      }
      await bindImageTaskOwnership({
        userId, runId: run.id, taskId: imageTaskId,
        model: getImageRunModel(payload), sourceNodeId: requestContext.payload.sourceNodeId,
        context: { provider: 'apimart', request_context: requestContext, started_at: startedAt,
          deadline_at: startedAt + IMAGE_TASK_TIMEOUT_MS, poll_version: 0, poll_lock_until: 0 }
      })
      const pendingUsage = await insertUsageEvent({
        userId, runId: run.id, model: getImageRunModel(payload), apiName: providerAccess.apiName,
        providerRequestId: imageTaskId, serviceCredentialId: providerAccess.serviceCredentialId,
        upstreamTaskId: imageTaskId, imageCount: 0, latencyMs: 0, costUsd: 0,
        estimatedCostUsd: 0, billedCostUsd: 0, billingStatus: 'pending', rawUsage: null,
        eventType: 'image_task_created'
      })
      if (!pendingUsage) throw new HttpError(500, 'Image usage could not be saved', 'IMAGE_USAGE_SAVE_FAILED')
      const context = await resolveImageTaskContextByTask({ userId, taskId: imageTaskId })
      const submitted = await providerGenerateImage(payload.payload, { timeoutMs: 60000 })
      const upstreamTaskId = extractProviderTaskId(submitted)
      if (!upstreamTaskId) throw new HttpError(502, 'Image provider did not return a task ID', 'IMAGE_TASK_ID_REQUIRED')
      const saved = await updateImageTaskContext({ userId, taskId: imageTaskId, context, expectedVersion: 0,
        metadata: { ...context.metadata, upstream_task_id: upstreamTaskId } })
      if (!saved) throw new HttpError(500, 'Image task could not be saved', 'IMAGE_TASK_CONTEXT_SAVE_FAILED')

      return {
        runId: run.id,
        status: 'running',
        result: {
          task_id: imageTaskId,
          status: 'running',
          run_id: run.id,
          provider: 'apimart'
        }
      }
    }

    let providerResponse
    if (payload.type === 'chat') {
      providerResponse = await providerChatCompletions(payload.payload)
    } else {
      providerResponse = await providerCreateVideo(payload.payload)
      providerResponse = await persistVideoResultAsset(providerResponse)
    }

    const latencyMs = Date.now() - startedAt
    const isVideoRun = payload.type === 'video'

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
        const requestId = extractProviderRequestId(providerResponse)
        await insertUsageEvent({
          userId,
          runId: run.id,
          model: payload.model || payload.payload?.model,
          apiName: providerAccess.apiName,
          providerRequestId: requestId || providerTaskId,
          serviceCredentialId: providerAccess.serviceCredentialId,
          upstreamTaskId: providerTaskId,
          inputTokens: baseUsage.inputTokens || 0,
          outputTokens: baseUsage.outputTokens || 0,
          videoSeconds: payload.payload?.seconds || payload.payload?.duration || 0,
          latencyMs,
          costUsd: baseUsage.costUsd || 0,
          estimatedCostUsd: baseUsage.costUsd || 0,
          billedCostUsd: 0,
          billingStatus: providerTaskId ? 'pending' : 'estimated',
          rawUsage: baseUsage.rawUsage || providerResponse?.raw || null,
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

    await supabase
      .from('workflow_runs')
      .update({ status: 'completed', finished_at: new Date().toISOString() })
      .eq('id', run.id)

    const baseUsage = extractUsageSnapshot(providerResponse)
    const requestId = extractProviderRequestId(providerResponse)

    await insertUsageEvent({
      userId,
      runId: run.id,
      model: payload.model || payload.payload?.model,
      apiName: providerAccess.apiName,
      providerRequestId: requestId,
      serviceCredentialId: providerAccess.serviceCredentialId,
      inputTokens: baseUsage.inputTokens || 0,
      outputTokens: baseUsage.outputTokens || 0,
      videoSeconds: payload.type === 'video' ? payload.payload?.seconds || 0 : 0,
      latencyMs,
      costUsd: baseUsage.costUsd || 0,
      estimatedCostUsd: baseUsage.costUsd || 0,
      billedCostUsd: 0,
      billingStatus: 'estimated',
      rawUsage: baseUsage.rawUsage || providerResponse?.raw || null,
      eventType: payload.type
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
  const parsed = parseRunInput({ type: 'chat', payload, model: payload.model })
  const providerAccess = await resolveRunProviderAccess(userId, parsed)

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
    response = await providerChatCompletionsStream(parsed.payload)
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

    await supabase
      .from('workflow_runs')
      .update({ status: 'completed', finished_at: new Date().toISOString() })
      .eq('id', run.id)

    await insertUsageEvent({
      userId,
      runId: run.id,
      model: parsed.model || parsed.payload?.model,
      apiName: providerAccess.apiName,
      providerRequestId: requestId,
      serviceCredentialId: providerAccess.serviceCredentialId,
      inputTokens: baseUsage.inputTokens || 0,
      outputTokens: baseUsage.outputTokens || 0,
      latencyMs,
      costUsd: baseUsage.costUsd || 0,
      estimatedCostUsd: baseUsage.costUsd || 0,
      billedCostUsd: 0,
      billingStatus: 'estimated',
      rawUsage: baseUsage.rawUsage || providerResponse.raw,
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

const getLocalImageRunTaskResult = ({ taskId, runId, run, mediaRecord }) => {
  const data = (Array.isArray(mediaRecord?.assets) ? mediaRecord.assets : [])
    .map((asset) => String(asset?.url || '').trim())
    .filter(Boolean)
    .map((url) => ({ url }))

  if (data.length > 0 && isCompletedImageStatus(run?.status)) {
    return {
      task_id: taskId,
      status: 'completed',
      data,
      run_id: runId
    }
  }

  const status = String(run?.status || mediaRecord?.status || 'running').toLowerCase()
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
  const providerAccess = await resolveRunProviderAccess(_userId, { type: 'video' })
  await assertVideoTaskOwnership({ userId: _userId, taskId })
  const rawResult = await providerVideoStatus(taskId)
  const result = await persistVideoResultAsset(rawResult)
  const { runId, sourceNodeId } = await findVideoRunContextByTask({ userId: _userId, taskId })
  await syncRunStatusFromVideoTask({ userId: _userId, runId, taskResult: result })
  const status = String(result?.status || '').toLowerCase()
  if (runId && ['completed', 'success', 'succeed', 'succeeded', 'done', 'finished'].includes(status)) {
    const baseUsage = extractUsageSnapshot(result)
    const requestId = extractProviderRequestId(result)
    await updateUsageEventByRunId(runId, {
      input_tokens: baseUsage.inputTokens || 0,
      output_tokens: baseUsage.outputTokens || 0,
      cost_usd: baseUsage.costUsd || 0,
      estimated_cost_usd: baseUsage.costUsd || 0,
      billed_cost_usd: 0,
      billing_status: 'estimated',
      provider_request_id: requestId || extractProviderTaskId(result) || taskId,
      api_name: providerAccess.apiName || null,
      service_credential_id: providerAccess.serviceCredentialId || null,
      upstream_task_id: extractProviderTaskId(result) || taskId,
      raw_usage: baseUsage.rawUsage || result?.raw || null
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

export const getImageTask = async (userId, taskId) => {
  const providerAccess = await resolveRunProviderAccess(userId, { type: 'image' })
  let context = await resolveImageTaskContextByTask({ userId, taskId })
  const localTask = isLocalImageRunTaskId(taskId)
  const runId = localTask ? parseLocalImageRunTaskId(taskId) : context.runId
  if (!runId || runId !== context.runId) throw new HttpError(404, 'Image task not found', 'IMAGE_TASK_NOT_FOUND')
  const run = await getRunById(userId, runId)
  if (run.type !== 'image') throw new HttpError(404, 'Image task not found', 'IMAGE_TASK_NOT_FOUND')
  const mediaRecord = await findGeneratedMediaRecordByRunId({ userId, runId })
  const localResult = getLocalImageRunTaskResult({ taskId, runId, run, mediaRecord })
  if (['completed', 'failed'].includes(localResult.status)) return localResult
  if (!localTask) throw new HttpError(410, 'Legacy upstream image tasks are no longer supported', 'IMAGE_TASK_RETIRED')
  if (!context.metadata?.upstream_task_id && Date.now() <= Number(context.metadata.deadline_at || Infinity)) return localResult

  context = await claimImageTaskPoll({ userId, taskId, context })
  if (!context) return { task_id: taskId, run_id: runId, status: 'processing' }
  const version = context.metadata.poll_version
  const requestContext = context.metadata.request_context
  try {
    if (!requestContext || requestContext.type !== 'image') {
      throw new HttpError(500, 'Image task request context is missing', 'IMAGE_TASK_CONTEXT_INVALID')
    }
    const params = { userId, run, payload: requestContext }
    const persistedResponse = context.metadata.persisted_result || (mediaRecord?.assets?.length ? {
      task_id: context.metadata.upstream_task_id, status: 'completed', data: mediaRecord.assets.map(asset => ({ url: asset.url }))
    } : null)
    let result
    try {
      result = persistedResponse || (context.metadata.upstream_task_id
        ? await providerImageStatus(context.metadata.upstream_task_id, { timeoutMs: 30000 })
        : { status: 'processing' })
    } catch (error) {
      if (error?.code !== 'NO_IMAGE_OUTPUT') throw error
      await markImageRunFailed({ ...params, error })
      return { task_id: taskId, run_id: runId, status: 'failed', message: error.message }
    }
    if (isFailedImageStatus(result.status)) {
      const message = result.error?.message || result.message || 'Image generation failed'
      await markImageRunFailed({ ...params, error: new Error(message) })
      return { task_id: taskId, run_id: runId, status: 'failed', message }
    }
    if (!isCompletedImageStatus(result.status)) {
      if (Date.now() > Number(context.metadata.deadline_at || Infinity)) {
        await markImageRunFailed({ ...params, error: new HttpError(504, 'Image generation timed out', 'IMAGE_TASK_TIMEOUT') })
        return { task_id: taskId, run_id: runId, status: 'failed', message: 'Image generation timed out' }
      }
      return { task_id: taskId, run_id: runId, status: result.status || 'processing', progress: result.progress || 0 }
    }
    const completed = await finalizeImageRun({
      ...params, providerResponse: result, providerAccess, imageTaskId: context.metadata.upstream_task_id,
      latencyMs: Date.now() - Number(context.metadata.started_at || Date.now()), persistedResponse, existingMediaRecord: mediaRecord,
      savePersistedResponse: async persisted => {
        context = { ...context, metadata: { ...context.metadata,
          persisted_result: { task_id: context.metadata.upstream_task_id, status: 'completed', data: persisted.data } } }
        const saved = await updateImageTaskContext({ userId, taskId, context, expectedVersion: version, metadata: context.metadata })
        if (!saved) throw new HttpError(409, 'Image task polling lease changed', 'IMAGE_TASK_POLL_CONFLICT')
        context = saved
      }
    })
    return { task_id: taskId, run_id: runId, status: 'completed', data: completed.data }
  } finally {
    await updateImageTaskContext({ userId, taskId, context, expectedVersion: version,
      metadata: { ...context.metadata, poll_version: version + 1, poll_lock_until: 0 } })
  }
}
