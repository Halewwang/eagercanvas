import { z } from 'zod'
import { supabase } from '../config/supabase.js'
import { HttpError } from '../utils/http.js'

const createSchema = z.object({
  name: z.string().min(1).max(120),
  canvasData: z.any().default({ nodes: [], edges: [], viewport: { x: 100, y: 50, zoom: 0.8 } }),
  thumbnailUrl: z.string().url().optional().nullable()
})

const updateSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  canvasData: z.any().optional(),
  thumbnailUrl: z.string().url().optional().nullable()
})

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
      thumbnail_url: payload.thumbnailUrl || null
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
  if (payload.thumbnailUrl !== undefined) patch.thumbnail_url = payload.thumbnailUrl

  const { data, error } = await supabase
    .from('projects')
    .update(patch)
    .eq('id', id)
    .eq('user_id', userId)
    .select('*')
    .maybeSingle()

  if (error) throw new HttpError(500, error.message, 'PROJECT_UPDATE_FAILED')
  if (!data) throw new HttpError(404, 'Project not found', 'PROJECT_NOT_FOUND')

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
