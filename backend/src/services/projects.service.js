import { z } from 'zod'
import { supabase } from '../config/supabase.js'
import { HttpError } from '../utils/http.js'
import { isMissingColumnError } from '../utils/supabase-schema.js'
import { sanitizeCanvasData } from './canvas-sanitize.service.js'
import {
  assertProjectCanEdit,
  assertProjectCanRead,
  createProjectEditRequest,
  listProjectEditRequests,
  resolveProjectAccess,
  reviewProjectEditRequest
} from './project-permissions.service.js'
import {
  getActiveWorkspace,
  resolveProjectCreateWorkspace
} from './workspace-membership.service.js'

const createSchema = z.object({
  name: z.string().min(1).max(120),
  canvasData: z.any().default({ nodes: [], edges: [], viewport: { x: 100, y: 50, zoom: 0.8 } }),
  thumbnailUrl: z.string().optional().nullable()
})

const updateSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  canvasData: z.any().optional(),
  thumbnailUrl: z.string().optional().nullable(),
  baseRevision: z.string().optional().nullable(),
  currentUpdatedAt: z.string().optional().nullable()
})

const editRequestSchema = z.object({
  message: z.string().trim().max(500).optional().default('')
})

const reviewSchema = z.object({
  decision: z.enum(['approve', 'reject'])
})

const normalizeThumbnailUrl = (value) => {
  const raw = String(value || '').trim()
  if (!raw) return null
  return /^https?:\/\//i.test(raw) ? raw : null
}

const isMissingProjectWorkspaceColumn = (error) => (
  isMissingColumnError(error, 'projects', 'workspace_id') ||
  isMissingColumnError(error, 'projects', 'access_mode')
)

const hasCanvasContent = (canvasData) => {
  const nodes = Array.isArray(canvasData?.nodes) ? canvasData.nodes.length : 0
  const edges = Array.isArray(canvasData?.edges) ? canvasData.edges.length : 0
  const groups = Array.isArray(canvasData?.groups) ? canvasData.groups.length : 0
  return nodes > 0 || edges > 0 || groups > 0
}

const normalizeCanvasForStorage = async (canvasData) => {
  if (canvasData === undefined) return undefined
  return sanitizeCanvasData(canvasData || {})
}

const normalizeCanvasForRead = async (canvasData) => {
  if (canvasData === undefined) return undefined
  return sanitizeCanvasData(canvasData || {})
}

const getProjectById = async (id) => {
  const { data, error } = await supabase
    .from('projects')
    .select('*')
    .eq('id', id)
    .maybeSingle()

  if (error) throw new HttpError(500, error.message, 'PROJECT_GET_FAILED')
  if (!data) throw new HttpError(404, 'Project not found', 'PROJECT_NOT_FOUND')
  return data
}

const getOwnerProfiles = async (userIds = []) => {
  const ids = Array.from(new Set(userIds.filter(Boolean)))
  if (!ids.length) return new Map()

  const [profilesResult, usersResult] = await Promise.all([
    supabase.from('user_profiles').select('user_id, display_name, username, avatar_url').in('user_id', ids),
    supabase.from('users').select('id, email').in('id', ids)
  ])

  const profilesById = new Map()
  const usersById = new Map()
  ;(profilesResult.data || []).forEach((profile) => profilesById.set(profile.user_id, profile))
  ;(usersResult.data || []).forEach((user) => usersById.set(user.id, user))

  return new Map(ids.map((id) => {
    const profile = profilesById.get(id) || {}
    const user = usersById.get(id) || {}
    return [id, {
      displayName: profile.display_name || user.email || 'Project owner',
      username: profile.username || '',
      avatarUrl: profile.avatar_url || '',
      email: user.email || ''
    }]
  }))
}

const mapProjectForRead = async (row, {
  permission = null,
  ownerProfile = null,
  includeCanvas = false
} = {}) => ({
  ...row,
  owner_display_name: ownerProfile?.displayName || '',
  owner_avatar_url: ownerProfile?.avatarUrl || '',
  owner_username: ownerProfile?.username || '',
  owner_email: ownerProfile?.email || '',
  permission: permission || 'none',
  access_mode: row.access_mode || 'private',
  canvas_json: includeCanvas
    ? await normalizeCanvasForRead(row.canvas_json)
    : row.canvas_json
})

export const listProjects = async (userId) => {
  const activeWorkspace = await getActiveWorkspace(userId)
  let query = supabase
    .from('projects')
    .select('id, user_id, workspace_id, access_mode, name, thumbnail_url, created_at, updated_at')
    .order('updated_at', { ascending: false })

  if (activeWorkspace.kind === 'team') {
    query = query.eq('workspace_id', activeWorkspace.id).eq('access_mode', 'team')
  } else {
    query = query.eq('workspace_id', activeWorkspace.id).eq('user_id', userId)
  }

  let { data, error } = await query

  if (error && isMissingProjectWorkspaceColumn(error)) {
    const legacyResult = await supabase
      .from('projects')
      .select('id, user_id, name, thumbnail_url, created_at, updated_at')
      .eq('user_id', userId)
      .order('updated_at', { ascending: false })
    data = legacyResult.data
    error = legacyResult.error
  }

  if (error) throw new HttpError(500, error.message, 'PROJECT_LIST_FAILED')

  const ownerProfiles = await getOwnerProfiles((data || []).map((row) => row.user_id))
  const projects = []
  for (const row of data || []) {
    const permission = await resolveProjectAccess(userId, row)
    if (permission === 'none') continue
    projects.push(await mapProjectForRead(row, {
      permission,
      ownerProfile: ownerProfiles.get(row.user_id)
    }))
  }

  return projects
}

export const getProject = async (userId, id) => {
  const data = await getProjectById(id)
  const permission = await assertProjectCanRead(userId, data)
  const ownerProfiles = await getOwnerProfiles([data.user_id])

  return mapProjectForRead(data, {
    permission,
    ownerProfile: ownerProfiles.get(data.user_id),
    includeCanvas: true
  })
}

export const createProject = async (userId, input) => {
  const payload = createSchema.parse(input)
  const normalizedCanvasData = await normalizeCanvasForStorage(payload.canvasData)
  const { workspace, accessMode } = await resolveProjectCreateWorkspace(userId)

  let { data, error } = await supabase
    .from('projects')
    .insert({
      user_id: userId,
      workspace_id: workspace.id,
      access_mode: accessMode,
      name: payload.name,
      canvas_json: normalizedCanvasData,
      thumbnail_url: normalizeThumbnailUrl(payload.thumbnailUrl)
    })
    .select('*')
    .single()

  if (error && isMissingProjectWorkspaceColumn(error) && accessMode !== 'team') {
    const legacyResult = await supabase
      .from('projects')
      .insert({
        user_id: userId,
        name: payload.name,
        canvas_json: normalizedCanvasData,
        thumbnail_url: normalizeThumbnailUrl(payload.thumbnailUrl)
      })
      .select('*')
      .single()
    data = legacyResult.data
    error = legacyResult.error
  }

  if (error) throw new HttpError(500, error.message, 'PROJECT_CREATE_FAILED')

  if (accessMode === 'team') {
    const { error: memberError } = await supabase
      .from('project_members')
      .upsert(
        {
          project_id: data.id,
          user_id: userId,
          role: 'owner',
          granted_by: userId
        },
        { onConflict: 'project_id,user_id' }
      )
    if (memberError) throw new HttpError(500, memberError.message, 'PROJECT_OWNER_MEMBER_CREATE_FAILED')
  }

  const ownerProfiles = await getOwnerProfiles([userId])
  return mapProjectForRead(data, {
    permission: 'owner',
    ownerProfile: ownerProfiles.get(userId),
    includeCanvas: true
  })
}

export const updateProject = async (userId, id, input) => {
  const existingProject = await getProjectById(id)
  await assertProjectCanEdit(userId, existingProject)

  const payload = updateSchema.parse(input)
  const normalizedCanvasData = payload.canvasData !== undefined
    ? await normalizeCanvasForStorage(payload.canvasData)
    : undefined

  if (normalizedCanvasData !== undefined && !hasCanvasContent(normalizedCanvasData)) {
    const existingCanvas = await normalizeCanvasForRead(existingProject.canvas_json)
    if (hasCanvasContent(existingCanvas)) {
      throw new HttpError(
        409,
        'Blocked an empty canvas overwrite because this project already has saved content. Please refresh and try again.',
        'EMPTY_CANVAS_OVERWRITE_BLOCKED'
      )
    }
  }

  const patch = {
    updated_at: new Date().toISOString()
  }

  if (payload.name !== undefined) patch.name = payload.name
  if (normalizedCanvasData !== undefined) patch.canvas_json = normalizedCanvasData
  if (payload.thumbnailUrl !== undefined) patch.thumbnail_url = normalizeThumbnailUrl(payload.thumbnailUrl)

  let query = supabase
    .from('projects')
    .update(patch)
    .eq('id', id)

  const baseRevision = payload.baseRevision || payload.currentUpdatedAt || null
  if (baseRevision) {
    query = query.eq('updated_at', baseRevision)
  }

  const { data, error } = await query.select('*').maybeSingle()

  if (error) throw new HttpError(500, error.message, 'PROJECT_UPDATE_FAILED')

  if (baseRevision && !data) {
    throw new HttpError(409, 'Project has been modified by another session', 'PROJECT_CONFLICT')
  }

  if (!data && !baseRevision) {
    throw new HttpError(404, 'Project not found', 'PROJECT_NOT_FOUND')
  }

  const permission = await resolveProjectAccess(userId, data)
  const ownerProfiles = await getOwnerProfiles([data.user_id])
  return mapProjectForRead(data, {
    permission,
    ownerProfile: ownerProfiles.get(data.user_id),
    includeCanvas: true
  })
}

export const removeProject = async (userId, id) => {
  const project = await getProjectById(id)
  await assertProjectCanEdit(userId, project)

  const { error } = await supabase
    .from('projects')
    .delete()
    .eq('id', id)

  if (error) throw new HttpError(500, error.message, 'PROJECT_DELETE_FAILED')

  await supabase.from('audit_logs').insert({
    user_id: userId,
    action: 'project.delete',
    metadata: { projectId: id, workspaceId: project.workspace_id || null }
  })

  return { ok: true }
}

export const requestProjectEditAccess = async (userId, id, input = {}) => {
  const project = await getProjectById(id)
  const payload = editRequestSchema.parse(input || {})
  const request = await createProjectEditRequest(userId, project, payload)
  return { request }
}

export const getProjectEditRequests = async (userId, id) => {
  const project = await getProjectById(id)
  const requests = await listProjectEditRequests(userId, project)
  return { requests }
}

export const reviewProjectEditAccess = async (userId, id, requestId, input = {}) => {
  const project = await getProjectById(id)
  const payload = reviewSchema.parse(input || {})
  const request = await reviewProjectEditRequest(userId, project, requestId, payload.decision)
  return { request }
}
