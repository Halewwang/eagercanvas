import { z } from 'zod'
import { supabase } from '../config/supabase.js'
import { env } from '../config/env.js'
import { HttpError } from '../utils/http.js'
import {
  providerChatCompletions,
  providerCreateVideo,
  providerGenerateImage,
  providerVideoStatus
} from './provider.service.js'
import { get302RecordByRequestId } from './dashboard302.service.js'
import { resolveUserProviderAccess } from './admin-usage.service.js'
import { submitRunJob } from './run-queue.service.js'
import {
  extractProviderRequestId,
  extractUsageSnapshot,
  insertUsageEvent,
  updateUsageEventByRunId
} from './usage-ledger.service.js'

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

const persistRunJobPayload = async ({ userId, runId, type, payload, model }) => {
  const { error } = await supabase.from('audit_logs').insert({
    user_id: userId,
    action: 'run.job.created',
    metadata: {
      run_id: runId,
      type,
      model: model || payload?.model || payload?.model_name || '',
      api_name: payload?.api_name || payload?.apiName || '',
      payload: payload || {}
    }
  })

  if (error) {
    console.warn('[run-worker] persist run payload failed', error.message)
  }
}

const loadRunJobPayload = async ({ userId, runId }) => {
  const { data, error } = await supabase
    .from('audit_logs')
    .select('metadata')
    .eq('user_id', userId)
    .eq('action', 'run.job.created')
    .contains('metadata', { run_id: String(runId) })
    .order('created_at', { ascending: false })
    .limit(1)

  if (error) {
    throw new HttpError(500, error.message, 'RUN_JOB_METADATA_QUERY_FAILED')
  }

  const metadata = data?.[0]?.metadata || {}
  return {
    type: String(metadata.type || '').trim(),
    model: String(metadata.model || '').trim(),
    apiName: String(metadata.api_name || '').trim(),
    payload: metadata.payload && typeof metadata.payload === 'object' ? metadata.payload : {}
  }
}

const persistRunResult = async ({ userId, runId, status, result = null, errorMessage = '' }) => {
  const { error } = await supabase.from('audit_logs').insert({
    user_id: userId,
    action: 'run.result.updated',
    metadata: {
      run_id: runId,
      status: String(status || '').trim(),
      result: result && typeof result === 'object' ? result : null,
      error_message: String(errorMessage || '').trim()
    }
  })

  if (error) {
    console.warn('[run-worker] persist run result failed', error.message)
  }
}

const loadRunResult = async ({ userId, runId }) => {
  const { data, error } = await supabase
    .from('audit_logs')
    .select('metadata')
    .eq('user_id', userId)
    .eq('action', 'run.result.updated')
    .contains('metadata', { run_id: String(runId) })
    .order('created_at', { ascending: false })
    .limit(1)

  if (error) {
    throw new HttpError(500, error.message, 'RUN_RESULT_QUERY_FAILED')
  }

  const metadata = data?.[0]?.metadata || {}
  return {
    status: String(metadata.status || '').trim(),
    result: metadata.result && typeof metadata.result === 'object' ? metadata.result : null,
    errorMessage: String(metadata.error_message || '').trim()
  }
}

const reclaimStaleRunningRuns = async ({ limit = 10 } = {}) => {
  const cutoffIso = new Date(Date.now() - env.runClaimTimeoutMs).toISOString()
  const safeLimit = Math.max(1, Math.min(Number(limit) || 1, 20))
  const { data: staleRuns, error } = await supabase
    .from('workflow_runs')
    .select('id,user_id,type,started_at')
    .in('type', ['image', 'video'])
    .eq('status', 'running')
    .is('finished_at', null)
    .lt('started_at', cutoffIso)
    .order('started_at', { ascending: true })
    .limit(safeLimit)

  if (error) {
    console.warn('[run-worker] reclaim stale runs query failed', error.message)
    return { reclaimed: 0 }
  }

  if (!Array.isArray(staleRuns) || staleRuns.length === 0) {
    return { reclaimed: 0 }
  }

  const videoRunIds = staleRuns.filter((run) => run.type === 'video').map((run) => run.id)
  const protectedVideoRuns = new Set()

  if (videoRunIds.length) {
    const { data: auditRows, error: auditError } = await supabase
      .from('audit_logs')
      .select('metadata')
      .eq('action', 'video.task.created')
      .in('user_id', staleRuns.filter((run) => run.type === 'video').map((run) => run.user_id))

    if (auditError) {
      console.warn('[run-worker] reclaim stale video audit query failed', auditError.message)
    } else {
      for (const row of auditRows || []) {
        const runId = row?.metadata?.run_id
        if (runId) protectedVideoRuns.add(String(runId))
      }
    }
  }

  let reclaimed = 0
  for (const run of staleRuns) {
    if (run.type === 'video' && protectedVideoRuns.has(String(run.id))) {
      continue
    }

    const { data: updatedRun, error: updateError } = await supabase
      .from('workflow_runs')
      .update({
        status: 'queued',
        error_msg: 'Recovered stale run for retry'
      })
      .eq('id', run.id)
      .eq('status', 'running')
      .select('id')
      .maybeSingle()

    if (updateError) {
      console.warn('[run-worker] reclaim stale run failed', run.id, updateError.message)
      continue
    }

    if (updatedRun?.id) {
      reclaimed += 1
    }
  }

  return { reclaimed }
}

const findVideoTaskIdByRunId = async ({ userId, runId }) => {
  const { data, error } = await supabase
    .from('audit_logs')
    .select('metadata')
    .eq('user_id', userId)
    .eq('action', 'video.task.created')
    .contains('metadata', { run_id: String(runId) })
    .order('created_at', { ascending: false })
    .limit(1)

  if (error) {
    console.warn('[video] resolve task by run failed', error.message)
    return ''
  }

  const taskId = data?.[0]?.metadata?.task_id
  return taskId ? String(taskId) : ''
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
  if (String(providerAccess.apiName || '').trim() && String(providerAccess.apiKey || '').trim()) {
    return
  }

  throw new HttpError(
    403,
    'No API key has been assigned to this account yet. Please contact an administrator.',
    'API_KEY_NOT_ASSIGNED'
  )
}

const executeRunLifecycle = async ({
  userId,
  payload,
  run,
  providerAccess,
  providerRequestOptions,
  startedAt
}) => {
  try {
    await supabase
      .from('workflow_runs')
      .update({ status: 'running', error_msg: null, started_at: new Date().toISOString() })
      .eq('id', run.id)
      .eq('user_id', userId)

    let providerResponse
    if (payload.type === 'chat') {
      providerResponse = await providerChatCompletions(payload.payload, providerRequestOptions)
    } else if (payload.type === 'image') {
      providerResponse = await providerGenerateImage(payload.payload, providerRequestOptions)
    } else {
      providerResponse = await providerCreateVideo(payload.payload, providerRequestOptions)
    }

    const latencyMs = Date.now() - startedAt
    const isVideoRun = payload.type === 'video'

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

        await persistRunResult({
          userId,
          runId: run.id,
          status: 'completed',
          result: {
            ...providerResponse,
            run_id: run.id
          }
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

      await persistRunResult({
        userId,
        runId: run.id,
        status: 'running',
        result: {
          ...providerResponse,
          run_id: run.id
        }
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

    await persistRunResult({
      userId,
      runId: run.id,
      status: 'completed',
      result: providerResponse
    })

    return { runId: run.id, status: 'completed', result: providerResponse }
  } catch (err) {
    await supabase
      .from('workflow_runs')
      .update({ status: 'failed', finished_at: new Date().toISOString(), error_msg: err.message })
      .eq('id', run.id)

    await persistRunResult({
      userId,
      runId: run.id,
      status: 'failed',
      errorMessage: err.message || 'Run failed'
    })

    throw err
  }
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
      status: ['image', 'video'].includes(payload.type) ? 'queued' : 'running',
      started_at: new Date().toISOString()
    })
    .select('*')
    .single()

  if (runInsertError) throw new HttpError(500, runInsertError.message, 'RUN_CREATE_FAILED')

  if (payload.type === 'image' || payload.type === 'video') {
    await persistRunJobPayload({
      userId,
      runId: run.id,
      type: payload.type,
      payload: payload.payload,
      model: payload.model
    })

    if (env.runQueueMode !== 'worker') {
      await submitRunJob({
        waitForCompletion: false,
        handler: () => executeRunLifecycle({
          userId,
          payload,
          run,
          providerAccess,
          providerRequestOptions,
          startedAt
        })
      })
    }

    return {
      runId: run.id,
      status: 'queued',
      result: {
        run_id: run.id,
        task_id: run.id,
        status: 'queued',
        type: payload.type
      }
    }
  }

  return submitRunJob({
    handler: () => executeRunLifecycle({
      userId,
      payload,
      run,
      providerAccess,
      providerRequestOptions,
      startedAt
    })
  })
}

export const processQueuedRuns = async ({ limit = 1, types = ['image', 'video'] } = {}) => {
  await reclaimStaleRunningRuns({ limit })
  const safeLimit = Math.max(1, Math.min(Number(limit) || 1, 10))
  const { data: queuedRuns, error } = await supabase
    .from('workflow_runs')
    .select('id,user_id,project_id,type,status,started_at')
    .in('type', types)
    .eq('status', 'queued')
    .order('started_at', { ascending: true })
    .limit(safeLimit)

  if (error) {
    throw new HttpError(500, error.message, 'RUN_QUEUE_READ_FAILED')
  }

  let processed = 0
  for (const candidate of queuedRuns || []) {
    const { data: claimedRun, error: claimError } = await supabase
      .from('workflow_runs')
      .update({ status: 'running', error_msg: null, started_at: new Date().toISOString() })
      .eq('id', candidate.id)
      .eq('status', 'queued')
      .select('*')
      .maybeSingle()

    if (claimError) {
      console.warn('[run-worker] claim queued run failed', claimError.message)
      continue
    }
    if (!claimedRun) continue

    try {
      const jobPayload = await loadRunJobPayload({ userId: claimedRun.user_id, runId: claimedRun.id })
      const providerAccess = await resolveUserProviderAccess(
        claimedRun.user_id,
        jobPayload.apiName || jobPayload.payload?.api_name || jobPayload.payload?.apiName
      )
      assertAssignedProviderAccess(providerAccess)
      const providerRequestOptions = providerAccess.apiKey ? { apiKey: providerAccess.apiKey } : {}

      await executeRunLifecycle({
        userId: claimedRun.user_id,
        payload: {
          type: claimedRun.type,
          projectId: claimedRun.project_id || null,
          model: jobPayload.model || jobPayload.payload?.model || jobPayload.payload?.model_name,
          payload: jobPayload.payload || {}
        },
        run: claimedRun,
        providerAccess,
        providerRequestOptions,
        startedAt: Date.now()
      })
      processed += 1
    } catch (jobError) {
      console.warn('[run-worker] process queued run failed', claimedRun.id, jobError?.message || jobError)
      await supabase
        .from('workflow_runs')
        .update({
          status: 'failed',
          finished_at: new Date().toISOString(),
          error_msg: jobError?.message || 'Queued run processing failed'
        })
        .eq('id', claimedRun.id)
    }
  }

  return { processed }
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

  const runResult = await loadRunResult({ userId, runId: data.id }).catch(() => null)

  return {
    ...data,
    result: runResult?.result || null,
    error_msg: data.error_msg || runResult?.errorMessage || null
  }
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

export const getVideoTask = async (_userId, taskId) => {
  const requestedTaskId = String(taskId || '').trim()
  if (!requestedTaskId) throw new HttpError(400, 'taskId is required', 'INVALID_TASK_ID')

  const run = await getRunById(_userId, requestedTaskId).catch(() => null)
  if (run && run.type === 'video') {
    const providerTaskId = await findVideoTaskIdByRunId({ userId: _userId, runId: run.id })
    if (!providerTaskId) {
      return {
        task_id: requestedTaskId,
        run_id: run.id,
        status: run.status === 'failed'
          ? 'failed'
          : (run.status === 'completed'
              ? 'completed'
              : (run.status === 'running' ? 'running' : 'queued')),
        message: run.error_msg || undefined
      }
    }

    const providerAccess = await resolveUserProviderAccess(_userId)
    const providerRequestOptions = providerAccess.apiKey ? { apiKey: providerAccess.apiKey } : {}
    const result = await providerVideoStatus(providerTaskId, providerRequestOptions)
    await syncRunStatusFromVideoTask({ userId: _userId, runId: run.id, taskResult: result })
    return {
      ...result,
      run_id: run.id
    }
  }

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
