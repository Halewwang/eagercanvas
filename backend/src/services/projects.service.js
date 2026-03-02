import { z } from 'zod'
import { supabase } from '../config/supabase.js'
import { HttpError } from '../utils/http.js'

const createSchema = z.object({
  name: z.string().min(1).max(120),
  canvasData: z.any().default({ nodes: [], edges: [], viewport: { x: 100, y: 50, zoom: 0.8 } }),
  thumbnailUrl: z.string().optional().nullable()
})

const updateSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  canvasData: z.any().optional(),
  thumbnailUrl: z.string().optional().nullable()
})

const normalizeThumbnailUrl = (value) => {
  const raw = String(value || '').trim()
  if (!raw) return null
  return /^https?:\/\//i.test(raw) ? raw : null
}

export const listProjects = async (userId) => {
  const { data, error } = await supabase
    .from('projects')
    .select('*')
    .eq('user_id', userId)
    .order('updated_at', { ascending: false })

  if (error) throw new HttpError(500, error.message, 'PROJECT_LIST_FAILED')
  return data
}

export const getProject = async (userId, id) => {
  const { data, error } = await supabase
    .from('projects')
    .select('*')
    .eq('id', id)
    .eq('user_id', userId)
    .maybeSingle()

  if (error) throw new HttpError(500, error.message, 'PROJECT_GET_FAILED')
  if (!data) throw new HttpError(404, 'Project not found', 'PROJECT_NOT_FOUND')

  return data
}

export const createProject = async (userId, input) => {
  const payload = createSchema.parse(input)

  const { data, error } = await supabase
    .from('projects')
    .insert({
      user_id: userId,
      name: payload.name,
      canvas_json: payload.canvasData,
      thumbnail_url: normalizeThumbnailUrl(payload.thumbnailUrl)
    })
    .select('*')
    .single()

  if (error) throw new HttpError(500, error.message, 'PROJECT_CREATE_FAILED')
  return data
}

export const updateProject = async (userId, id, input) => {
  const payload = updateSchema.parse(input)

  const patch = {
    updated_at: new Date().toISOString()
  }

  if (payload.name !== undefined) patch.name = payload.name
  if (payload.canvasData !== undefined) patch.canvas_json = payload.canvasData
  if (payload.thumbnailUrl !== undefined) patch.thumbnail_url = normalizeThumbnailUrl(payload.thumbnailUrl)

  // Optimistic locking: If client provided updatedAt, check it matches
  // 如果客户端提供了 updatedAt（版本号），则检查是否匹配
  let query = supabase
    .from('projects')
    .update(patch)
    .eq('id', id)
    .eq('user_id', userId)

  if (input.currentUpdatedAt) {
    query = query.eq('updated_at', input.currentUpdatedAt)
  }

  const { data, error } = await query.select('*').maybeSingle()

  if (error) throw new HttpError(500, error.message, 'PROJECT_UPDATE_FAILED')
  
  // If we had a version check and no data returned, it means conflict
  // 如果进行了版本检查但未返回数据，说明发生了冲突（updated_at 不匹配）
  if (input.currentUpdatedAt && !data) {
    throw new HttpError(409, 'Project has been modified by another session', 'PROJECT_CONFLICT')
  }

  if (!data && !input.currentUpdatedAt) {
    // Fallback for cases without version check (e.g. name update only)
    throw new HttpError(404, 'Project not found', 'PROJECT_NOT_FOUND')
  }

  return data
}

export const removeProject = async (userId, id) => {
  const { error } = await supabase
    .from('projects')
    .delete()
    .eq('id', id)
    .eq('user_id', userId)

  if (error) throw new HttpError(500, error.message, 'PROJECT_DELETE_FAILED')

  await supabase.from('audit_logs').insert({
    user_id: userId,
    action: 'project.delete',
    metadata: { projectId: id }
  })

  return { ok: true }
}
