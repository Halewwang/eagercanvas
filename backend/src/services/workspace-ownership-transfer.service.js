import { supabase } from '../config/supabase.js'
import { HttpError } from '../utils/http.js'

const isActiveUser = (user = {}) => (
  !!user?.id &&
  String(user.status || 'active') === 'active' &&
  !user.deleted_at
)

const unique = (items = []) => Array.from(new Set((items || []).filter(Boolean)))

const queryRows = async (query, errorCode) => {
  const { data, error } = await query
  if (error) throw new HttpError(500, error.message, errorCode)
  return data || []
}

const groupBy = (rows = [], key) => {
  const grouped = new Map()
  for (const row of rows || []) {
    const value = row?.[key]
    if (!value) continue
    if (!grouped.has(value)) grouped.set(value, [])
    grouped.get(value).push(row)
  }
  return grouped
}

const chooseTransferTarget = ({ workspace, ownerMembers = [], usersById, operatorUserId }) => {
  const creator = usersById.get(workspace.created_by)
  if (isActiveUser(creator)) return creator.id

  const activeOwner = ownerMembers.find((member) => isActiveUser(usersById.get(member.user_id)))
  if (activeOwner?.user_id) return activeOwner.user_id

  const operator = usersById.get(operatorUserId)
  if (isActiveUser(operator)) return operator.id
  return String(operatorUserId || '').trim()
}

const transferWorkspaceProjects = async ({
  workspaceId,
  projects,
  toUserId,
  fromUserId,
  operatorUserId,
  supabaseClient
}) => {
  const projectIds = unique(projects.map((project) => project.id))
  if (!workspaceId || !toUserId || !projectIds.length) return

  const { error: workspaceMemberError } = await supabaseClient
    .from('workspace_members')
    .upsert(
      {
        workspace_id: workspaceId,
        user_id: toUserId,
        role: 'owner'
      },
      { onConflict: 'workspace_id,user_id' }
    )
  if (workspaceMemberError) throw new HttpError(500, workspaceMemberError.message, 'WORKSPACE_TRANSFER_OWNER_UPSERT_FAILED')

  const { error: projectUpdateError } = await supabaseClient
    .from('projects')
    .update({ user_id: toUserId })
    .in('id', projectIds)
  if (projectUpdateError) throw new HttpError(500, projectUpdateError.message, 'WORKSPACE_TRANSFER_PROJECT_UPDATE_FAILED')

  const { error: projectMemberError } = await supabaseClient
    .from('project_members')
    .upsert(
      projectIds.map((projectId) => ({
        project_id: projectId,
        user_id: toUserId,
        role: 'owner',
        granted_by: operatorUserId || null
      })),
      { onConflict: 'project_id,user_id' }
    )
  if (projectMemberError) throw new HttpError(500, projectMemberError.message, 'WORKSPACE_TRANSFER_PROJECT_MEMBER_UPSERT_FAILED')

  const { error: oldMemberError } = await supabaseClient
    .from('project_members')
    .delete()
    .eq('user_id', fromUserId)
    .in('project_id', projectIds)
  if (oldMemberError) throw new HttpError(500, oldMemberError.message, 'WORKSPACE_TRANSFER_OLD_PROJECT_MEMBER_DELETE_FAILED')
}

export const transferSuspendedUserTeamProjects = async ({
  targetUserId,
  operatorUserId,
  reason = '',
  supabaseClient = supabase
} = {}) => {
  const fromUserId = String(targetUserId || '').trim()
  const safeOperatorUserId = String(operatorUserId || '').trim()
  if (!fromUserId) return { transferredProjectCount: 0, transfers: [] }

  const projects = await queryRows(
    supabaseClient
      .from('projects')
      .select('id, user_id, workspace_id, access_mode, name')
      .eq('user_id', fromUserId)
      .eq('access_mode', 'team'),
    'WORKSPACE_TRANSFER_PROJECT_QUERY_FAILED'
  )
  if (!projects.length) return { transferredProjectCount: 0, transfers: [] }

  const workspaceIds = unique(projects.map((project) => project.workspace_id))
  const workspaces = await queryRows(
    supabaseClient
      .from('workspaces')
      .select('id, kind, created_by')
      .in('id', workspaceIds),
    'WORKSPACE_TRANSFER_WORKSPACE_QUERY_FAILED'
  )
  const workspaceById = new Map(workspaces.map((workspace) => [workspace.id, workspace]))

  const workspaceMembers = await queryRows(
    supabaseClient
      .from('workspace_members')
      .select('workspace_id, user_id, role')
      .in('workspace_id', workspaceIds),
    'WORKSPACE_TRANSFER_MEMBER_QUERY_FAILED'
  )
  const ownerMembersByWorkspace = groupBy(
    workspaceMembers.filter((member) => member.role === 'owner' && member.user_id !== fromUserId),
    'workspace_id'
  )

  const candidateUserIds = unique([
    safeOperatorUserId,
    ...workspaces.map((workspace) => workspace.created_by),
    ...workspaceMembers.map((member) => member.user_id)
  ])
  const users = candidateUserIds.length
    ? await queryRows(
      supabaseClient
        .from('users')
        .select('id, status, deleted_at')
        .in('id', candidateUserIds),
      'WORKSPACE_TRANSFER_USER_QUERY_FAILED'
    )
    : []
  const usersById = new Map(users.map((user) => [user.id, user]))
  if (safeOperatorUserId && !usersById.has(safeOperatorUserId)) {
    usersById.set(safeOperatorUserId, { id: safeOperatorUserId, status: 'active', deleted_at: null })
  }

  const projectsByWorkspace = groupBy(projects, 'workspace_id')
  const transfers = []
  for (const [workspaceId, workspaceProjects] of projectsByWorkspace.entries()) {
    const workspace = workspaceById.get(workspaceId) || { id: workspaceId, created_by: '' }
    const toUserId = chooseTransferTarget({
      workspace,
      ownerMembers: ownerMembersByWorkspace.get(workspaceId) || [],
      usersById,
      operatorUserId: safeOperatorUserId
    })
    if (!toUserId) {
      throw new HttpError(409, 'No active workspace owner is available for project transfer', 'WORKSPACE_TRANSFER_TARGET_UNAVAILABLE')
    }

    await transferWorkspaceProjects({
      workspaceId,
      projects: workspaceProjects,
      toUserId,
      fromUserId,
      operatorUserId: safeOperatorUserId,
      supabaseClient
    })
    transfers.push({
      workspaceId,
      fromUserId,
      toUserId,
      reason,
      projectIds: workspaceProjects.map((project) => project.id)
    })
  }

  return {
    transferredProjectCount: projects.length,
    transfers
  }
}
