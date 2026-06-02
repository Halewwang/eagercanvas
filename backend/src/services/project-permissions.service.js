import { supabase } from '../config/supabase.js'
import { HttpError } from '../utils/http.js'

const PROJECT_ACCESS = Object.freeze({
  owner: 'owner',
  editor: 'editor',
  viewer: 'viewer',
  none: 'none'
})

const isTeamProject = (project = {}) => String(project.access_mode || '') === 'team'

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

const isWorkspaceMember = async (userId, workspaceId, { supabaseClient = supabase } = {}) => {
  if (!userId || !workspaceId) return false
  const { data, error } = await supabaseClient
    .from('workspace_members')
    .select('role')
    .eq('workspace_id', workspaceId)
    .eq('user_id', userId)
    .maybeSingle()

  if (error) throw new HttpError(500, error.message, 'WORKSPACE_MEMBER_QUERY_FAILED')
  return !!data
}

export const resolveProjectAccess = async (userId, project = {}, options = {}) => {
  const normalizedUserId = String(userId || '').trim()
  if (!normalizedUserId || !project?.id) return PROJECT_ACCESS.none

  if (String(project.user_id || '') === normalizedUserId) return PROJECT_ACCESS.owner

  const projectRole = await getProjectMemberRole(normalizedUserId, project.id, options)
  if (projectRole === PROJECT_ACCESS.owner) return PROJECT_ACCESS.owner
  if (projectRole === PROJECT_ACCESS.editor) return PROJECT_ACCESS.editor

  if (isTeamProject(project) && await isWorkspaceMember(normalizedUserId, project.workspace_id, options)) {
    return PROJECT_ACCESS.viewer
  }

  return PROJECT_ACCESS.none
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
