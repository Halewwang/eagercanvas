import { supabase } from '../config/supabase.js'
import { HttpError } from '../utils/http.js'

const PROJECT_ACCESS = Object.freeze({
  owner: 'owner',
  editor: 'editor',
  viewer: 'viewer',
  none: 'none'
})

const PROJECT_ACCESS_PRIORITY = Object.freeze({
  [PROJECT_ACCESS.none]: 0,
  [PROJECT_ACCESS.viewer]: 1,
  [PROJECT_ACCESS.editor]: 2,
  [PROJECT_ACCESS.owner]: 3
})

const isTeamProject = (project = {}) => String(project.access_mode || '') === 'team'

const normalizeProjectAccess = (role = '') => {
  const normalized = String(role || '').trim()
  return Object.prototype.hasOwnProperty.call(PROJECT_ACCESS_PRIORITY, normalized)
    ? normalized
    : PROJECT_ACCESS.none
}

const assignProjectAccess = (accessByProjectId, projectId, role) => {
  const normalized = normalizeProjectAccess(role)
  const current = normalizeProjectAccess(accessByProjectId.get(projectId))
  if (PROJECT_ACCESS_PRIORITY[normalized] > PROJECT_ACCESS_PRIORITY[current]) {
    accessByProjectId.set(projectId, normalized)
  }
}

const getProjectMemberRole = async (userId, projectId, { supabaseClient = supabase } = {}) => {
  if (!userId || !projectId) return ''
  const { data, error } = await supabaseClient
    .from('project_members')
    .select('role')
    .eq('project_id', projectId)
    .eq('user_id', userId)
    .maybeSingle()

  if (error) throw new HttpError(500, error.message, 'PROJECT_MEMBER_QUERY_FAILED')
  return String(data?.role || '')
}

const getWorkspaceMemberRole = async (userId, workspaceId, { supabaseClient = supabase } = {}) => {
  if (!userId || !workspaceId) return ''
  const { data, error } = await supabaseClient
    .from('workspace_members')
    .select('role')
    .eq('workspace_id', workspaceId)
    .eq('user_id', userId)
    .maybeSingle()

  if (error) throw new HttpError(500, error.message, 'WORKSPACE_MEMBER_QUERY_FAILED')
  return String(data?.role || '')
}

export const resolveProjectAccess = async (userId, project = {}, options = {}) => {
  const normalizedUserId = String(userId || '').trim()
  if (!normalizedUserId || !project?.id) return PROJECT_ACCESS.none

  if (String(project.user_id || '') === normalizedUserId) return PROJECT_ACCESS.owner

  const workspaceRole = isTeamProject(project)
    ? await getWorkspaceMemberRole(normalizedUserId, project.workspace_id, options)
    : ''
  if (workspaceRole === PROJECT_ACCESS.owner) return PROJECT_ACCESS.owner

  const projectRole = await getProjectMemberRole(normalizedUserId, project.id, options)
  if (projectRole === PROJECT_ACCESS.owner) return PROJECT_ACCESS.owner
  if (projectRole === PROJECT_ACCESS.editor) return PROJECT_ACCESS.editor
  if (projectRole === PROJECT_ACCESS.viewer) return PROJECT_ACCESS.viewer

  if (workspaceRole) {
    return PROJECT_ACCESS.viewer
  }

  return PROJECT_ACCESS.none
}

export const resolveProjectListAccessMap = async (userId, rows = [], options = {}) => {
  const normalizedUserId = String(userId || '').trim()
  const projects = (Array.isArray(rows) ? rows : []).filter((project) => project?.id)
  const accessByProjectId = new Map(projects.map((project) => [project.id, PROJECT_ACCESS.none]))
  if (!normalizedUserId || !projects.length) return accessByProjectId

  const supabaseClient = options.supabaseClient || supabase
  const directSharedIds = options.directSharedIds instanceof Set
    ? options.directSharedIds
    : new Set(options.directSharedIds || [])

  const nonOwnedProjects = []
  for (const project of projects) {
    if (String(project.user_id || '') === normalizedUserId) {
      accessByProjectId.set(project.id, PROJECT_ACCESS.owner)
      continue
    }
    if (directSharedIds.has(project.id)) {
      accessByProjectId.set(project.id, PROJECT_ACCESS.viewer)
    }
    nonOwnedProjects.push(project)
  }

  const projectIds = Array.from(new Set(nonOwnedProjects.map((project) => project.id).filter(Boolean)))
  if (projectIds.length) {
    const { data, error } = await supabaseClient
      .from('project_members')
      .select('project_id, role')
      .eq('user_id', normalizedUserId)
      .in('project_id', projectIds)

    if (error) throw new HttpError(500, error.message, 'PROJECT_MEMBER_QUERY_FAILED')
    ;(data || []).forEach((member) => {
      assignProjectAccess(accessByProjectId, member.project_id, member.role)
    })
  }

  const workspaceIds = Array.from(new Set(nonOwnedProjects
    .filter((project) => (
      isTeamProject(project) &&
      project.workspace_id
    ))
    .map((project) => project.workspace_id)))

  if (workspaceIds.length) {
    const { data, error } = await supabaseClient
      .from('workspace_members')
      .select('workspace_id, role')
      .eq('user_id', normalizedUserId)
      .in('workspace_id', workspaceIds)

    if (error) throw new HttpError(500, error.message, 'WORKSPACE_MEMBER_QUERY_FAILED')
    const roleByWorkspaceId = new Map((data || []).map((member) => [member.workspace_id, member.role]))
    nonOwnedProjects.forEach((project) => {
      const workspaceRole = roleByWorkspaceId.get(project.workspace_id)
      if (
        isTeamProject(project) &&
        workspaceRole
      ) {
        assignProjectAccess(
          accessByProjectId,
          project.id,
          workspaceRole === PROJECT_ACCESS.owner ? PROJECT_ACCESS.owner : PROJECT_ACCESS.viewer
        )
      }
    })
  }

  return accessByProjectId
}

export const assertProjectCanRead = async (userId, project, options = {}) => {
  const permission = await resolveProjectAccess(userId, project, options)
  if (permission === PROJECT_ACCESS.none) {
    throw new HttpError(404, 'Project not found', 'PROJECT_NOT_FOUND')
  }
  return permission
}

export const assertProjectCanEdit = async (userId, project, options = {}) => {
  const permission = await resolveProjectAccess(userId, project, options)
  if (permission === PROJECT_ACCESS.owner || permission === PROJECT_ACCESS.editor) return permission
  if (permission === PROJECT_ACCESS.viewer) {
    throw new HttpError(403, 'Project edit permission required', 'PROJECT_EDIT_PERMISSION_REQUIRED')
  }
  throw new HttpError(404, 'Project not found', 'PROJECT_NOT_FOUND')
}

export const createProjectEditRequest = async (userId, project, input = {}, { supabaseClient = supabase } = {}) => {
  const permission = await resolveProjectAccess(userId, project, { supabaseClient })
  if (permission !== PROJECT_ACCESS.viewer) {
    throw new HttpError(400, 'Only read-only team viewers can request edit access', 'PROJECT_EDIT_REQUEST_NOT_ALLOWED')
  }

  const { data, error } = await supabaseClient
    .from('project_edit_requests')
    .upsert(
      {
        project_id: project.id,
        requester_user_id: userId,
        status: 'pending',
        message: String(input?.message || '').trim() || null,
        updated_at: new Date().toISOString()
      },
      { onConflict: 'project_id,requester_user_id,status' }
    )
    .select('*')
    .single()

  if (error) throw new HttpError(500, error.message, 'PROJECT_EDIT_REQUEST_CREATE_FAILED')
  return data
}

export const listProjectEditRequests = async (userId, project, { supabaseClient = supabase } = {}) => {
  await assertProjectCanEdit(userId, project, { supabaseClient })
  const { data, error } = await supabaseClient
    .from('project_edit_requests')
    .select('*')
    .eq('project_id', project.id)
    .eq('status', 'pending')
    .order('created_at', { ascending: true })

  if (error) throw new HttpError(500, error.message, 'PROJECT_EDIT_REQUEST_LIST_FAILED')
  return data || []
}

export const reviewProjectEditRequest = async (userId, project, requestId, decision, { supabaseClient = supabase } = {}) => {
  await assertProjectCanEdit(userId, project, { supabaseClient })
  const status = decision === 'approve' ? 'approved' : 'rejected'
  const reviewedAt = new Date().toISOString()

  const { data: request, error: requestError } = await supabaseClient
    .from('project_edit_requests')
    .update({
      status,
      reviewer_user_id: userId,
      reviewed_at: reviewedAt,
      updated_at: reviewedAt
    })
    .eq('id', requestId)
    .eq('project_id', project.id)
    .eq('status', 'pending')
    .select('*')
    .maybeSingle()

  if (requestError) throw new HttpError(500, requestError.message, 'PROJECT_EDIT_REQUEST_REVIEW_FAILED')
  if (!request) throw new HttpError(404, 'Edit request not found', 'PROJECT_EDIT_REQUEST_NOT_FOUND')

  if (status === 'approved') {
    const { error: memberError } = await supabaseClient
      .from('project_members')
      .upsert(
        {
          project_id: project.id,
          user_id: request.requester_user_id,
          role: 'editor',
          granted_by: userId
        },
        { onConflict: 'project_id,user_id' }
      )
    if (memberError) throw new HttpError(500, memberError.message, 'PROJECT_MEMBER_GRANT_FAILED')
  }

  return request
}

const getRequesterProfiles = async (userIds = [], { supabaseClient = supabase } = {}) => {
  const ids = Array.from(new Set((userIds || []).filter(Boolean)))
  if (!ids.length) return new Map()

  const [{ data: users }, { data: profiles }] = await Promise.all([
    supabaseClient.from('users').select('id, email').in('id', ids),
    supabaseClient.from('user_profiles').select('user_id, display_name, username, avatar_url').in('user_id', ids)
  ])

  const usersById = new Map((users || []).map((user) => [user.id, user]))
  const profilesById = new Map((profiles || []).map((profile) => [profile.user_id, profile]))
  return new Map(ids.map((id) => {
    const user = usersById.get(id) || {}
    const profile = profilesById.get(id) || {}
    return [id, {
      email: user.email || '',
      displayName: profile.display_name || user.email || 'Workspace member',
      username: profile.username || '',
      avatarUrl: profile.avatar_url || ''
    }]
  }))
}

const queryRows = async (query, errorCode) => {
  const { data, error } = await query
  if (error) throw new HttpError(500, error.message, errorCode)
  return data || []
}

const addProjects = (byId, rows = []) => {
  ;(rows || []).forEach((row) => {
    if (row?.id) byId.set(row.id, row)
  })
}

export const listReviewableProjectEditRequests = async (userId, { supabaseClient = supabase } = {}) => {
  const normalizedUserId = String(userId || '').trim()
  if (!normalizedUserId) return []

  const [workspaceOwnerRows, projectMemberRows] = await Promise.all([
    queryRows(
      supabaseClient
        .from('workspace_members')
        .select('workspace_id, role')
        .eq('user_id', normalizedUserId)
        .eq('role', PROJECT_ACCESS.owner),
      'WORKSPACE_OWNER_QUERY_FAILED'
    ),
    queryRows(
      supabaseClient
        .from('project_members')
        .select('project_id, role')
        .eq('user_id', normalizedUserId)
        .in('role', [PROJECT_ACCESS.owner, PROJECT_ACCESS.editor]),
      'PROJECT_MEMBER_QUERY_FAILED'
    )
  ])

  const workspaceIds = Array.from(new Set(workspaceOwnerRows.map((row) => row.workspace_id).filter(Boolean)))
  const directProjectIds = Array.from(new Set(projectMemberRows.map((row) => row.project_id).filter(Boolean)))
  const projectsById = new Map()

  addProjects(projectsById, await queryRows(
    supabaseClient
      .from('projects')
      .select('id, user_id, workspace_id, access_mode, name, thumbnail_url, updated_at')
      .eq('user_id', normalizedUserId),
    'PROJECT_REVIEW_OWNED_QUERY_FAILED'
  ))

  if (directProjectIds.length) {
    addProjects(projectsById, await queryRows(
      supabaseClient
        .from('projects')
        .select('id, user_id, workspace_id, access_mode, name, thumbnail_url, updated_at')
        .in('id', directProjectIds),
      'PROJECT_REVIEW_MEMBER_QUERY_FAILED'
    ))
  }

  if (workspaceIds.length) {
    addProjects(projectsById, await queryRows(
      supabaseClient
        .from('projects')
        .select('id, user_id, workspace_id, access_mode, name, thumbnail_url, updated_at')
        .eq('access_mode', 'team')
        .in('workspace_id', workspaceIds),
      'PROJECT_REVIEW_WORKSPACE_QUERY_FAILED'
    ))
  }

  const projectIds = Array.from(projectsById.keys())
  if (!projectIds.length) return []

  const requests = await queryRows(
    supabaseClient
      .from('project_edit_requests')
      .select('*')
      .eq('status', 'pending')
      .in('project_id', projectIds)
      .order('created_at', { ascending: true }),
    'PROJECT_EDIT_REQUEST_INBOX_FAILED'
  )

  const requesterProfiles = await getRequesterProfiles(
    requests.map((request) => request.requester_user_id),
    { supabaseClient }
  )

  return requests.map((request) => {
    const project = projectsById.get(request.project_id) || {}
    const requester = requesterProfiles.get(request.requester_user_id) || {}
    return {
      id: request.id,
      projectId: request.project_id,
      projectName: project.name || 'Untitled project',
      workspaceId: project.workspace_id || '',
      requesterUserId: request.requester_user_id,
      requesterDisplayName: requester.displayName || 'Workspace member',
      requesterEmail: requester.email || '',
      requesterAvatarUrl: requester.avatarUrl || '',
      message: request.message || '',
      createdAt: request.created_at,
      updatedAt: request.updated_at
    }
  })
}
