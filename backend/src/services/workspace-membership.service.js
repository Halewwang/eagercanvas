import { z } from 'zod'
import { supabase } from '../config/supabase.js'
import { HttpError } from '../utils/http.js'
import { isMissingColumnError, isMissingRelationError } from '../utils/supabase-schema.js'

export const PUBLIC_WORKSPACE_SLUG = 'shared-workspace'

export const WORKSPACE_KIND = Object.freeze({
  personal: 'personal',
  public: 'public',
  team: 'team'
})

const teamWorkspaceSchema = z.object({
  name: z.string().trim().min(1).max(80),
  avatarUrl: z.string().trim().max(200000).optional().nullable()
})

const slugify = (value = '') => {
  const slug = String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48)
  return slug || 'workspace'
}

const normalizeAvatarUrl = (value) => {
  const raw = String(value || '').trim()
  if (!raw) return null
  if (/^https?:\/\//i.test(raw)) return raw
  if (/^data:image\//i.test(raw)) return raw
  return null
}

export const getWorkspaceKind = (row = {}) => {
  const kind = String(row?.kind || '').trim()
  if (kind) return kind
  const slug = String(row?.slug || '').trim()
  if (row?.is_default || slug === PUBLIC_WORKSPACE_SLUG) return WORKSPACE_KIND.public
  if (slug.startsWith('personal-')) return WORKSPACE_KIND.personal
  return WORKSPACE_KIND.team
}

const getWorkspaceSchemaVersion = (row = {}) => (
  Object.prototype.hasOwnProperty.call(row || {}, 'kind') ? 'modern' : 'legacy'
)

export const mapWorkspace = (row, role = 'member', memberCount = 1) => ({
  id: row.id,
  slug: row.slug,
  name: row.name,
  kind: getWorkspaceKind(row),
  role,
  avatarUrl: row.avatar_url || '',
  createdBy: row.created_by || '',
  memberCount: Number(memberCount || 0),
  schemaVersion: getWorkspaceSchemaVersion(row)
})

const isMissingWorkspaceModernColumn = (error) => (
  isMissingColumnError(error, 'workspaces', 'kind') ||
  isMissingColumnError(error, 'workspaces', 'avatar_url') ||
  isMissingColumnError(error, 'workspaces', 'created_by')
)

const upsertWorkspaceWithLegacyFallback = async ({
  row,
  legacyRow,
  onConflict = 'slug',
  errorCode,
  supabaseClient = supabase
}) => {
  const { data, error } = await supabaseClient
    .from('workspaces')
    .upsert(row, { onConflict })
    .select('*')
    .single()

  if (!error) return data

  if (legacyRow && isMissingWorkspaceModernColumn(error)) {
    const { data: legacyData, error: legacyError } = await supabaseClient
      .from('workspaces')
      .upsert(legacyRow, { onConflict })
      .select('*')
      .single()

    if (!legacyError) return legacyData
    throw new HttpError(500, legacyError.message, errorCode)
  }

  throw new HttpError(500, error.message, errorCode)
}

const getUserProfileIdentity = async (userId, { supabaseClient = supabase } = {}) => {
  const { data, error } = await supabaseClient
    .from('user_profiles')
    .select('display_name, username, avatar_url')
    .eq('user_id', userId)
    .maybeSingle()

  if (!error) return data || {}

  if (isMissingColumnError(error, 'user_profiles', 'username')) {
    const { data: legacyProfile, error: legacyError } = await supabaseClient
      .from('user_profiles')
      .select('display_name, avatar_url')
      .eq('user_id', userId)
      .maybeSingle()
    if (!legacyError) return legacyProfile || {}
    throw new HttpError(500, legacyError.message, 'PROFILE_QUERY_FAILED')
  }

  throw new HttpError(500, error.message, 'PROFILE_QUERY_FAILED')
}

const getUserIdentity = async (userId, { supabaseClient = supabase } = {}) => {
  const [{ data: user, error: userError }, profile] = await Promise.all([
    supabaseClient
      .from('users')
      .select('email')
      .eq('id', userId)
      .maybeSingle(),
    getUserProfileIdentity(userId, { supabaseClient })
  ])

  if (userError) throw new HttpError(500, userError.message, 'USER_QUERY_FAILED')

  return {
    email: user?.email || '',
    displayName: String(profile?.display_name || '').trim(),
    username: String(profile?.username || '').trim(),
    avatarUrl: profile?.avatar_url || ''
  }
}

const countWorkspaceMembers = async (workspaceId, { supabaseClient = supabase } = {}) => {
  const { count, error } = await supabaseClient
    .from('workspace_members')
    .select('user_id', { count: 'exact', head: true })
    .eq('workspace_id', workspaceId)

  if (error) return 0
  return count || 0
}

export const ensurePublicWorkspace = async ({ supabaseClient = supabase } = {}) => {
  return upsertWorkspaceWithLegacyFallback({
    row: {
      slug: PUBLIC_WORKSPACE_SLUG,
      name: 'Community',
      kind: WORKSPACE_KIND.public,
      is_default: true
    },
    legacyRow: {
      slug: PUBLIC_WORKSPACE_SLUG,
      name: 'Community',
      is_default: true
    },
    errorCode: 'WORKSPACE_ENSURE_FAILED',
    supabaseClient
  })
}

export const ensurePersonalWorkspace = async (userId, { supabaseClient = supabase } = {}) => {
  const identity = await getUserIdentity(userId, { supabaseClient })
  const slug = `personal-${userId}`
  const name = `${userId} Space`

  const workspace = await upsertWorkspaceWithLegacyFallback({
    row: {
      slug,
      name,
      kind: WORKSPACE_KIND.personal,
      is_default: false,
      avatar_url: identity.avatarUrl || null,
      created_by: userId
    },
    legacyRow: {
      slug,
      name,
      is_default: false
    },
    errorCode: 'PERSONAL_WORKSPACE_ENSURE_FAILED',
    supabaseClient
  })

  const { error: memberError } = await supabaseClient
    .from('workspace_members')
    .upsert(
      {
        workspace_id: workspace.id,
        user_id: userId,
        role: 'owner'
      },
      { onConflict: 'workspace_id,user_id' }
    )

  if (memberError) throw new HttpError(500, memberError.message, 'PERSONAL_WORKSPACE_MEMBER_FAILED')
  return workspace
}

export const getWorkspaceMembership = async (userId, workspaceId, { supabaseClient = supabase } = {}) => {
  if (!userId || !workspaceId) return null
  const { data, error } = await supabaseClient
    .from('workspace_members')
    .select('workspace_id, user_id, role')
    .eq('workspace_id', workspaceId)
    .eq('user_id', userId)
    .maybeSingle()

  if (error) throw new HttpError(500, error.message, 'WORKSPACE_MEMBERSHIP_QUERY_FAILED')
  return data || null
}

export const getWorkspaceById = async (workspaceId, { supabaseClient = supabase } = {}) => {
  const { data, error } = await supabaseClient
    .from('workspaces')
    .select('*')
    .eq('id', workspaceId)
    .maybeSingle()

  if (error) throw new HttpError(500, error.message, 'WORKSPACE_QUERY_FAILED')
  return data || null
}

export const assertWorkspaceMember = async (userId, workspaceId, { supabaseClient = supabase } = {}) => {
  const [workspace, membership] = await Promise.all([
    getWorkspaceById(workspaceId, { supabaseClient }),
    getWorkspaceMembership(userId, workspaceId, { supabaseClient })
  ])

  if (!workspace || !membership || getWorkspaceKind(workspace) === WORKSPACE_KIND.public) {
    throw new HttpError(404, 'Workspace not found', 'WORKSPACE_NOT_FOUND')
  }

  return {
    workspace,
    membership,
    mapped: mapWorkspace(workspace, membership.role, await countWorkspaceMembers(workspace.id, { supabaseClient }))
  }
}

export const assertWorkspaceOwner = async (userId, workspaceId, options = {}) => {
  const context = await assertWorkspaceMember(userId, workspaceId, options)
  if (context.membership.role !== 'owner') {
    throw new HttpError(403, 'Workspace owner permission required', 'WORKSPACE_OWNER_REQUIRED')
  }
  return context
}

const getPreferredWorkspaceId = async (userId, { supabaseClient = supabase } = {}) => {
  const { data, error } = await supabaseClient
    .from('user_workspace_preferences')
    .select('active_workspace_id')
    .eq('user_id', userId)
    .maybeSingle()

  if (isMissingRelationError(error, 'user_workspace_preferences')) return ''
  if (error) throw new HttpError(500, error.message, 'WORKSPACE_PREFERENCE_QUERY_FAILED')
  return data?.active_workspace_id || ''
}

export const setActiveWorkspace = async (userId, workspaceId, { supabaseClient = supabase } = {}) => {
  const { workspace, membership, mapped } = await assertWorkspaceMember(userId, workspaceId, { supabaseClient })

  if (getWorkspaceKind(workspace) === WORKSPACE_KIND.public) {
    throw new HttpError(400, 'Community cannot be selected as a project workspace', 'PUBLIC_WORKSPACE_NOT_SELECTABLE')
  }

  const { error } = await supabaseClient
    .from('user_workspace_preferences')
    .upsert(
      {
        user_id: userId,
        active_workspace_id: workspace.id,
        updated_at: new Date().toISOString()
      },
      { onConflict: 'user_id' }
    )

  if (isMissingRelationError(error, 'user_workspace_preferences')) {
    return mapWorkspace(workspace, membership.role, mapped.memberCount)
  }
  if (error) throw new HttpError(500, error.message, 'WORKSPACE_SELECT_FAILED')
  return mapWorkspace(workspace, membership.role, mapped.memberCount)
}

export const getActiveWorkspace = async (userId, { supabaseClient = supabase } = {}) => {
  await ensurePublicWorkspace({ supabaseClient })
  const personalWorkspace = await ensurePersonalWorkspace(userId, { supabaseClient })
  const preferredWorkspaceId = await getPreferredWorkspaceId(userId, { supabaseClient })

  if (preferredWorkspaceId) {
    const workspace = await getWorkspaceById(preferredWorkspaceId, { supabaseClient })
    const membership = await getWorkspaceMembership(userId, preferredWorkspaceId, { supabaseClient })
    if (workspace && membership && getWorkspaceKind(workspace) !== WORKSPACE_KIND.public) {
      return mapWorkspace(workspace, membership.role, await countWorkspaceMembers(workspace.id, { supabaseClient }))
    }
  }

  return setActiveWorkspace(userId, personalWorkspace.id, { supabaseClient })
}

export const listUserWorkspaces = async (userId, { supabaseClient = supabase } = {}) => {
  const activeWorkspace = await getActiveWorkspace(userId, { supabaseClient })
  const { data: memberships, error: membershipError } = await supabaseClient
    .from('workspace_members')
    .select('workspace_id, role')
    .eq('user_id', userId)

  if (membershipError) throw new HttpError(500, membershipError.message, 'WORKSPACE_LIST_MEMBERSHIP_FAILED')

  const workspaceIds = (memberships || []).map((item) => item.workspace_id).filter(Boolean)
  if (!workspaceIds.length) return { activeWorkspace, workspaces: [activeWorkspace] }

  let { data: rows, error: workspaceError } = await supabaseClient
    .from('workspaces')
    .select('*')
    .in('id', workspaceIds)
    .neq('kind', WORKSPACE_KIND.public)

  if (workspaceError && isMissingColumnError(workspaceError, 'workspaces', 'kind')) {
    const legacyResult = await supabaseClient
      .from('workspaces')
      .select('*')
      .in('id', workspaceIds)
    rows = (legacyResult.data || []).filter((row) => getWorkspaceKind(row) !== WORKSPACE_KIND.public)
    workspaceError = legacyResult.error
  }

  if (workspaceError) throw new HttpError(500, workspaceError.message, 'WORKSPACE_LIST_FAILED')

  const roleByWorkspaceId = new Map((memberships || []).map((item) => [item.workspace_id, item.role]))
  const memberCounts = new Map()
  await Promise.all((rows || []).map(async (row) => {
    memberCounts.set(row.id, await countWorkspaceMembers(row.id, { supabaseClient }))
  }))

  const workspaces = (rows || [])
    .map((row) => mapWorkspace(row, roleByWorkspaceId.get(row.id) || 'member', memberCounts.get(row.id) || 1))
    .sort((a, b) => {
      if (a.kind === WORKSPACE_KIND.personal) return -1
      if (b.kind === WORKSPACE_KIND.personal) return 1
      return a.name.localeCompare(b.name)
    })

  return { activeWorkspace, workspaces }
}

export const createTeamWorkspace = async (userId, input = {}, { supabaseClient = supabase } = {}) => {
  const payload = teamWorkspaceSchema.parse(input || {})
  const baseSlug = slugify(payload.name)
  const avatarUrl = normalizeAvatarUrl(payload.avatarUrl)
  let attempt = 0
  let workspace = null

  while (!workspace && attempt < 8) {
    const suffix = attempt === 0 ? '' : `-${attempt + 1}`
    const { data, error } = await supabaseClient
      .from('workspaces')
      .insert({
        slug: `${baseSlug}${suffix}`,
        name: payload.name,
        kind: WORKSPACE_KIND.team,
        is_default: false,
        avatar_url: avatarUrl,
        created_by: userId
      })
      .select('*')
      .single()

    if (!error) {
      workspace = data
      break
    }
    if (String(error.code || '') !== '23505') {
      throw new HttpError(500, error.message, 'WORKSPACE_CREATE_FAILED')
    }
    attempt += 1
  }

  if (!workspace) throw new HttpError(409, 'Workspace slug is already taken', 'WORKSPACE_SLUG_TAKEN')

  const { error: memberError } = await supabaseClient
    .from('workspace_members')
    .insert({
      workspace_id: workspace.id,
      user_id: userId,
      role: 'owner'
    })

  if (memberError) throw new HttpError(500, memberError.message, 'WORKSPACE_OWNER_CREATE_FAILED')

  return setActiveWorkspace(userId, workspace.id, { supabaseClient })
}

export const updateTeamWorkspace = async (userId, workspaceId, input = {}, { supabaseClient = supabase } = {}) => {
  const payload = teamWorkspaceSchema.parse(input || {})
  const { workspace, membership } = await assertWorkspaceOwner(userId, workspaceId, { supabaseClient })
  if (getWorkspaceKind(workspace) !== WORKSPACE_KIND.team) {
    throw new HttpError(400, 'Only team workspaces can be updated', 'TEAM_WORKSPACE_REQUIRED')
  }

  const avatarUrl = normalizeAvatarUrl(payload.avatarUrl)
  let { data, error } = await supabaseClient
    .from('workspaces')
    .update({
      name: payload.name,
      avatar_url: avatarUrl
    })
    .eq('id', workspaceId)
    .select('*')
    .single()

  if (error && isMissingColumnError(error, 'workspaces', 'avatar_url')) {
    const legacyResult = await supabaseClient
      .from('workspaces')
      .update({ name: payload.name })
      .eq('id', workspaceId)
      .select('*')
      .single()
    data = legacyResult.data
    error = legacyResult.error
  }

  if (error) throw new HttpError(500, error.message, 'WORKSPACE_UPDATE_FAILED')
  return mapWorkspace(data, membership.role, await countWorkspaceMembers(workspaceId, { supabaseClient }))
}

export const listWorkspaceMembers = async (userId, workspaceId, { supabaseClient = supabase } = {}) => {
  await assertWorkspaceMember(userId, workspaceId, { supabaseClient })
  const { data, error } = await supabaseClient
    .from('workspace_members')
    .select('workspace_id, user_id, role, created_at')
    .eq('workspace_id', workspaceId)
    .order('created_at', { ascending: true })

  if (error) throw new HttpError(500, error.message, 'WORKSPACE_MEMBERS_LIST_FAILED')

  const userIds = (data || []).map((item) => item.user_id).filter(Boolean)
  const profilesById = new Map()
  const emailsById = new Map()

  if (userIds.length) {
    const [{ data: profiles }, { data: users }] = await Promise.all([
      supabaseClient.from('user_profiles').select('user_id, display_name, username, avatar_url').in('user_id', userIds),
      supabaseClient.from('users').select('id, email').in('id', userIds)
    ])
    ;(profiles || []).forEach((profile) => profilesById.set(profile.user_id, profile))
    ;(users || []).forEach((user) => emailsById.set(user.id, user.email || ''))
  }

  return (data || []).map((item) => {
    const profile = profilesById.get(item.user_id) || {}
    return {
      userId: item.user_id,
      role: item.role || 'member',
      displayName: profile.display_name || emailsById.get(item.user_id) || 'Workspace member',
      username: profile.username || '',
      email: emailsById.get(item.user_id) || '',
      avatarUrl: profile.avatar_url || '',
      joinedAt: item.created_at
    }
  })
}

export const resolveProjectCreateWorkspace = async (userId, options = {}) => {
  const workspace = await getActiveWorkspace(userId, options)
  return {
    workspace,
    accessMode: workspace.kind === WORKSPACE_KIND.team ? 'team' : 'private'
  }
}

export const leaveWorkspace = async (userId, workspaceId, input = {}, { supabaseClient = supabase } = {}) => {
  const { workspace, membership } = await assertWorkspaceMember(userId, workspaceId, { supabaseClient })
  if (getWorkspaceKind(workspace) === WORKSPACE_KIND.personal) {
    throw new HttpError(400, 'Personal workspace cannot be left', 'PERSONAL_WORKSPACE_REQUIRED')
  }

  const transferToUserId = String(input?.transferToUserId || '').trim()
  const { data: ownedProjects, error: ownedProjectError } = await supabaseClient
    .from('projects')
    .select('id')
    .eq('workspace_id', workspaceId)
    .eq('user_id', userId)

  if (ownedProjectError) throw new HttpError(500, ownedProjectError.message, 'WORKSPACE_OWNED_PROJECTS_QUERY_FAILED')

  const mustTransfer = membership.role === 'owner' || (ownedProjects || []).length > 0
  if (mustTransfer) {
    if (!transferToUserId) {
      throw new HttpError(400, 'Transfer target is required before leaving', 'WORKSPACE_TRANSFER_TARGET_REQUIRED')
    }
    const targetMembership = await getWorkspaceMembership(transferToUserId, workspaceId, { supabaseClient })
    if (!targetMembership || String(transferToUserId) === String(userId)) {
      throw new HttpError(400, 'Transfer target must be another workspace member', 'WORKSPACE_TRANSFER_TARGET_INVALID')
    }

    if (membership.role === 'owner') {
      const { error: targetRoleError } = await supabaseClient
        .from('workspace_members')
        .update({ role: 'owner' })
        .eq('workspace_id', workspaceId)
        .eq('user_id', transferToUserId)
      if (targetRoleError) throw new HttpError(500, targetRoleError.message, 'WORKSPACE_OWNER_TRANSFER_FAILED')
    }

    for (const project of ownedProjects || []) {
      const { error: projectUpdateError } = await supabaseClient
        .from('projects')
        .update({ user_id: transferToUserId })
        .eq('id', project.id)
      if (projectUpdateError) throw new HttpError(500, projectUpdateError.message, 'WORKSPACE_PROJECT_TRANSFER_FAILED')

      const { error: projectMemberError } = await supabaseClient
        .from('project_members')
        .upsert(
          {
            project_id: project.id,
            user_id: transferToUserId,
            role: 'owner',
            granted_by: userId
          },
          { onConflict: 'project_id,user_id' }
        )
      if (projectMemberError) throw new HttpError(500, projectMemberError.message, 'WORKSPACE_PROJECT_MEMBER_TRANSFER_FAILED')
    }
  }

  const { error: memberDeleteError } = await supabaseClient
    .from('workspace_members')
    .delete()
    .eq('workspace_id', workspaceId)
    .eq('user_id', userId)

  if (memberDeleteError) throw new HttpError(500, memberDeleteError.message, 'WORKSPACE_LEAVE_FAILED')

  const personalWorkspace = await ensurePersonalWorkspace(userId, { supabaseClient })
  const activeWorkspace = await setActiveWorkspace(userId, personalWorkspace.id, { supabaseClient })
  return { activeWorkspace }
}

export const deleteTeamWorkspace = async (userId, workspaceId, { supabaseClient = supabase } = {}) => {
  const { workspace } = await assertWorkspaceOwner(userId, workspaceId, { supabaseClient })
  if (getWorkspaceKind(workspace) !== WORKSPACE_KIND.team) {
    throw new HttpError(400, 'Only team workspaces can be deleted', 'TEAM_WORKSPACE_REQUIRED')
  }

  const { error } = await supabaseClient
    .from('workspaces')
    .delete()
    .eq('id', workspaceId)

  if (error) throw new HttpError(500, error.message, 'WORKSPACE_DELETE_FAILED')

  const personalWorkspace = await ensurePersonalWorkspace(userId, { supabaseClient })
  const activeWorkspace = await setActiveWorkspace(userId, personalWorkspace.id, { supabaseClient })
  return {
    activeWorkspace,
    deletedWorkspaceId: workspaceId
  }
}
