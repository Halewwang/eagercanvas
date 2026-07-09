import { z } from 'zod'
import { env } from '../config/env.js'
import { supabase } from '../config/supabase.js'
import { HttpError } from '../utils/http.js'
import { isMissingColumnError, isMissingRelationError } from '../utils/supabase-schema.js'
import { getProject, createProject } from './projects.service.js'
import { sanitizeCanvasData } from './canvas-sanitize.service.js'
import { listReviewableProjectEditRequests } from './project-permissions.service.js'
import {
  acceptDirectInvite,
  createDirectInvite,
  createInviteLink,
  isInviteExpired,
  joinWorkspaceByInvite
} from './workspace-invites.service.js'
import {
  WORKSPACE_KIND,
  assertWorkspaceMember,
  assertWorkspaceOwner,
  createTeamWorkspace as createTeamWorkspaceRecord,
  deleteTeamWorkspace as deleteTeamWorkspaceRecord,
  ensurePublicWorkspace,
  getActiveWorkspace,
  getWorkspaceKind,
  getWorkspaceById,
  listUserWorkspaces,
  listWorkspaceMembers,
  leaveWorkspace as leaveWorkspaceRecord,
  mapWorkspace,
  setActiveWorkspace,
  updateTeamWorkspace as updateTeamWorkspaceRecord
} from './workspace-membership.service.js'

const publishTemplateSchema = z.object({
  title: z.string().trim().min(1).max(120),
  description: z.string().trim().max(2000).default('')
})

const templateScopeSchema = z.enum(['auto', 'community', 'workspace', 'my', 'favorites']).default('auto')

const TEMPLATE_LIST_COLUMNS = [
  'id',
  'workspace_id',
  'source_project_id',
  'owner_user_id',
  'owner_display_name',
  'owner_avatar_url',
  'title',
  'description',
  'cover_url',
  'is_published',
  'published_at',
  'created_at',
  'updated_at'
].join(', ')

const normalizeCanvasForStorage = async (canvasData) => sanitizeCanvasData(canvasData || {})

const normalizeCanvasForRead = async (canvasData) => sanitizeCanvasData(canvasData || {})

const getUserProfile = async (userId) => {
  const { data, error } = await supabase
    .from('user_profiles')
    .select('display_name, username, avatar_url')
    .eq('user_id', userId)
    .maybeSingle()

  if (isMissingColumnError(error, 'user_profiles', 'username')) {
    const { data: legacyProfile, error: legacyError } = await supabase
      .from('user_profiles')
      .select('display_name, avatar_url')
      .eq('user_id', userId)
      .maybeSingle()
    if (!legacyError) return legacyProfile || {}
    throw new HttpError(500, legacyError.message, 'PROFILE_QUERY_FAILED')
  }
  if (error) throw new HttpError(500, error.message, 'PROFILE_QUERY_FAILED')
  return data || {}
}

const getUserEmail = async (userId) => {
  const { data, error } = await supabase
    .from('users')
    .select('email')
    .eq('id', userId)
    .maybeSingle()

  if (error) throw new HttpError(500, error.message, 'USER_QUERY_FAILED')
  return String(data?.email || '').trim().toLowerCase()
}

const getUserDisplayProfile = async (userId) => {
  const [profile, email] = await Promise.all([
    getUserProfile(userId),
    getUserEmail(userId)
  ])

  return {
    displayName: String(profile?.display_name || '').trim() || email || 'Unknown user',
    avatarUrl: profile?.avatar_url || ''
  }
}

const mapTemplate = async (row, options = {}) => ({
  id: row.id,
  workspaceId: row.workspace_id,
  workspaceKind: row.workspace_kind || options.workspaceKind || '',
  sourceProjectId: row.source_project_id,
  ownerUserId: row.owner_user_id,
  ownerDisplayName: row.owner_display_name || 'Unknown user',
  ownerAvatarUrl: row.owner_avatar_url || '',
  title: row.title,
  description: row.description || '',
  coverUrl: row.cover_url || '',
  canvasData: await normalizeCanvasForRead(row.canvas_json || {}),
  isPublished: !!row.is_published,
  isFavorite: options.favoriteTemplateIds?.has?.(row.id) || false,
  publishedAt: row.published_at,
  createdAt: row.created_at,
  updatedAt: row.updated_at
})

const mapTemplateSummary = (row, options = {}) => ({
  id: row.id,
  workspaceId: row.workspace_id,
  workspaceKind: row.workspace_kind || options.workspaceKind || '',
  sourceProjectId: row.source_project_id,
  ownerUserId: row.owner_user_id,
  ownerDisplayName: row.owner_display_name || 'Unknown user',
  ownerAvatarUrl: row.owner_avatar_url || '',
  title: row.title,
  description: row.description || '',
  coverUrl: row.cover_url || '',
  isPublished: !!row.is_published,
  isFavorite: options.favoriteTemplateIds?.has?.(row.id) || false,
  publishedAt: row.published_at,
  createdAt: row.created_at,
  updatedAt: row.updated_at
})

const getFavoriteTemplateIds = async (userId, templateIds = []) => {
  const ids = templateIds.filter(Boolean)
  if (!ids.length) return new Set()
  const { data, error } = await supabase
    .from('shared_project_template_favorites')
    .select('template_id')
    .eq('user_id', userId)
    .in('template_id', ids)

  if (error) return new Set()
  return new Set((data || []).map((item) => item.template_id))
}

const mapTemplateSummariesForRead = async (userId, rows = [], options = {}) => {
  const favoriteTemplateIds = await getFavoriteTemplateIds(userId, rows.map((row) => row.id))
  return (rows || []).map((row) => mapTemplateSummary(row, {
    ...options,
    favoriteTemplateIds
  }))
}

const getTemplatePublishWorkspace = async (userId) => {
  const activeWorkspace = await getActiveWorkspace(userId)
  if (activeWorkspace.kind === WORKSPACE_KIND.team) return activeWorkspace
  const publicWorkspace = await ensurePublicWorkspace()
  return mapWorkspace(publicWorkspace, 'member', 0)
}

const assertTemplateReadable = async (userId, template) => {
  if (!template) throw new HttpError(404, 'Shared template not found', 'TEMPLATE_NOT_FOUND')
  const workspace = await getWorkspaceById(template.workspace_id)
  if (!workspace) throw new HttpError(404, 'Shared template not found', 'TEMPLATE_NOT_FOUND')
  if (getWorkspaceKind(workspace) === WORKSPACE_KIND.public) {
    return { workspace: mapWorkspace(workspace, 'member', 0) }
  }
  const { mapped } = await assertWorkspaceMember(userId, workspace.id)
  return { workspace: mapped }
}

export const getCurrentWorkspace = async (userId) => getActiveWorkspace(userId)

export const listWorkspaces = async (userId) => listUserWorkspaces(userId)

export const createTeamWorkspace = async (userId, input) => {
  const workspace = await createTeamWorkspaceRecord(userId, input)
  return {
    activeWorkspace: workspace,
    ...(await listUserWorkspaces(userId))
  }
}

export const selectWorkspace = async (userId, workspaceId) => {
  const activeWorkspace = await setActiveWorkspace(userId, workspaceId)
  return { activeWorkspace }
}

export const updateTeamWorkspace = async (userId, workspaceId, input = {}) => {
  const workspace = await updateTeamWorkspaceRecord(userId, workspaceId, input)
  const currentWorkspace = await getActiveWorkspace(userId)
  return {
    activeWorkspace: workspace.id === currentWorkspace.id ? workspace : currentWorkspace,
    ...(await listUserWorkspaces(userId))
  }
}

export const getWorkspaceMembers = async (userId, workspaceId) =>
  listWorkspaceMembers(userId, workspaceId)

export const createWorkspaceLinkInvite = async (userId, workspaceId) => {
  const { mapped: workspace } = await assertWorkspaceOwner(userId, workspaceId)
  const result = await createInviteLink(userId, workspaceId)
  return {
    workspace,
    invite: result.invite,
    token: result.token,
    inviteUrl: `${env.frontendOrigin.replace(/\/$/, '')}/workspace/join/${encodeURIComponent(result.token)}`
  }
}

export const createWorkspaceDirectInvite = async (userId, workspaceId, input = {}) => {
  const { mapped: workspace } = await assertWorkspaceOwner(userId, workspaceId)
  const invite = await createDirectInvite(userId, workspaceId, input)
  return { workspace, invite }
}

export const joinWorkspaceInvite = async (userId, token) => {
  const invite = await joinWorkspaceByInvite(userId, token)
  const activeWorkspace = await getActiveWorkspace(userId)
  return {
    invite,
    activeWorkspace,
    ...(await listUserWorkspaces(userId))
  }
}

export const listPendingWorkspaceInvites = async (userId) => {
  const email = await getUserEmail(userId)
  const queries = [
    supabase
      .from('workspace_invites')
      .select('*')
      .eq('invite_type', 'direct')
      .eq('status', 'pending')
      .eq('invitee_user_id', userId)
  ]
  if (email) {
    queries.push(
      supabase
        .from('workspace_invites')
        .select('*')
        .eq('invite_type', 'direct')
        .eq('status', 'pending')
        .eq('invitee_email', email)
    )
  }

  const results = await Promise.all(queries)
  for (const result of results) {
    if (result.error) throw new HttpError(500, result.error.message, 'WORKSPACE_INVITES_LIST_FAILED')
  }

  const uniqueInvites = new Map()
  results.flatMap((result) => result.data || [])
    .filter((invite) => !isInviteExpired(invite))
    .forEach((invite) => uniqueInvites.set(invite.id, invite))

  const invites = Array.from(uniqueInvites.values())
  const workspaceIds = Array.from(new Set(invites.map((invite) => invite.workspace_id).filter(Boolean)))
  const workspaceById = new Map()

  if (workspaceIds.length) {
    const { data: workspaces, error } = await supabase
      .from('workspaces')
      .select('*')
      .in('id', workspaceIds)
    if (error) throw new HttpError(500, error.message, 'WORKSPACE_INVITE_WORKSPACE_QUERY_FAILED')
    ;(workspaces || []).forEach((workspace) => workspaceById.set(workspace.id, workspace))
  }

  return invites.map((invite) => ({
    id: invite.id,
    workspace: workspaceById.has(invite.workspace_id)
      ? mapWorkspace(workspaceById.get(invite.workspace_id), 'member', 0)
      : null,
    createdBy: invite.created_by,
    expiresAt: invite.expires_at,
    createdAt: invite.created_at
  }))
}

export const getWorkspaceInbox = async (userId) => {
  const [workspaceInvites, projectEditRequests] = await Promise.all([
    listPendingWorkspaceInvites(userId),
    listReviewableProjectEditRequests(userId)
  ])
  return {
    workspaceInvites,
    projectEditRequests
  }
}

export const acceptWorkspaceDirectInvite = async (userId, inviteId) => {
  const invite = await acceptDirectInvite(userId, inviteId)
  const activeWorkspace = await getActiveWorkspace(userId)
  return {
    invite,
    activeWorkspace,
    ...(await listUserWorkspaces(userId))
  }
}

export const leaveUserWorkspace = async (userId, workspaceId, input = {}) => {
  const result = await leaveWorkspaceRecord(userId, workspaceId, input)
  return {
    ...result,
    ...(await listUserWorkspaces(userId))
  }
}

export const deleteTeamWorkspace = async (userId, workspaceId) => {
  const result = await deleteTeamWorkspaceRecord(userId, workspaceId)
  return {
    ...result,
    ...(await listUserWorkspaces(userId))
  }
}

export const listTemplatesByScope = async (userId, rawScope = 'auto') => {
  const scope = templateScopeSchema.parse(rawScope || 'auto')
  const activeWorkspace = await getActiveWorkspace(userId)
  const publicWorkspace = await ensurePublicWorkspace()
  let query = supabase
    .from('shared_project_templates')
    .select(TEMPLATE_LIST_COLUMNS)
    .eq('is_published', true)
    .order('updated_at', { ascending: false })
  let workspace = activeWorkspace
  let effectiveScope = scope
  let workspaceKind = ''

  if (scope === 'auto') {
    effectiveScope = activeWorkspace.kind === WORKSPACE_KIND.team ? 'workspace' : 'community'
  }

  if (effectiveScope === 'community') {
    query = query.eq('workspace_id', publicWorkspace.id)
    workspace = mapWorkspace(publicWorkspace, 'member', 0)
    workspaceKind = WORKSPACE_KIND.public
  } else if (effectiveScope === 'workspace') {
    const targetWorkspace = activeWorkspace.kind === WORKSPACE_KIND.team
      ? activeWorkspace
      : mapWorkspace(publicWorkspace, 'member', 0)
    query = query.eq('workspace_id', targetWorkspace.id)
    workspace = targetWorkspace
    workspaceKind = targetWorkspace.kind
    effectiveScope = activeWorkspace.kind === WORKSPACE_KIND.team ? 'workspace' : 'community'
  } else if (effectiveScope === 'my') {
    query = query.eq('owner_user_id', userId)
    workspaceKind = ''
  } else if (effectiveScope === 'favorites') {
    const { data: favorites, error: favoritesError } = await supabase
      .from('shared_project_template_favorites')
      .select('template_id')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
    if (isMissingRelationError(favoritesError, 'shared_project_template_favorites')) {
      return { workspace, scope: effectiveScope, templates: [] }
    }
    if (favoritesError) throw new HttpError(500, favoritesError.message, 'TEMPLATE_FAVORITES_LIST_FAILED')
    const templateIds = (favorites || []).map((item) => item.template_id).filter(Boolean)
    if (!templateIds.length) {
      return { workspace, scope: effectiveScope, templates: [] }
    }
    query = query.in('id', templateIds)
    workspaceKind = ''
  }

  const { data, error } = await query
  if (error) throw new HttpError(500, error.message, 'TEMPLATE_LIST_FAILED')

  const readableTemplates = []
  for (const template of data || []) {
    if (effectiveScope === 'my' || effectiveScope === 'favorites') {
      try {
        await assertTemplateReadable(userId, template)
        readableTemplates.push(template)
      } catch {
        // Hidden team templates should not leak through My/Favorites after membership changes.
      }
    } else {
      readableTemplates.push(template)
    }
  }

  return {
    workspace,
    scope: effectiveScope,
    templates: await mapTemplateSummariesForRead(userId, readableTemplates, { workspaceKind })
  }
}

export const listFeaturedTemplates = async (userId) => listTemplatesByScope(userId, 'auto')

export const getSharedTemplateDetail = async (userId, templateId) => {
  const { data, error } = await supabase
    .from('shared_project_templates')
    .select('*')
    .eq('id', templateId)
    .eq('is_published', true)
    .maybeSingle()

  if (error) throw new HttpError(500, error.message, 'TEMPLATE_GET_FAILED')
  const { workspace } = await assertTemplateReadable(userId, data)

  return {
    workspace,
    template: await mapTemplate(data, { workspaceKind: workspace.kind })
  }
}

export const getProjectTemplateStatus = async (userId, projectId) => {
  const workspace = await getTemplatePublishWorkspace(userId)
  const project = await getProject(userId, projectId)
  if (project.permission === 'viewer') {
    throw new HttpError(403, 'Project edit permission required', 'PROJECT_EDIT_PERMISSION_REQUIRED')
  }

  const { data, error } = await supabase
    .from('shared_project_templates')
    .select('*')
    .eq('workspace_id', workspace.id)
    .eq('source_project_id', projectId)
    .eq('owner_user_id', project.user_id)
    .maybeSingle()

  if (error) throw new HttpError(500, error.message, 'TEMPLATE_STATUS_FAILED')

  return {
    workspace,
    template: data ? await mapTemplate(data, { workspaceKind: workspace.kind }) : null
  }
}

export const publishProjectTemplate = async (userId, projectId, input) => {
  const workspace = await getTemplatePublishWorkspace(userId)
  const project = await getProject(userId, projectId)
  if (project.permission === 'viewer') {
    throw new HttpError(403, 'Project edit permission required', 'PROJECT_EDIT_PERMISSION_REQUIRED')
  }
  const payload = publishTemplateSchema.parse(input || {})
  const ownerProfile = await getUserDisplayProfile(project.user_id || userId)
  const now = new Date().toISOString()
  const normalizedCanvasData = await normalizeCanvasForStorage(project.canvas_json || {})

  const { data, error } = await supabase
    .from('shared_project_templates')
    .upsert(
      {
        workspace_id: workspace.id,
        source_project_id: projectId,
        owner_user_id: project.user_id || userId,
        owner_display_name: ownerProfile.displayName,
        owner_avatar_url: ownerProfile.avatarUrl,
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
      workspaceId: workspace.id,
      scope: workspace.kind === WORKSPACE_KIND.team ? 'workspace' : 'community'
    }
  })

  return {
    workspace,
    template: await mapTemplate(data, { workspaceKind: workspace.kind })
  }
}

export const unpublishProjectTemplate = async (userId, projectId) => {
  const workspace = await getTemplatePublishWorkspace(userId)
  const project = await getProject(userId, projectId)
  if (project.permission === 'viewer') {
    throw new HttpError(403, 'Project edit permission required', 'PROJECT_EDIT_PERMISSION_REQUIRED')
  }

  const { data, error } = await supabase
    .from('shared_project_templates')
    .update({
      is_published: false
    })
    .eq('workspace_id', workspace.id)
    .eq('source_project_id', projectId)
    .eq('owner_user_id', project.user_id || userId)
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
    template: await mapTemplate(data, { workspaceKind: workspace.kind })
  }
}

export const createProjectFromTemplate = async (userId, templateId) => {
  const { data: template, error: templateError } = await supabase
    .from('shared_project_templates')
    .select('*')
    .eq('id', templateId)
    .eq('is_published', true)
    .maybeSingle()

  if (templateError) throw new HttpError(500, templateError.message, 'TEMPLATE_GET_FAILED')
  const { workspace: sourceWorkspace } = await assertTemplateReadable(userId, template)
  const normalizedCanvasData = await normalizeCanvasForStorage(template.canvas_json || {})
  const project = await createProject(userId, {
    name: template.title,
    canvasData: normalizedCanvasData,
    thumbnailUrl: template.cover_url || null
  })
  const activeWorkspace = await getActiveWorkspace(userId)

  await supabase.from('audit_logs').insert({
    user_id: userId,
    action: 'template.use',
    metadata: {
      projectId: project.id,
      templateId: template.id,
      workspaceId: activeWorkspace.id,
      sourceWorkspaceId: sourceWorkspace.id
    }
  })

  return {
    workspace: activeWorkspace,
    project
  }
}

export const favoriteSharedTemplate = async (userId, templateId) => {
  const { data: template, error: templateError } = await supabase
    .from('shared_project_templates')
    .select('*')
    .eq('id', templateId)
    .eq('is_published', true)
    .maybeSingle()

  if (templateError) throw new HttpError(500, templateError.message, 'TEMPLATE_GET_FAILED')
  await assertTemplateReadable(userId, template)

  const { error } = await supabase
    .from('shared_project_template_favorites')
    .upsert(
      {
        user_id: userId,
        template_id: templateId
      },
      { onConflict: 'user_id,template_id' }
    )
  if (error) throw new HttpError(500, error.message, 'TEMPLATE_FAVORITE_FAILED')
  return { ok: true }
}

export const unfavoriteSharedTemplate = async (userId, templateId) => {
  const { error } = await supabase
    .from('shared_project_template_favorites')
    .delete()
    .eq('user_id', userId)
    .eq('template_id', templateId)

  if (error) throw new HttpError(500, error.message, 'TEMPLATE_UNFAVORITE_FAILED')
  return { ok: true }
}
