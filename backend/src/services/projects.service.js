import { z } from 'zod'
import { supabase } from '../config/supabase.js'
import { HttpError } from '../utils/http.js'
import { isMissingColumnError, isMissingRelationError } from '../utils/supabase-schema.js'
import { sanitizeCanvasData } from './canvas-sanitize.service.js'
import {
  assertProjectCanEdit,
  assertProjectCanRead,
  createProjectEditRequest,
  listProjectEditRequests,
  resolveProjectAccess,
  resolveProjectListAccessMap,
  reviewProjectEditRequest
} from './project-permissions.service.js'
import {
  assertWorkspaceMemberAccess,
  assertWorkspaceMember,
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

const PROJECT_MUTATION_RESPONSE_COLUMNS = 'id, user_id, workspace_id, access_mode, name, thumbnail_url, created_at, updated_at'

const editRequestSchema = z.object({
  message: z.string().trim().max(500).optional().default('')
})

const reviewSchema = z.object({
  decision: z.enum(['approve', 'reject'])
})

const projectPermissionSchema = z.object({
  role: z.enum(['owner', 'editor', 'viewer'])
})

const copyToWorkspaceSchema = z.object({
  workspaceId: z.string().trim().min(1)
})

const shareByEmailSchema = z.object({
  email: z.string().trim().email().transform((value) => value.toLowerCase())
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
  accessSource = null,
  ownerProfile = null,
  includeCanvas = false
} = {}) => ({
  ...row,
  owner_display_name: ownerProfile?.displayName || '',
  owner_avatar_url: ownerProfile?.avatarUrl || '',
  owner_username: ownerProfile?.username || '',
  owner_email: ownerProfile?.email || '',
  permission: permission || 'none',
  access_source: accessSource || 'owned',
  access_mode: row.access_mode || 'private',
  canvas_json: includeCanvas
    ? await normalizeCanvasForRead(row.canvas_json)
    : row.canvas_json
})

export const resolveProjectAccessSource = (row = {}, userId = '', options = {}) => {
  const normalizedUserId = String(userId || '').trim()
  if (normalizedUserId && String(row.user_id || '') === normalizedUserId) return 'owned'

  const directSharedIds = options.directSharedIds instanceof Set
    ? options.directSharedIds
    : new Set(options.directSharedIds || [])
  if (row?.id && directSharedIds.has(row.id)) return 'direct_share'

  if (String(row.access_mode || '') === 'team') return 'team_workspace'
  if (String(options.permission || '') === 'viewer') return 'direct_share'
  return 'owned'
}

export const shouldUseLegacyPersonalProjectList = (activeWorkspace = {}) => (
  activeWorkspace.kind !== 'team' && activeWorkspace.schemaVersion === 'legacy'
)

export const applyProjectListWorkspaceFilter = (query, activeWorkspace, userId) => {
  if (activeWorkspace.kind === 'team') {
    return query.eq('workspace_id', activeWorkspace.id).eq('access_mode', 'team')
  }

  if (shouldUseLegacyPersonalProjectList(activeWorkspace)) {
    return query.eq('user_id', userId)
  }

  return query
    .or(`workspace_id.eq.${activeWorkspace.id},workspace_id.is.null`)
    .eq('user_id', userId)
}

const listLegacyPersonalProjectRows = async (userId) => {
  return supabase
    .from('projects')
    .select('id, user_id, name, thumbnail_url, created_at, updated_at')
    .eq('user_id', userId)
    .order('updated_at', { ascending: false })
}

const getUpdatedAtTs = (row = {}) => {
  const ts = new Date(row.updated_at || 0).getTime()
  return Number.isFinite(ts) ? ts : 0
}

export const mergeProjectListRows = (primaryRows = [], directSharedRows = []) => {
  const byId = new Map()
  for (const row of Array.isArray(primaryRows) ? primaryRows : []) {
    if (row?.id) byId.set(row.id, row)
  }
  for (const row of Array.isArray(directSharedRows) ? directSharedRows : []) {
    if (row?.id && !byId.has(row.id)) byId.set(row.id, row)
  }
  return Array.from(byId.values()).sort((a, b) => getUpdatedAtTs(b) - getUpdatedAtTs(a))
}

const listDirectSharedProjectRows = async (userId) => {
  const { data: memberships, error: membershipError } = await supabase
    .from('project_members')
    .select('project_id, role')
    .eq('user_id', userId)
    .eq('role', 'viewer')

  if (membershipError) {
    if (
      isMissingRelationError(membershipError, 'project_members') ||
      isMissingColumnError(membershipError, 'project_members', 'role')
    ) {
      return []
    }
    throw new HttpError(500, membershipError.message, 'PROJECT_SHARED_MEMBER_LIST_FAILED')
  }

  const projectIds = Array.from(new Set((memberships || []).map((row) => row.project_id).filter(Boolean)))
  if (!projectIds.length) return []

  const { data, error } = await supabase
    .from('projects')
    .select('id, user_id, workspace_id, access_mode, name, thumbnail_url, created_at, updated_at')
    .in('id', projectIds)
    .neq('user_id', userId)
    .order('updated_at', { ascending: false })

  if (error) throw new HttpError(500, error.message, 'PROJECT_SHARED_LIST_FAILED')
  return data || []
}

const resolveProjectListWorkspace = async (userId, options = {}) => {
  const workspaceId = String(options.workspaceId || '').trim()
  if (!workspaceId) return getActiveWorkspace(userId)
  const { mapped } = await assertWorkspaceMemberAccess(userId, workspaceId)
  return mapped
}

export const listProjects = async (userId, options = {}) => {
  const activeWorkspace = await resolveProjectListWorkspace(userId, options)
  let data = null
  let error = null

  if (shouldUseLegacyPersonalProjectList(activeWorkspace)) {
    const legacyResult = await listLegacyPersonalProjectRows(userId)
    data = legacyResult.data
    error = legacyResult.error
  } else {
    let query = supabase
      .from('projects')
      .select('id, user_id, workspace_id, access_mode, name, thumbnail_url, created_at, updated_at')
      .order('updated_at', { ascending: false })

    query = applyProjectListWorkspaceFilter(query, activeWorkspace, userId)

    const modernResult = await query
    data = modernResult.data
    error = modernResult.error
  }

  if (error && isMissingProjectWorkspaceColumn(error)) {
    const legacyResult = await listLegacyPersonalProjectRows(userId)
    data = legacyResult.data
    error = legacyResult.error
  }

  if (error) throw new HttpError(500, error.message, 'PROJECT_LIST_FAILED')

  const directSharedRows = await listDirectSharedProjectRows(userId)
  const directSharedIds = new Set(directSharedRows.map((row) => row.id).filter(Boolean))
  const rows = mergeProjectListRows(data || [], directSharedRows)
  const ownerProfiles = await getOwnerProfiles(rows.map((row) => row.user_id))
  const accessByProjectId = await resolveProjectListAccessMap(userId, rows, { directSharedIds })
  const projects = []
  for (const row of rows) {
    const permission = accessByProjectId.get(row.id) || 'none'
    if (permission === 'none') continue
    projects.push(await mapProjectForRead(row, {
      permission,
      accessSource: resolveProjectAccessSource(row, userId, { directSharedIds, permission }),
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
    accessSource: resolveProjectAccessSource(data, userId, { permission }),
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
    accessSource: 'owned',
    ownerProfile: ownerProfiles.get(userId),
    includeCanvas: true
  })
}

export const copyProjectToWorkspace = async (userId, id, input = {}) => {
  const payload = copyToWorkspaceSchema.parse(input || {})
  const sourceProject = await getProjectById(id)
  await assertProjectCanEdit(userId, sourceProject)

  if (sourceProject.access_mode === 'team' || String(sourceProject.user_id || '') !== String(userId || '')) {
    throw new HttpError(400, 'Only personal projects can be copied to a team workspace', 'PERSONAL_PROJECT_COPY_REQUIRED')
  }

  const { mapped: targetWorkspace } = await assertWorkspaceMember(userId, payload.workspaceId)
  if (targetWorkspace.kind !== 'team') {
    throw new HttpError(400, 'A team workspace is required', 'TEAM_WORKSPACE_REQUIRED')
  }

  const normalizedCanvasData = await normalizeCanvasForStorage(sourceProject.canvas_json || {})
  const { data, error } = await supabase
    .from('projects')
    .insert({
      user_id: userId,
      workspace_id: targetWorkspace.id,
      access_mode: 'team',
      name: `${sourceProject.name || 'Untitled'} (Copy)`,
      canvas_json: normalizedCanvasData,
      thumbnail_url: normalizeThumbnailUrl(sourceProject.thumbnail_url)
    })
    .select('*')
    .single()

  if (error) throw new HttpError(500, error.message, 'PROJECT_COPY_TO_WORKSPACE_FAILED')

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

  if (memberError) throw new HttpError(500, memberError.message, 'PROJECT_COPY_OWNER_MEMBER_FAILED')

  const ownerProfiles = await getOwnerProfiles([userId])
  return mapProjectForRead(data, {
    permission: 'owner',
    accessSource: 'owned',
    ownerProfile: ownerProfiles.get(userId),
    includeCanvas: true
  })
}

const findUserByEmail = async (email) => {
  const { data, error } = await supabase
    .from('users')
    .select('id, email')
    .eq('email', email)
    .maybeSingle()

  if (error) throw new HttpError(500, error.message, 'PROJECT_SHARE_USER_LOOKUP_FAILED')
  return data || null
}

const getExistingProjectMember = async (projectId, userId) => {
  const { data, error } = await supabase
    .from('project_members')
    .select('project_id, user_id, role')
    .eq('project_id', projectId)
    .eq('user_id', userId)
    .maybeSingle()

  if (error) throw new HttpError(500, error.message, 'PROJECT_SHARE_MEMBER_LOOKUP_FAILED')
  return data || null
}

export const shareProjectWithUser = async (userId, id, input = {}) => {
  const payload = shareByEmailSchema.parse(input || {})
  const project = await getProjectById(id)
  await assertProjectCanEdit(userId, project)

  if (project.access_mode === 'team' || String(project.user_id || '') !== String(userId || '')) {
    throw new HttpError(400, 'Only personal projects can be shared with a user', 'PERSONAL_PROJECT_SHARE_REQUIRED')
  }

  const recipient = await findUserByEmail(payload.email)
  if (!recipient?.id) {
    throw new HttpError(404, 'User not found', 'PROJECT_SHARE_USER_NOT_FOUND')
  }
  if (String(recipient.id) === String(userId)) {
    throw new HttpError(400, 'Project is already owned by this user', 'PROJECT_SHARE_SELF_NOT_ALLOWED')
  }

  const existingMember = await getExistingProjectMember(project.id, recipient.id)
  if (existingMember?.role === 'owner' || existingMember?.role === 'editor') {
    return {
      user: { id: recipient.id, email: recipient.email || payload.email },
      role: existingMember.role
    }
  }

  const { data, error } = await supabase
    .from('project_members')
    .upsert(
      {
        project_id: project.id,
        user_id: recipient.id,
        role: 'viewer',
        granted_by: userId
      },
      { onConflict: 'project_id,user_id' }
    )
    .select('project_id, user_id, role')
    .single()

  if (error) throw new HttpError(500, error.message, 'PROJECT_SHARE_CREATE_FAILED')

  return {
    user: { id: recipient.id, email: recipient.email || payload.email },
    role: data?.role || 'viewer'
  }
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

  const { data, error } = await query.select(PROJECT_MUTATION_RESPONSE_COLUMNS).maybeSingle()

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
    accessSource: resolveProjectAccessSource(data, userId, { permission }),
    ownerProfile: ownerProfiles.get(data.user_id)
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

const getWorkspaceMembersForProject = async (project) => {
  if (!project.workspace_id || project.access_mode !== 'team') return []
  const { data, error } = await supabase
    .from('workspace_members')
    .select('workspace_id, user_id, role, created_at')
    .eq('workspace_id', project.workspace_id)
    .order('created_at', { ascending: true })

  if (error) throw new HttpError(500, error.message, 'PROJECT_PERMISSION_WORKSPACE_MEMBERS_FAILED')
  return data || []
}

const getProjectMembersForProject = async (projectId) => {
  const { data, error } = await supabase
    .from('project_members')
    .select('project_id, user_id, role, granted_by, created_at, updated_at')
    .eq('project_id', projectId)

  if (error) throw new HttpError(500, error.message, 'PROJECT_PERMISSION_MEMBERS_FAILED')
  return data || []
}

const getProjectPermissionProfiles = async (userIds = []) => {
  const ids = Array.from(new Set((userIds || []).filter(Boolean)))
  if (!ids.length) return new Map()
  const ownerProfiles = await getOwnerProfiles(ids)
  return ownerProfiles
}

const getEffectiveProjectPermission = ({ project, workspaceRole = '', projectRole = '', userId = '' }) => {
  if (String(project.user_id || '') === String(userId || '')) return 'owner'
  if (projectRole === 'owner') return 'owner'
  if (workspaceRole === 'owner' && project.access_mode === 'team') return 'owner'
  if (projectRole === 'editor') return 'editor'
  if (projectRole === 'viewer') return 'viewer'
  if (workspaceRole && project.access_mode === 'team') return 'viewer'
  return 'none'
}

const assertTeamProjectPermissionsScope = (project) => {
  if (project?.access_mode === 'team' && project?.workspace_id) return
  throw new HttpError(
    400,
    'Project permissions are only managed for team workspace projects',
    'PROJECT_PERMISSION_TEAM_PROJECT_REQUIRED'
  )
}

export const getProjectPermissions = async (userId, id) => {
  const project = await getProjectById(id)
  assertTeamProjectPermissionsScope(project)
  await assertProjectCanEdit(userId, project)
  const [workspaceMembers, projectMembers, pendingRequests] = await Promise.all([
    getWorkspaceMembersForProject(project),
    getProjectMembersForProject(project.id),
    listProjectEditRequests(userId, project)
  ])

  const projectRoleByUserId = new Map(projectMembers.map((member) => [member.user_id, member.role]))
  const workspaceRoleByUserId = new Map(workspaceMembers.map((member) => [member.user_id, member.role]))
  const allUserIds = Array.from(new Set([
    project.user_id,
    ...workspaceMembers.map((member) => member.user_id),
    ...projectMembers.map((member) => member.user_id),
    ...pendingRequests.map((request) => request.requester_user_id)
  ].filter(Boolean)))
  const profiles = await getProjectPermissionProfiles(allUserIds)

  const members = allUserIds.map((memberUserId) => {
    const profile = profiles.get(memberUserId) || {}
    const workspaceRole = workspaceRoleByUserId.get(memberUserId) || ''
    const projectRole = projectRoleByUserId.get(memberUserId) || (String(project.user_id) === String(memberUserId) ? 'owner' : '')
    return {
      userId: memberUserId,
      displayName: profile.displayName || profile.email || 'Workspace member',
      username: profile.username || '',
      email: profile.email || '',
      avatarUrl: profile.avatarUrl || '',
      workspaceRole: workspaceRole || '',
      projectRole: projectRole || '',
      effectivePermission: getEffectiveProjectPermission({
        project,
        workspaceRole,
        projectRole,
        userId: memberUserId
      })
    }
  }).filter((member) => member.effectivePermission !== 'none' || member.workspaceRole)

  return {
    project: {
      id: project.id,
      name: project.name,
      workspaceId: project.workspace_id || '',
      accessMode: project.access_mode || 'private',
      ownerUserId: project.user_id
    },
    ownerUserId: project.user_id,
    members,
    pendingRequests
  }
}

const assertTargetWorkspaceMember = async (project, targetUserId) => {
  if (project.access_mode !== 'team') return null
  const { data, error } = await supabase
    .from('workspace_members')
    .select('workspace_id, user_id, role')
    .eq('workspace_id', project.workspace_id)
    .eq('user_id', targetUserId)
    .maybeSingle()

  if (error) throw new HttpError(500, error.message, 'PROJECT_PERMISSION_TARGET_MEMBER_FAILED')
  if (!data) throw new HttpError(400, 'Target user must belong to the workspace', 'PROJECT_PERMISSION_TARGET_NOT_WORKSPACE_MEMBER')
  return data
}

export const updateProjectPermission = async (userId, id, targetUserId, input = {}) => {
  const project = await getProjectById(id)
  assertTeamProjectPermissionsScope(project)
  await assertProjectCanEdit(userId, project)
  const safeTargetUserId = String(targetUserId || '').trim()
  if (!safeTargetUserId) throw new HttpError(400, 'Target user is required', 'PROJECT_PERMISSION_TARGET_REQUIRED')
  const payload = projectPermissionSchema.parse(input || {})

  await assertTargetWorkspaceMember(project, safeTargetUserId)

  if (payload.role === 'owner') {
    const { error: projectUpdateError } = await supabase
      .from('projects')
      .update({ user_id: safeTargetUserId, updated_at: new Date().toISOString() })
      .eq('id', project.id)
    if (projectUpdateError) throw new HttpError(500, projectUpdateError.message, 'PROJECT_OWNER_UPDATE_FAILED')

    const { error: memberError } = await supabase
      .from('project_members')
      .upsert(
        {
          project_id: project.id,
          user_id: safeTargetUserId,
          role: 'owner',
          granted_by: userId
        },
        { onConflict: 'project_id,user_id' }
      )
    if (memberError) throw new HttpError(500, memberError.message, 'PROJECT_OWNER_MEMBER_UPSERT_FAILED')

    if (String(project.user_id || '') !== safeTargetUserId) {
      const { error: oldOwnerError } = await supabase
        .from('project_members')
        .delete()
        .eq('project_id', project.id)
        .eq('user_id', project.user_id)
      if (oldOwnerError) throw new HttpError(500, oldOwnerError.message, 'PROJECT_OLD_OWNER_MEMBER_DELETE_FAILED')
    }
  } else if (payload.role === 'editor') {
    if (String(project.user_id || '') !== safeTargetUserId) {
      const { error } = await supabase
        .from('project_members')
        .upsert(
          {
            project_id: project.id,
            user_id: safeTargetUserId,
            role: 'editor',
            granted_by: userId
          },
          { onConflict: 'project_id,user_id' }
        )
      if (error) throw new HttpError(500, error.message, 'PROJECT_EDITOR_MEMBER_UPSERT_FAILED')
    }
  } else {
    if (String(project.user_id || '') === safeTargetUserId) {
      throw new HttpError(400, 'Transfer project ownership before demoting the owner', 'PROJECT_OWNER_DEMOTION_REQUIRES_TRANSFER')
    }
    const { error } = await supabase
      .from('project_members')
      .delete()
      .eq('project_id', project.id)
      .eq('user_id', safeTargetUserId)
    if (error) throw new HttpError(500, error.message, 'PROJECT_MEMBER_DELETE_FAILED')
  }

  return getProjectPermissions(userId, project.id)
}
