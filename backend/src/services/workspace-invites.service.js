import { supabase } from '../config/supabase.js'
import { randomToken, sha256 } from '../utils/crypto.js'
import { HttpError } from '../utils/http.js'

const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000

export const isInviteExpired = (invite = {}, now = new Date()) => {
  if (String(invite.status || '') !== 'pending') return true
  const expiresAt = new Date(invite.expires_at || 0).getTime()
  return !Number.isFinite(expiresAt) || expiresAt <= new Date(now).getTime()
}

const addSevenDays = (now = new Date()) => new Date(new Date(now).getTime() + INVITE_TTL_MS).toISOString()

export const resolveInviteeByUsernameOrEmail = async (value, { supabaseClient = supabase } = {}) => {
  const raw = String(value || '').trim()
  if (!raw) throw new HttpError(400, 'Invitee is required', 'WORKSPACE_INVITEE_REQUIRED')

  if (raw.includes('@')) {
    const email = raw.toLowerCase()
    const { data, error } = await supabaseClient
      .from('users')
      .select('id, email')
      .eq('email', email)
      .maybeSingle()
    if (error) throw new HttpError(500, error.message, 'WORKSPACE_INVITEE_EMAIL_QUERY_FAILED')
    return { userId: data?.id || null, email, username: '' }
  }

  const username = raw.toLowerCase()
  const { data, error } = await supabaseClient
    .from('user_profiles')
    .select('user_id, username')
    .ilike('username', username)
    .maybeSingle()
  if (error) throw new HttpError(500, error.message, 'WORKSPACE_INVITEE_USERNAME_QUERY_FAILED')
  return { userId: data?.user_id || null, email: '', username }
}

export const createInviteLink = async (userId, workspaceId, {
  supabaseClient = supabase,
  now = new Date(),
  tokenFactory = randomToken
} = {}) => {
  const token = tokenFactory()
  const { data, error } = await supabaseClient
    .from('workspace_invites')
    .insert({
      workspace_id: workspaceId,
      invite_type: 'link',
      token_hash: sha256(token),
      created_by: userId,
      status: 'pending',
      expires_at: addSevenDays(now)
    })
    .select('*')
    .single()

  if (error) throw new HttpError(500, error.message, 'WORKSPACE_INVITE_LINK_CREATE_FAILED')
  return { invite: data, token }
}

export const createDirectInvite = async (userId, workspaceId, input = {}, {
  supabaseClient = supabase,
  now = new Date()
} = {}) => {
  const invitee = await resolveInviteeByUsernameOrEmail(input.invitee || input.email || input.username, { supabaseClient })
  const { data, error } = await supabaseClient
    .from('workspace_invites')
    .insert({
      workspace_id: workspaceId,
      invite_type: 'direct',
      invitee_user_id: invitee.userId,
      invitee_email: invitee.email || null,
      created_by: userId,
      status: 'pending',
      expires_at: addSevenDays(now)
    })
    .select('*')
    .single()

  if (error) throw new HttpError(500, error.message, 'WORKSPACE_DIRECT_INVITE_CREATE_FAILED')
  return data
}

export const findInviteByToken = async (token, { supabaseClient = supabase } = {}) => {
  const { data, error } = await supabaseClient
    .from('workspace_invites')
    .select('*')
    .eq('token_hash', sha256(String(token || '').trim()))
    .eq('invite_type', 'link')
    .maybeSingle()
  if (error) throw new HttpError(500, error.message, 'WORKSPACE_INVITE_QUERY_FAILED')
  return data || null
}

export const joinWorkspaceByInvite = async (userId, token, {
  supabaseClient = supabase,
  now = new Date()
} = {}) => {
  const invite = await findInviteByToken(token, { supabaseClient })
  if (!invite || isInviteExpired(invite, now)) {
    throw new HttpError(404, 'Workspace invite is expired or invalid', 'WORKSPACE_INVITE_INVALID')
  }

  const { error: memberError } = await supabaseClient
    .from('workspace_members')
    .upsert(
      { workspace_id: invite.workspace_id, user_id: userId, role: 'member' },
      { onConflict: 'workspace_id,user_id' }
    )
  if (memberError) throw new HttpError(500, memberError.message, 'WORKSPACE_INVITE_JOIN_FAILED')

  await supabaseClient
    .from('user_workspace_preferences')
    .upsert(
      { user_id: userId, active_workspace_id: invite.workspace_id, updated_at: new Date(now).toISOString() },
      { onConflict: 'user_id' }
    )

  return invite
}

export const acceptDirectInvite = async (userId, inviteId, { supabaseClient = supabase, now = new Date() } = {}) => {
  const { data: invite, error: inviteError } = await supabaseClient
    .from('workspace_invites')
    .select('*')
    .eq('id', inviteId)
    .eq('invite_type', 'direct')
    .maybeSingle()

  if (inviteError) throw new HttpError(500, inviteError.message, 'WORKSPACE_DIRECT_INVITE_QUERY_FAILED')
  if (!invite || isInviteExpired(invite, now)) throw new HttpError(404, 'Workspace invite is expired or invalid', 'WORKSPACE_INVITE_INVALID')
  if (invite.invitee_user_id && String(invite.invitee_user_id) !== String(userId)) {
    throw new HttpError(403, 'Invite does not belong to this user', 'WORKSPACE_INVITE_FORBIDDEN')
  }
  if (!invite.invitee_user_id && invite.invitee_email) {
    const { data: user, error: userError } = await supabaseClient
      .from('users')
      .select('email')
      .eq('id', userId)
      .maybeSingle()
    if (userError) throw new HttpError(500, userError.message, 'WORKSPACE_INVITE_USER_QUERY_FAILED')
    if (String(user?.email || '').trim().toLowerCase() !== String(invite.invitee_email || '').trim().toLowerCase()) {
      throw new HttpError(403, 'Invite does not belong to this user', 'WORKSPACE_INVITE_FORBIDDEN')
    }
  }

  const { error: memberError } = await supabaseClient
    .from('workspace_members')
    .upsert(
      { workspace_id: invite.workspace_id, user_id: userId, role: 'member' },
      { onConflict: 'workspace_id,user_id' }
    )
  if (memberError) throw new HttpError(500, memberError.message, 'WORKSPACE_DIRECT_INVITE_ACCEPT_FAILED')

  await supabaseClient
    .from('workspace_invites')
    .update({ status: 'accepted', accepted_at: new Date(now).toISOString() })
    .eq('id', invite.id)

  await supabaseClient
    .from('user_workspace_preferences')
    .upsert(
      { user_id: userId, active_workspace_id: invite.workspace_id, updated_at: new Date(now).toISOString() },
      { onConflict: 'user_id' }
    )

  return invite
}
