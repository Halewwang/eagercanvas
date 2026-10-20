import { supabase } from '../config/supabase.js'
import { HttpError } from '../utils/http.js'
import { extractProviderVideoUrl } from './run-assets.js'

export const bindVideoTaskOwnership = async ({ userId, runId, taskId, sourceNodeId = '' }) => {
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
    throw new HttpError(500, error.message, 'TASK_OWNERSHIP_BIND_FAILED')
  }
}

export const bindImageTaskOwnership = async ({ userId, runId, taskId, model = '', sourceNodeId = '', context = {} }) => {
  if (!taskId) return
  const safeSourceNodeId = String(sourceNodeId || '').trim()
  const { error } = await supabase.from('audit_logs').insert({
    user_id: userId,
    action: 'image.task.created',
    metadata: {
      ...context,
      run_id: runId,
      task_id: taskId,
      model: String(model || '').trim(),
      ...(safeSourceNodeId ? { source_node_id: safeSourceNodeId } : {})
    }
  })
  if (error) {
    throw new HttpError(500, error.message, 'TASK_OWNERSHIP_BIND_FAILED')
  }
}

const mapImageTaskContext = (metadata = {}) => ({
  runId: metadata?.run_id ? String(metadata.run_id) : '',
  model: metadata?.model ? String(metadata.model) : '',
  sourceNodeId: metadata?.source_node_id ? String(metadata.source_node_id) : ''
})

export const assertImageTaskOwnership = async ({ userId, taskId }) => {
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

export const resolveImageTaskContextByTask = async ({ userId, taskId }) => {
  const { data, error } = await supabase
    .from('audit_logs')
    .select('id, metadata')
    .eq('user_id', userId)
    .eq('action', 'image.task.created')
    .contains('metadata', { task_id: String(taskId) })
    .order('created_at', { ascending: false })
    .limit(1)

  if (error) {
    throw new HttpError(500, error.message, 'TASK_OWNERSHIP_CHECK_FAILED')
  }

  if (!Array.isArray(data) || data.length === 0) {
    throw new HttpError(404, 'Image task not found', 'IMAGE_TASK_NOT_FOUND')
  }

  return {
    ...mapImageTaskContext(data[0]?.metadata || {}),
    recordId: String(data[0]?.id || ''),
    metadata: data[0]?.metadata || {}
  }
}

export const updateImageTaskContext = async ({ userId, taskId, context, metadata, expectedVersion }) => {
  const { data, error } = await supabase.from('audit_logs')
    .update({ metadata })
    .eq('id', context.recordId)
    .eq('user_id', userId)
    .eq('action', 'image.task.created')
    .contains('metadata', { task_id: taskId, poll_version: expectedVersion })
    .select('id, metadata')
  if (error) throw new HttpError(500, error.message, 'IMAGE_TASK_CONTEXT_SAVE_FAILED')
  const row = Array.isArray(data) ? data[0] : null
  return row ? { ...context, recordId: String(row.id), metadata: row.metadata } : null
}

export const claimImageTaskPoll = async ({ userId, taskId, context, now = Date.now() }) => {
  if (Number(context.metadata?.poll_lock_until || 0) > now) return null
  const version = Number(context.metadata?.poll_version || 0)
  return updateImageTaskContext({ userId, taskId, context, expectedVersion: version, metadata: {
    ...context.metadata,
    poll_version: version + 1,
    poll_lock_until: now + 5 * 60 * 1000
  } })
}

export const assertVideoTaskOwnership = async ({ userId, taskId }) => {
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
    throw new HttpError(404, 'Video task not found', 'VIDEO_TASK_NOT_FOUND')
  }
}

export const findImageRunContextByTask = async ({ userId, taskId }) => {
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
    return { runId: '', model: '', sourceNodeId: '' }
  }

  const metadata = data?.[0]?.metadata || {}
  return mapImageTaskContext(metadata)
}

export const findVideoRunContextByTask = async ({ userId, taskId }) => {
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

export const syncRunStatusFromImageTask = async ({ userId, runId, taskResult }) => {
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

export const syncRunStatusFromVideoTask = async ({ userId, runId, taskResult }) => {
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
