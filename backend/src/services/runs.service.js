import { z } from 'zod'
import { supabase } from '../config/supabase.js'
import { env } from '../config/env.js'
import { HttpError } from '../utils/http.js'
import {
  providerChatCompletions,
  providerCreateVideo,
  providerGenerateImage,
  providerImageStatus,
  providerVideoStatus
} from './provider.service.js'
import { uploadDataUrl, uploadRemoteFile } from './upload.service.js'
import { get302RecordByRequestId, normalizeDashboardRecord } from './dashboard302.service.js'
import { resolveActiveUserServiceCredential } from './service-access.service.js'
import {
  extractProviderRequestId,
  extractUsageSnapshot,
  insertUsageEvent,
  updateUsageEventByRunId
} from './usage-ledger.service.js'
import { upsertGeneratedMediaRecord } from './media-library.service.js'

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

const extractProviderVideoUrl = (result = {}) =>
  result?.url ||
  result?.video_url ||
  result?.download?.url ||
  result?.data?.url ||
  result?.data?.video_url ||
  result?.data?.download?.url ||
  result?.raw?.url ||
  result?.raw?.video_url ||
  result?.raw?.download?.url ||
  result?.raw?.task_result?.video_url ||
  result?.raw?.task_result?.videos?.[0]?.url ||
  ''

const isPersistedUploadUrl = (value = '') => String(value || '').includes('/storage/v1/object/public/uploads/')
const isInlineDataUrl = (value = '') => /^data:image\/[^;,]+;base64,/i.test(String(value || '').trim())

export const persistRemoteUrlIfNeeded = async (url, fileName) => {
  const raw = String(url || '').trim()
  if (!raw || isPersistedUploadUrl(raw)) return raw
  return uploadRemoteFile({ url: raw, fileName }).then((result) => String(result?.url || '').trim() || raw)
}

export const persistDataUrlIfNeeded = async (dataUrl, fileName) => {
  const raw = String(dataUrl || '').trim()
  if (!raw || !isInlineDataUrl(raw)) return raw
  return uploadDataUrl({ dataUrl: raw, fileName }).then((result) => String(result?.url || '').trim() || raw)
}

export const persistImageResultAssets = async (result = {}, options = {}) => {
  const persistRemoteUrl = options.persistRemoteUrl || persistRemoteUrlIfNeeded
  const persistDataUrl = options.persistDataUrl || persistDataUrlIfNeeded
  const entries = Array.isArray(result?.data) ? [...result.data] : []
  if (!entries.length) return result

  const persistedEntries = await Promise.all(
    entries.map(async (entry, index) => {
      const remoteUrl = String(entry?.url || '').trim()
      if (!remoteUrl) return entry

      const fileName = `generated-${Date.now()}-${index}.png`
      const persistedUrl = isInlineDataUrl(remoteUrl)
        ? await persistDataUrl(remoteUrl, fileName).catch(() => remoteUrl)
        : await persistRemoteUrl(remoteUrl, fileName).catch(() => remoteUrl)

      return {
        ...entry,
        url: persistedUrl
      }
    })
  )

  return {
    ...result,
    data: persistedEntries
  }
}

export const persistVideoResultAsset = async (result = {}, options = {}) => {
  const persistRemoteUrl = options.persistRemoteUrl || persistRemoteUrlIfNeeded
  const rawUrl = String(extractProviderVideoUrl(result) || '').trim()
  if (!rawUrl) return result

  const persistedUrl = await persistRemoteUrl(
    rawUrl,
    `video-${Date.now()}.mp4`
  ).catch(() => rawUrl)

  const nextResult = {
    ...result,
    url: result?.url ? persistedUrl : result?.url,
    video_url: result?.video_url ? persistedUrl : result?.video_url
  }

  if (nextResult?.data && typeof nextResult.data === 'object') {
    nextResult.data = {
      ...nextResult.data,
      url: nextResult.data?.url ? persistedUrl : nextResult.data?.url,
      video_url: nextResult.data?.video_url ? persistedUrl : nextResult.data?.video_url,
      task_result: nextResult.data?.task_result
        ? {
            ...nextResult.data.task_result,
            video_url: nextResult.data.task_result?.video_url ? persistedUrl : nextResult.data.task_result?.video_url,
            videos: Array.isArray(nextResult.data.task_result?.videos)
              ? nextResult.data.task_result.videos.map((video, index) =>
                  index === 0 ? { ...video, url: persistedUrl } : video
                )
              : nextResult.data.task_result?.videos
          }
        : nextResult.data?.task_result
    }
  }

  if (nextResult?.task_result && typeof nextResult.task_result === 'object') {
    nextResult.task_result = {
      ...nextResult.task_result,
      video_url: nextResult.task_result?.video_url ? persistedUrl : nextResult.task_result?.video_url,
      videos: Array.isArray(nextResult.task_result?.videos)
        ? nextResult.task_result.videos.map((video, index) =>
            index === 0 ? { ...video, url: persistedUrl } : video
          )
        : nextResult.task_result?.videos
    }
  }

  if (nextResult?.raw && typeof nextResult.raw === 'object') {
    nextResult.raw = {
      ...nextResult.raw,
      url: nextResult.raw?.url ? persistedUrl : nextResult.raw?.url,
      video_url: nextResult.raw?.video_url ? persistedUrl : nextResult.raw?.video_url,
      task_result: nextResult.raw?.task_result
        ? {
            ...nextResult.raw.task_result,
            video_url: nextResult.raw.task_result?.video_url ? persistedUrl : nextResult.raw.task_result?.video_url,
            videos: Array.isArray(nextResult.raw.task_result?.videos)
              ? nextResult.raw.task_result.videos.map((video, index) =>
                  index === 0 ? { ...video, url: persistedUrl } : video
                )
              : nextResult.raw.task_result?.videos
          }
        : nextResult.raw?.task_result
    }
  }

  return nextResult
}

export const buildImageGenerationAssets = (result = {}, sourceNodeId = '') =>
  (Array.isArray(result?.data) ? result.data : [])
    .map((item, index) => {
      const url = String(item?.url || '').trim()
      if (!url || isInlineDataUrl(url)) return null
      return {
        kind: 'image',
        url,
        previewUrl: url,
        fileName: `generated-${index + 1}.png`,
        fileType: 'image/png',
        origin: 'generation',
        ...(sourceNodeId ? { sourceNodeId } : {})
      }
    })
    .filter(Boolean)

const resolveVideoSourceNodeId = (...candidates) => {
  for (const candidate of candidates) {
    const value = String(
      candidate?.sourceNodeId ||
      candidate?.source_node_id ||
      ''
    ).trim()
    if (value) return value
  }
  return ''
}

export const buildVideoGenerationAssets = (result = {}, sourceNodeId = '') => {
  const url = String(extractProviderVideoUrl(result) || '').trim()
  if (!url) return []
  const safeSourceNodeId = resolveVideoSourceNodeId(result, { sourceNodeId })
  return [{
    kind: 'video',
    url,
    previewUrl: url,
    fileName: 'generated-video.mp4',
    fileType: 'video/mp4',
    origin: 'generation',
    ...(safeSourceNodeId ? { sourceNodeId: safeSourceNodeId } : {})
  }]
}

const bindVideoTaskOwnership = async ({ userId, runId, taskId, sourceNodeId = '' }) => {
  if (!taskId) return
  const safeSourceNodeId = String(sourceNodeId || '').trim()
  const { error } = await supabase.from('audit_logs').insert({
    user_id: userId,
    action: 'video.task.created',
    metadata: {
      run_id: runId,
      task_id: taskId,
      ...(safeSourceNodeId ? { source_node_id: safeSourceNodeId } : {})
    }
  })
  if (error) {
    console.warn('[video] bind task ownership failed', error.message)
  }
}

const bindImageTaskOwnership = async ({ userId, runId, taskId, model = '' }) => {
  if (!taskId) return
  const { error } = await supabase.from('audit_logs').insert({
    user_id: userId,
    action: 'image.task.created',
    metadata: {
      run_id: runId,
      task_id: taskId,
      model: String(model || '').trim()
    }
  })
  if (error) {
    console.warn('[image] bind task ownership failed', error.message)
  }
}

const assertImageTaskOwnership = async ({ userId, taskId }) => {
  const { data, error } = await supabase
    .from('audit_logs')
    .select('id')
    .eq('user_id', userId)
    .eq('action', 'image.task.created')
    .contains('metadata', { task_id: String(taskId) })
    .limit(1)

  if (error) {
    throw new HttpError(500, error.message, 'TASK_OWNERSHIP_CHECK_FAILED')
  }

  if (!Array.isArray(data) || data.length === 0) {
    throw new HttpError(404, 'Image task not found', 'IMAGE_TASK_NOT_FOUND')
  }
}

const assertVideoTaskOwnership = async ({ userId, taskId }) => {
  const { data, error } = await supabase
    .from('audit_logs')
    .select('id')
    .eq('user_id', userId)
    .eq('action', 'video.task.created')
    .contains('metadata', { task_id: String(taskId) })
    .limit(1)

  if (error) {
    throw new HttpError(500, error.message, 'TASK_OWNERSHIP_CHECK_FAILED')
  }

  if (!Array.isArray(data) || data.length === 0) {
    if (env.nodeEnv !== 'production') {
      console.warn('[video] task ownership record missing in non-production', { userId, taskId })
      return
    }
    throw new HttpError(404, 'Video task not found', 'VIDEO_TASK_NOT_FOUND')
  }
}

const findImageRunIdByTask = async ({ userId, taskId }) => {
  const { data, error } = await supabase
    .from('audit_logs')
    .select('metadata')
    .eq('user_id', userId)
    .eq('action', 'image.task.created')
    .contains('metadata', { task_id: String(taskId) })
    .order('created_at', { ascending: false })
    .limit(1)

  if (error) {
    console.warn('[image] resolve run by task failed', error.message)
    return ''
  }

  const runId = data?.[0]?.metadata?.run_id
  return runId ? String(runId) : ''
}

const findImageRunContextByTask = async ({ userId, taskId }) => {
  const { data, error } = await supabase
    .from('audit_logs')
    .select('metadata')
    .eq('user_id', userId)
    .eq('action', 'image.task.created')
    .contains('metadata', { task_id: String(taskId) })
    .order('created_at', { ascending: false })
    .limit(1)

  if (error) {
    console.warn('[image] resolve run context by task failed', error.message)
    return { runId: '', model: '' }
  }

  const metadata = data?.[0]?.metadata || {}
  return {
    runId: metadata?.run_id ? String(metadata.run_id) : '',
    model: metadata?.model ? String(metadata.model) : ''
  }
}

const findVideoRunContextByTask = async ({ userId, taskId }) => {
  const { data, error } = await supabase
    .from('audit_logs')
    .select('metadata')
    .eq('user_id', userId)
    .eq('action', 'video.task.created')
    .contains('metadata', { task_id: String(taskId) })
    .order('created_at', { ascending: false })
    .limit(1)

  if (error) {
    console.warn('[video] resolve run by task failed', error.message)
    return { runId: '', sourceNodeId: '' }
  }

  const runId = data?.[0]?.metadata?.run_id
  const sourceNodeId = data?.[0]?.metadata?.source_node_id
  return {
    runId: runId ? String(runId) : '',
    sourceNodeId: sourceNodeId ? String(sourceNodeId) : ''
  }
}

const syncRunStatusFromImageTask = async ({ userId, runId, taskResult }) => {
  if (!runId || !taskResult) return
  const status = String(taskResult?.status || '').toLowerCase()
  const hasAsset = Array.isArray(taskResult?.data) && taskResult.data.length > 0

  let nextStatus = 'running'
  if (hasAsset || ['completed', 'success', 'succeed', 'succeeded', 'done', 'finished'].includes(status)) {
    nextStatus = 'completed'
  } else if (['failed', 'error', 'cancelled', 'canceled', 'failure'].includes(status)) {
    nextStatus = 'failed'
  }

  const payload = { status: nextStatus }
  if (nextStatus === 'completed' || nextStatus === 'failed') {
    payload.finished_at = new Date().toISOString()
    payload.error_msg = nextStatus === 'failed' ? (taskResult?.message || 'Image task failed') : null
  }

  const { error } = await supabase
    .from('workflow_runs')
    .update(payload)
    .eq('id', runId)
    .eq('user_id', userId)

  if (error) {
    console.warn('[image] sync run status failed', error.message)
  }
}

const syncRunStatusFromVideoTask = async ({ userId, runId, taskResult }) => {
  if (!runId || !taskResult) return
  const status = String(taskResult?.status || '').toLowerCase()
  const hasVideo = !!extractProviderVideoUrl(taskResult)

  let nextStatus = ''
  if (hasVideo || ['completed', 'success', 'succeed', 'succeeded', 'done', 'finished'].includes(status)) {
    nextStatus = 'completed'
  } else if (['failed', 'error', 'cancelled', 'canceled', 'failure'].includes(status)) {
    nextStatus = 'failed'
  } else {
    nextStatus = 'running'
  }

  const payload = {
    status: nextStatus
  }

  if (nextStatus === 'completed' || nextStatus === 'failed') {
    payload.finished_at = new Date().toISOString()
    payload.error_msg = nextStatus === 'failed' ? (taskResult?.message || 'Video task failed') : null
  }

  const { error } = await supabase
    .from('workflow_runs')
    .update(payload)
    .eq('id', runId)
    .eq('user_id', userId)

  if (error) {
    console.warn('[video] sync run status failed', error.message)
  }
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
