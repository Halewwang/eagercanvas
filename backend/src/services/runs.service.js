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
import { get302RecordByRequestId, normalizeDashboardRecord } from './dashboard302.service.js'
import { resolveActiveUserServiceCredential } from './service-access.service.js'
import {
  buildImageGenerationAssets,
  buildVideoGenerationAssets,
  extractProviderVideoUrl,
  persistImageResultAssets,
  persistVideoResultAsset,
  resolveVideoSourceNodeId
} from './run-assets.js'
import {
  assertImageTaskOwnership,
  assertVideoTaskOwnership,
  bindImageTaskOwnership,
  bindVideoTaskOwnership,
  findImageRunContextByTask,
  findVideoRunContextByTask,
  syncRunStatusFromImageTask,
  syncRunStatusFromVideoTask
} from './run-task-records.js'
import {
  extractProviderRequestId,
  extractUsageSnapshot,
  insertUsageEvent,
  updateUsageEventByRunId
} from './usage-ledger.service.js'
import { upsertGeneratedMediaRecord } from './media-library.service.js'
import { formatSseData, readChatCompletionSseStream } from '../utils/chat-sse.js'

export {
  buildImageGenerationAssets,
  buildVideoGenerationAssets,
  persistDataUrlIfNeeded,
  persistImageResultAssets,
  persistRemoteUrlIfNeeded,
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

export const createRun = async (userId, input) => {
  const payload = runSchema.parse(input)
  const providerAccess = await resolveActiveUserServiceCredential(userId)
  const providerRequestOptions = providerAccess.apiKey ? { apiKey: providerAccess.apiKey } : {}

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
    let providerResponse
    if (payload.type === 'chat') {
      providerResponse = await providerChatCompletions(payload.payload, providerRequestOptions)
    } else if (payload.type === 'image') {
      providerResponse = await providerGenerateImage(payload.payload, providerRequestOptions)
      providerResponse = await persistImageResultAssets(providerResponse)
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
        model: payload.model || payload.payload?.model
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
  await assertImageTaskOwnership({ userId: _userId, taskId })
  const providerAccess = await resolveActiveUserServiceCredential(_userId)
  const imageRunContext = await findImageRunContextByTask({ userId: _userId, taskId })
  const runId = imageRunContext.runId
  const run = runId ? await getRunById(_userId, runId).catch(() => null) : null
  const providerRequestOptions = {
    ...(providerAccess.apiKey ? { apiKey: providerAccess.apiKey } : {}),
    model: imageRunContext.model || run?.model || ''
  }
  const rawResult = await providerImageStatus(taskId, providerRequestOptions)
  const result = await persistImageResultAssets(rawResult)
  await syncRunStatusFromImageTask({ userId: _userId, runId, taskResult: result })

  if (runId) {
    const status = String(result?.status || '').toLowerCase()
    if (Array.isArray(result?.data) && result.data.length > 0 && ['completed', 'success', 'succeed', 'succeeded', 'done', 'finished', ''].includes(status)) {
      const baseUsage = extractUsageSnapshot(result)
      const enrichedUsage = await enrichUsageWith302Record(result, baseUsage)
      const usagePatch = {
        input_tokens: enrichedUsage.usage.inputTokens || 0,
        output_tokens: enrichedUsage.usage.outputTokens || 0,
        image_count: Array.isArray(result?.data) ? result.data.length : 0,
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
          userId: _userId,
          runId,
          model: run?.model || '',
          apiName: providerAccess.apiName,
          providerRequestId: usagePatch.provider_request_id,
          serviceCredentialId: providerAccess.serviceCredentialId,
          upstreamTaskId: usagePatch.upstream_task_id,
          inputTokens: enrichedUsage.usage.inputTokens || 0,
          outputTokens: enrichedUsage.usage.outputTokens || 0,
          imageCount: Array.isArray(result?.data) ? result.data.length : 0,
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
        userId: _userId,
        runId,
        projectId: run?.project_id,
        runType: 'image',
        model: run?.model || '',
        prompt: '',
        status: 'completed',
        sourceNodeId: '',
        assets: buildImageGenerationAssets(result)
      })
    }
  }

  return result
}
