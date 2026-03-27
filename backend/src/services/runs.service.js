import { z } from 'zod'
import { supabase } from '../config/supabase.js'
import { env } from '../config/env.js'
import { HttpError } from '../utils/http.js'
import {
  providerChatCompletions,
  providerCreate3D,
  providerCreateVideo,
  providerGenerateImage,
  provider3DStatus,
  providerVideoStatus
} from './provider.service.js'
import { get302RecordByRequestId } from './dashboard302.service.js'
import { resolveUserProviderAccess } from './admin-usage.service.js'
import {
  extractProviderRequestId,
  extractUsageSnapshot,
  insertUsageEvent,
  updateUsageEventByRunId
} from './usage-ledger.service.js'

const runSchema = z.object({
  type: z.enum(['chat', 'image', 'video', 'model3d']),
  projectId: z.string().uuid().optional().nullable(),
  model: z.string().optional(),
  payload: z.any()
})

const extractProviderTaskId = (result = {}) => {
  const candidates = [
    result?.task_id,
    result?.taskId,
    result?.id,
    result?.raw?.task_id,
    result?.raw?.task?.task_id,
    result?.data?.task_id,
    result?.data?.taskId,
    result?.data?.id
  ]
  const found = candidates.find((value) => value !== undefined && value !== null && String(value).trim() !== '')
  return found ? String(found) : ''
}

const extractProviderVideoUrl = (result = {}) =>
  result?.url ||
  result?.video_url ||
  result?.data?.url ||
  result?.data?.video_url ||
  result?.raw?.url ||
  result?.raw?.video_url ||
  result?.raw?.task_result?.video_url ||
  result?.raw?.task_result?.videos?.[0]?.url ||
  ''

const extractProvider3DJobId = (result = {}) => {
  const candidates = [
    result?.jobId,
    result?.job_id,
    result?.JobId,
    result?.Response?.JobId,
    result?.data?.JobId
  ]
  const found = candidates.find((value) => value !== undefined && value !== null && String(value).trim() !== '')
  return found ? String(found) : ''
}

const bindVideoTaskOwnership = async ({ userId, runId, taskId }) => {
  if (!taskId) return
  const { error } = await supabase.from('audit_logs').insert({
    user_id: userId,
    action: 'video.task.created',
    metadata: {
      run_id: runId,
      task_id: taskId
    }
  })
  if (error) {
    console.warn('[video] bind task ownership failed', error.message)
  }
}

const bind3DTaskOwnership = async ({ userId, runId, taskId }) => {
  if (!taskId) return
  const { error } = await supabase.from('audit_logs').insert({
    user_id: userId,
    action: 'model3d.task.created',
    metadata: {
      run_id: runId,
      task_id: taskId
    }
  })
  if (error) {
    console.warn('[model3d] bind task ownership failed', error.message)
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

const assert3DTaskOwnership = async ({ userId, taskId }) => {
  const { data, error } = await supabase
    .from('audit_logs')
    .select('id')
    .eq('user_id', userId)
    .eq('action', 'model3d.task.created')
    .contains('metadata', { task_id: String(taskId) })
    .limit(1)

  if (error) {
    throw new HttpError(500, error.message, 'TASK_OWNERSHIP_CHECK_FAILED')
  }

  if (!Array.isArray(data) || data.length === 0) {
    throw new HttpError(404, '3D task not found', 'MODEL3D_TASK_NOT_FOUND')
  }
}

const findVideoRunIdByTask = async ({ userId, taskId }) => {
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
    return ''
  }

  const runId = data?.[0]?.metadata?.run_id
  return runId ? String(runId) : ''
}

const find3DRunIdByTask = async ({ userId, taskId }) => {
  const { data, error } = await supabase
    .from('audit_logs')
    .select('metadata')
    .eq('user_id', userId)
    .eq('action', 'model3d.task.created')
    .contains('metadata', { task_id: String(taskId) })
    .order('created_at', { ascending: false })
    .limit(1)

  if (error) {
    console.warn('[model3d] resolve run by task failed', error.message)
    return ''
  }

  const runId = data?.[0]?.metadata?.run_id
  return runId ? String(runId) : ''
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

const syncRunStatusFrom3DTask = async ({ userId, runId, taskResult }) => {
  if (!runId || !taskResult) return
  const status = String(taskResult?.status || '').toLowerCase()
  const hasAsset = Array.isArray(taskResult?.assets) && taskResult.assets.length > 0

  let nextStatus = 'running'
  if (hasAsset || ['completed', 'success', 'succeed', 'succeeded', 'done', 'finished'].includes(status)) {
    nextStatus = 'completed'
  } else if (['failed', 'error', 'cancelled', 'canceled', 'failure'].includes(status)) {
    nextStatus = 'failed'
  }

  const payload = { status: nextStatus }
  if (nextStatus === 'completed' || nextStatus === 'failed') {
    payload.finished_at = new Date().toISOString()
    payload.error_msg = nextStatus === 'failed' ? (taskResult?.message || '3D task failed') : null
  }

  const { error } = await supabase
    .from('workflow_runs')
    .update(payload)
    .eq('id', runId)
    .eq('user_id', userId)

  if (error) {
    console.warn('[model3d] sync run status failed', error.message)
  }
}

const normalizeDashboardRecord = (record = {}) => {
  if (!record || typeof record !== 'object') return null
  return {
    model: String(record.model || record.model_name || '').trim(),
    inputTokens: Number(record.input_token || record.inputTokens || 0),
    outputTokens: Number(record.output_token || record.outputTokens || 0),
    costUsd: Number(record.cost || record.cost_usd || 0),
    rawUsage: record
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

const assertAssignedProviderAccess = (providerAccess = {}) => {
  const apiName = String(providerAccess.apiName || '').trim()
  const apiKey = String(providerAccess.apiKey || '').trim()
  if (apiName && apiKey) {
    return
  }

  if (apiName && !apiKey) {
    throw new HttpError(
      503,
      'An API key is assigned to this account, but the runtime key could not be resolved. Please contact an administrator.',
      'API_KEY_RESOLUTION_FAILED'
    )
  }

  throw new HttpError(
    403,
    'No API key has been assigned to this account yet. Please contact an administrator.',
    'API_KEY_NOT_ASSIGNED'
  )
}

export const createRun = async (userId, input) => {
  const payload = runSchema.parse(input)
  const providerAccess = await resolveUserProviderAccess(userId, payload.payload?.api_name || payload.payload?.apiName)
  assertAssignedProviderAccess(providerAccess)
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
    } else if (payload.type === 'model3d') {
      providerResponse = await providerCreate3D(payload.payload, providerRequestOptions)
    } else {
      providerResponse = await providerCreateVideo(payload.payload, providerRequestOptions)
    }

    const latencyMs = Date.now() - startedAt
    const isVideoRun = payload.type === 'video'

    if (payload.type === 'model3d') {
      const providerTaskId = extractProvider3DJobId(providerResponse)
      const hasAssets = Array.isArray(providerResponse?.assets) && providerResponse.assets.length > 0

      await bind3DTaskOwnership({
        userId,
        runId: run.id,
        taskId: providerTaskId
      })

      if (hasAssets) {
        await supabase
          .from('workflow_runs')
          .update({ status: 'completed', finished_at: new Date().toISOString() })
          .eq('id', run.id)

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
        .update({ status: 'running', finished_at: null, error_msg: null })
        .eq('id', run.id)

      return {
        runId: run.id,
        status: 'running',
        result: {
          ...providerResponse,
          run_id: run.id
        }
      }
    }

    if (isVideoRun) {
      const providerTaskId = extractProviderTaskId(providerResponse)
      const videoUrl = extractProviderVideoUrl(providerResponse)

      await bindVideoTaskOwnership({
        userId,
        runId: run.id,
        taskId: providerTaskId
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
    const enrichedUsage = await enrichUsageWith302Record(providerResponse, baseUsage)
    const imageCount = Array.isArray(providerResponse?.data) ? providerResponse.data.length : 0

    await insertUsageEvent({
      userId,
      runId: run.id,
      model: payload.model || payload.payload?.model,
      apiName: providerAccess.apiName,
      providerRequestId: enrichedUsage.requestId,
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

    return { runId: run.id, status: 'completed', result: providerResponse }
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
  return createRun(userId, { type: 'image', payload, model: payload.model })
}

export const createVideoGeneration = async (userId, payload) => {
  return createRun(userId, { type: 'video', payload, model: payload.model || payload.model_name })
}

export const create3DGeneration = async (userId, payload) => {
  return createRun(userId, { type: 'model3d', payload, model: payload.model || payload.model_name })
}

export const getVideoTask = async (_userId, taskId) => {
  await assertVideoTaskOwnership({ userId: _userId, taskId })
  const providerAccess = await resolveUserProviderAccess(_userId)
  const providerRequestOptions = providerAccess.apiKey ? { apiKey: providerAccess.apiKey } : {}
  const result = await providerVideoStatus(taskId, providerRequestOptions)
  const runId = await findVideoRunIdByTask({ userId: _userId, taskId })
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
      raw_usage: enrichedUsage.usage.rawUsage || result?.raw || null
    })
  }
  return result
}

export const get3DTask = async (_userId, taskId) => {
  await assert3DTaskOwnership({ userId: _userId, taskId })
  const providerAccess = await resolveUserProviderAccess(_userId)
  const providerRequestOptions = providerAccess.apiKey ? { apiKey: providerAccess.apiKey } : {}
  const result = await provider3DStatus(taskId, providerRequestOptions)
  const runId = await find3DRunIdByTask({ userId: _userId, taskId })
  await syncRunStatusFrom3DTask({ userId: _userId, runId, taskResult: result })
  return result
}
