import { z } from 'zod'
import { supabase } from '../config/supabase.js'
import { HttpError } from '../utils/http.js'
import {
  providerChatCompletions,
  providerCreateVideo,
  providerGenerateImage,
  providerVideoStatus
} from './provider.service.js'

const runSchema = z.object({
  type: z.enum(['chat', 'image', 'video']),
  projectId: z.string().uuid().optional().nullable(),
  model: z.string().optional(),
  payload: z.any()
})

const eventBase = {
  provider: 'openai-compatible',
  event_type: 'generation'
}

const insertUsageEvent = async (userId, runId, input = {}) => {
  const { error } = await supabase.from('usage_events').insert({
    user_id: userId,
    run_id: runId,
    provider: eventBase.provider,
    model: input.model || null,
    event_type: input.eventType || eventBase.event_type,
    input_tokens: input.inputTokens ?? 0,
    output_tokens: input.outputTokens ?? 0,
    image_count: input.imageCount ?? 0,
    video_seconds: input.videoSeconds ?? 0,
    cost_usd: input.costUsd ?? 0,
    latency_ms: input.latencyMs ?? 0
  })

  if (error) {
    console.warn('[usage] insert failed', error.message)
  }
}

export const createRun = async (userId, input) => {
  const payload = runSchema.parse(input)

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
      providerResponse = await providerChatCompletions(payload.payload)
    } else if (payload.type === 'image') {
      providerResponse = await providerGenerateImage(payload.payload)
    } else {
      providerResponse = await providerCreateVideo(payload.payload)
    }

    const latencyMs = Date.now() - startedAt

    await supabase
      .from('workflow_runs')
      .update({ status: 'completed', finished_at: new Date().toISOString() })
      .eq('id', run.id)

    const usage = providerResponse?.usage || {}
    const imageCount = Array.isArray(providerResponse?.data) ? providerResponse.data.length : 0

    await insertUsageEvent(userId, run.id, {
      model: payload.model || payload.payload?.model,
      inputTokens: usage.prompt_tokens || usage.input_tokens || 0,
      outputTokens: usage.completion_tokens || usage.output_tokens || 0,
      imageCount,
      videoSeconds: payload.type === 'video' ? payload.payload?.seconds || 0 : 0,
      latencyMs,
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
  return createRun(userId, { type: 'video', payload, model: payload.model })
}

export const getVideoTask = async (_userId, taskId) => {
  return providerVideoStatus(taskId)
}
