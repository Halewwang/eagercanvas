import { z } from 'zod'
import { supabase } from '../config/supabase.js'
import { HttpError } from '../utils/http.js'
import { getProject } from './projects.service.js'
import { cleanupCanvas3DAssets } from './canvas3d-cleanup.service.js'

const DEFAULT_WORKSPACE_SLUG = 'shared-workspace'

const publishTemplateSchema = z.object({
  title: z.string().trim().min(1).max(120),
  description: z.string().trim().max(2000).default('')
})

const mapWorkspace = (row, role = 'member') => ({
  id: row.id,
  slug: row.slug,
  name: row.name,
  role
})

const mapTemplate = (row) => ({
  id: row.id,
  workspaceId: row.workspace_id,
  sourceProjectId: row.source_project_id,
  ownerUserId: row.owner_user_id,
  ownerDisplayName: row.owner_display_name || 'Unknown user',
  title: row.title,
  description: row.description || '',
  coverUrl: row.cover_url || '',
  canvasData: row.canvas_json || null,
  isPublished: !!row.is_published,
  publishedAt: row.published_at,
  createdAt: row.created_at,
  updatedAt: row.updated_at
})

const normalizeCanvasForStorage = async (canvasData) => {
  const { canvasData: nextCanvasData } = await cleanupCanvas3DAssets(canvasData || {}, { persistRemote: true })
  return nextCanvasData
}

const normalizeCanvasForRead = async (canvasData) => {
  const { canvasData: nextCanvasData } = await cleanupCanvas3DAssets(canvasData || {}, { persistRemote: false })
  return nextCanvasData
}

const mapTemplateForRead = async (row) => mapTemplate({
  ...row,
  canvas_json: await normalizeCanvasForRead(row.canvas_json || {})
})

const ensureDefaultWorkspace = async () => {
  const { data, error } = await supabase
    .from('workspaces')
    .upsert(
      {
        slug: DEFAULT_WORKSPACE_SLUG,
        name: 'Shared Workspace',
        is_default: true
      },
      { onConflict: 'slug' }
    )
    .select('*')
    .single()

  if (error) throw new HttpError(500, error.message, 'WORKSPACE_ENSURE_FAILED')
  return data
}

const getUserDisplayName = async (userId) => {
  const { data, error } = await supabase
    .from('user_profiles')
    .select('display_name')
    .eq('user_id', userId)
    .maybeSingle()

  if (error) throw new HttpError(500, error.message, 'PROFILE_QUERY_FAILED')
  return String(data?.display_name || '').trim() || null
}

export const getCurrentWorkspace = async (userId) => {
  const workspace = await ensureDefaultWorkspace()

  const { data: membership, error: membershipError } = await supabase
    .from('workspace_members')
    .upsert(
      {
        workspace_id: workspace.id,
        user_id: userId,
        role: 'member'
      },
      { onConflict: 'workspace_id,user_id' }
    )
    .select('role')
    .single()

  if (membershipError) {
    throw new HttpError(500, membershipError.message, 'WORKSPACE_MEMBERSHIP_ENSURE_FAILED')
  }

  return mapWorkspace(workspace, membership?.role || 'member')
}

export const listFeaturedTemplates = async (userId) => {
  const workspace = await getCurrentWorkspace(userId)
  const { data, error } = await supabase
    .from('shared_project_templates')
    .select('*')
    .eq('workspace_id', workspace.id)
    .eq('is_published', true)
    .order('updated_at', { ascending: false })

  if (error) throw new HttpError(500, error.message, 'TEMPLATE_LIST_FAILED')

  return {
    workspace,
    templates: await Promise.all((data || []).map(mapTemplateForRead))
  }
}

export const getProjectTemplateStatus = async (userId, projectId) => {
  const workspace = await getCurrentWorkspace(userId)
  await getProject(userId, projectId)

  const { data, error } = await supabase
    .from('shared_project_templates')
    .select('*')
    .eq('workspace_id', workspace.id)
    .eq('source_project_id', projectId)
    .eq('owner_user_id', userId)
    .maybeSingle()

  if (error) throw new HttpError(500, error.message, 'TEMPLATE_STATUS_FAILED')

  return {
    workspace,
    template: data ? await mapTemplateForRead(data) : null
  }
}

export const publishProjectTemplate = async (userId, projectId, input) => {
  const workspace = await getCurrentWorkspace(userId)
  const project = await getProject(userId, projectId)
  const payload = publishTemplateSchema.parse(input || {})
  const ownerDisplayName = await getUserDisplayName(userId)
  const now = new Date().toISOString()
  const normalizedCanvasData = await normalizeCanvasForStorage(project.canvas_json || {})

  const { data, error } = await supabase
    .from('shared_project_templates')
    .upsert(
      {
        workspace_id: workspace.id,
        source_project_id: projectId,
        owner_user_id: userId,
        owner_display_name: ownerDisplayName,
        title: payload.title,
        description: payload.description,
        cover_url: project.thumbnail_url || null,
        canvas_json: normalizedCanvasData,
        is_published: true,
        published_at: now
      },
      { onConflict: 'workspace_id,source_project_id' }
    )
    .select('*')
    .single()

  if (error) throw new HttpError(500, error.message, 'TEMPLATE_PUBLISH_FAILED')

  await supabase.from('audit_logs').insert({
    user_id: userId,
    action: 'template.publish',
    metadata: {
      projectId,
      templateId: data.id,
      workspaceId: workspace.id
    }
  })

  return {
    workspace,
    template: await mapTemplateForRead(data)
  }
}

export const unpublishProjectTemplate = async (userId, projectId) => {
  const workspace = await getCurrentWorkspace(userId)
  await getProject(userId, projectId)

  const { data, error } = await supabase
    .from('shared_project_templates')
    .update({
      is_published: false
    })
    .eq('workspace_id', workspace.id)
    .eq('source_project_id', projectId)
    .eq('owner_user_id', userId)
    .select('*')
    .maybeSingle()

  if (error) throw new HttpError(500, error.message, 'TEMPLATE_UNPUBLISH_FAILED')
  if (!data) throw new HttpError(404, 'Shared template not found', 'TEMPLATE_NOT_FOUND')

  await supabase.from('audit_logs').insert({
    user_id: userId,
    action: 'template.unpublish',
    metadata: {
      projectId,
      templateId: data.id,
      workspaceId: workspace.id
    }
  })

  return {
    workspace,
    template: await mapTemplateForRead(data)
  }
}

export const createProjectFromTemplate = async (userId, templateId) => {
  const workspace = await getCurrentWorkspace(userId)
  const { data: template, error: templateError } = await supabase
    .from('shared_project_templates')
    .select('*')
    .eq('id', templateId)
    .eq('workspace_id', workspace.id)
    .eq('is_published', true)
    .maybeSingle()

  if (templateError) throw new HttpError(500, templateError.message, 'TEMPLATE_GET_FAILED')
  if (!template) throw new HttpError(404, 'Shared template not found', 'TEMPLATE_NOT_FOUND')
  const normalizedCanvasData = await normalizeCanvasForStorage(template.canvas_json || {})

  const { data: project, error: createError } = await supabase
    .from('projects')
    .insert({
      user_id: userId,
      name: template.title,
      canvas_json: normalizedCanvasData,
      thumbnail_url: template.cover_url || null
    })
    .select('*')
    .single()

  if (createError) throw new HttpError(500, createError.message, 'PROJECT_CREATE_FROM_TEMPLATE_FAILED')

  await supabase.from('audit_logs').insert({
    user_id: userId,
    action: 'template.use',
    metadata: {
      projectId: project.id,
      templateId: template.id,
      workspaceId: workspace.id
    }
  })

  return {
    workspace,
    project
  }
}
