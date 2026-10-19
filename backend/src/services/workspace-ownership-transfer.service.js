import { supabase } from '../config/supabase.js'
import { HttpError } from '../utils/http.js'
import { throwProjectOwnerWriteError } from './project-owner-eligibility.js'

const PLAN_TABLE = 'admin_workspace_transfer_plans'
const isActiveUser = (user = {}) => !!user?.id && String(user.status || 'active') === 'active' && !user.deleted_at
const unique = (items = []) => Array.from(new Set((items || []).filter(Boolean)))

const queryRows = async (query, errorCode) => {
  const { data, error } = await query
  if (error) throw new HttpError(500, error.message, errorCode)
  return data || []
}

const groupBy = (rows = [], key) => {
  const grouped = new Map()
  for (const row of rows || []) {
    if (!row?.[key]) continue
    if (!grouped.has(row[key])) grouped.set(row[key], [])
    grouped.get(row[key]).push(row)
  }
  return grouped
}

const chooseTransferTarget = ({ workspace, ownerMembers = [], usersById, operatorUserId }) => {
  if (isActiveUser(usersById.get(workspace.created_by))) return workspace.created_by
  const owner = ownerMembers.find((member) => isActiveUser(usersById.get(member.user_id)))
  if (owner?.user_id) return owner.user_id
  if (isActiveUser(usersById.get(operatorUserId))) return operatorUserId
  return String(operatorUserId || '').trim()
}

const resolveTransferEventId = async (client, fromUserId, explicitEventId = '') => {
  if (String(explicitEventId || '').trim()) return String(explicitEventId).trim()
  const users = await queryRows(
    client.from('users').select('id,status,archive_event_id,suspension_event_id').eq('id', fromUserId),
    'WORKSPACE_TRANSFER_EVENT_QUERY_FAILED'
  )
  const user = users[0]
  const eventId = user?.status === 'archiving' ? user.archive_event_id : user?.suspension_event_id
  if (!eventId) throw new HttpError(409, 'Lifecycle transfer event is unavailable', 'WORKSPACE_TRANSFER_EVENT_UNAVAILABLE')
  return eventId
}

const executeAtomicPlan = async (client, plan) => {
  const { error } = await client.rpc('admin_transfer_workspace_projects_atomic', {
    p_event_id: plan.eventId,
    p_workspace_id: plan.workspaceId,
    p_project_ids: plan.projectIds,
    p_from_user_id: plan.fromUserId,
    p_to_user_id: plan.toUserId,
    p_operator_user_id: plan.operatorUserId || null
  })
  if (error) throwProjectOwnerWriteError(error, 'WORKSPACE_TRANSFER_ATOMIC_FAILED')
}

export const transferSuspendedUserTeamProjects = async ({
  targetUserId,
  operatorUserId,
  transferEventId = '',
  reason = '',
  supabaseClient = supabase
} = {}) => {
  const fromUserId = String(targetUserId || '').trim()
  const safeOperatorUserId = String(operatorUserId || '').trim()
  if (!fromUserId) return { transferredProjectCount: 0, transfers: [] }
  const eventId = await resolveTransferEventId(supabaseClient, fromUserId, transferEventId)

  const persisted = await queryRows(
    supabaseClient.from(PLAN_TABLE).select('event_id,workspace_id,project_id,from_user_id,to_user_id,operator_user_id').eq('event_id', eventId),
    'WORKSPACE_TRANSFER_PLAN_QUERY_FAILED'
  )
  const persistedByWorkspace = groupBy(persisted, 'workspace_id')
  const plans = []
  for (const [workspaceId, rows] of persistedByWorkspace) {
    plans.push({
      eventId,
      workspaceId,
      projectIds: unique(rows.map((row) => row.project_id)),
      fromUserId: rows[0].from_user_id,
      toUserId: rows[0].to_user_id,
      operatorUserId: rows[0].operator_user_id
    })
  }

  const plannedProjectIds = new Set(plans.flatMap((plan) => plan.projectIds))
  const ownedProjects = await queryRows(
    supabaseClient.from('projects').select('id,user_id,workspace_id,access_mode,name').eq('user_id', fromUserId).eq('access_mode', 'team'),
    'WORKSPACE_TRANSFER_PROJECT_QUERY_FAILED'
  )
  const projects = ownedProjects.filter((project) => !plannedProjectIds.has(project.id))

  if (projects.length) {
    const workspaceIds = unique(projects.map((project) => project.workspace_id))
    const workspaces = await queryRows(
      supabaseClient.from('workspaces').select('id,kind,created_by').in('id', workspaceIds),
      'WORKSPACE_TRANSFER_WORKSPACE_QUERY_FAILED'
    )
    const workspaceMembers = await queryRows(
      supabaseClient.from('workspace_members').select('workspace_id,user_id,role').in('workspace_id', workspaceIds),
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
    const users = candidateUserIds.length ? await queryRows(
      supabaseClient.from('users').select('id,status,deleted_at').in('id', candidateUserIds),
      'WORKSPACE_TRANSFER_USER_QUERY_FAILED'
    ) : []
    const usersById = new Map(users.map((user) => [user.id, user]))
    if (safeOperatorUserId && !usersById.has(safeOperatorUserId)) {
      usersById.set(safeOperatorUserId, { id: safeOperatorUserId, status: 'active', deleted_at: null })
    }
    const workspaceById = new Map(workspaces.map((workspace) => [workspace.id, workspace]))
    for (const [workspaceId, workspaceProjects] of groupBy(projects, 'workspace_id')) {
      const toUserId = chooseTransferTarget({
        workspace: workspaceById.get(workspaceId) || { created_by: '' },
        ownerMembers: ownerMembersByWorkspace.get(workspaceId) || [],
        usersById,
        operatorUserId: safeOperatorUserId
      })
      if (!toUserId) throw new HttpError(409, 'No active workspace owner is available for project transfer', 'WORKSPACE_TRANSFER_TARGET_UNAVAILABLE')
      plans.push({ eventId, workspaceId, projectIds: unique(workspaceProjects.map((p) => p.id)), fromUserId, toUserId, operatorUserId: safeOperatorUserId })
    }
  }

  for (const plan of plans) await executeAtomicPlan(supabaseClient, plan)
  return {
    transferredProjectCount: unique(plans.flatMap((plan) => plan.projectIds)).length,
    transfers: plans.map((plan) => ({
      workspaceId: plan.workspaceId,
      fromUserId: plan.fromUserId,
      toUserId: plan.toUserId,
      reason,
      projectIds: plan.projectIds
    }))
  }
}
