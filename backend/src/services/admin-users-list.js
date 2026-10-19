import { supabase } from '../config/supabase.js'
import { HttpError } from '../utils/http.js'
import { buildAdminUserDetail } from './admin-user-detail.js'

const normalizePage = (query = {}) => {
  const rawPage = Number(query.page)
  const rawLimit = Number(query.limit)
  const pageProvided = query.page !== undefined && query.page !== null && query.page !== ''
  const limitProvided = query.limit !== undefined && query.limit !== null && query.limit !== ''
  const pageInteger = Math.trunc(rawPage)
  const limitInteger = Math.trunc(rawLimit)
  if (
    (pageProvided && (!Number.isFinite(rawPage) || !Number.isSafeInteger(pageInteger))) ||
    (limitProvided && (!Number.isFinite(rawLimit) || !Number.isSafeInteger(limitInteger)))
  ) throw new HttpError(400, 'Invalid pagination', 'INVALID_PAGINATION')
  const page = Math.max(1, pageProvided ? pageInteger : 1)
  const limit = Math.min(100, Math.max(1, limitProvided ? limitInteger : 25))
  const from = (page - 1) * limit
  const to = from + limit - 1
  if (!Number.isSafeInteger(from) || !Number.isSafeInteger(to)) {
    throw new HttpError(400, 'Invalid pagination', 'INVALID_PAGINATION')
  }
  return { page, limit, from, to }
}

const clean = (value) => String(value || '').trim()

const idsFrom = (rows) => new Set((rows || []).map((row) => row.user_id).filter(Boolean))

const intersectIds = (left, right) => {
  if (left === null) return new Set(right)
  return new Set([...left].filter((value) => right.has(value)))
}

const queryCandidateIds = async (query, client) => {
  let candidates = null
  const role = clean(query.role)
  if (role) {
    const result = await client.from('user_roles').select('user_id,roles!inner(code)').eq('roles.code', role)
    if (result.error) throw new HttpError(500, 'Unable to filter admin users by role', 'ADMIN_USERS_ROLE_FILTER_FAILED')
    candidates = intersectIds(candidates, idsFrom(result.data))
    if (!candidates.size) return candidates
  }

  const serviceStatus = clean(query.serviceStatus)
  if (serviceStatus) {
    const [usersRes, credentialsRes] = await Promise.all([
      serviceStatus === 'not_enabled' ? client.from('users').select('id') : { data: [] },
      client.from('user_service_credentials').select('user_id,status,created_at')
        .order('created_at', { ascending: false })
    ])
    if (usersRes.error || credentialsRes.error) {
      throw new HttpError(500, 'Unable to filter admin users by service status', 'ADMIN_USERS_SERVICE_FILTER_FAILED')
    }
    const credentialsByUser = new Map()
    for (const credential of credentialsRes.data || []) {
      const list = credentialsByUser.get(credential.user_id) || []
      list.push(credential)
      credentialsByUser.set(credential.user_id, list)
    }
    const userIds = serviceStatus === 'not_enabled'
      ? (usersRes.data || []).map((user) => user.id)
      : [...credentialsByUser.keys()]
    const serviceIds = new Set(userIds.filter((userId) =>
      buildAdminUserDetail({ credentials: credentialsByUser.get(userId) || [] }).service.serviceStatus === serviceStatus
    ))
    candidates = intersectIds(candidates, serviceIds)
    if (!candidates.size) return candidates
  }

  return candidates
}

const loadPageAssociations = async (userIds, client) => {
  const results = await Promise.all([
    client.from('user_profiles').select('user_id,display_name,registered_at,last_login_at').in('user_id', userIds),
    client.from('user_roles').select('user_id,roles(code)').in('user_id', userIds),
    client.from('user_service_credentials').select('id,user_id,status,created_at,disabled_at,deleted_at')
      .in('user_id', userIds).order('created_at', { ascending: false })
  ])
  if (results.some((result) => result.error)) throw new HttpError(500, 'Unable to load admin user page associations', 'ADMIN_USERS_ASSOCIATIONS_QUERY_FAILED')
  const [profilesRes, rolesRes, credentialsRes] = results
  return { profiles: profilesRes.data || [], roles: rolesRes.data || [], credentials: credentialsRes.data || [] }
}

export const listUsersForAdmin = async (query = {}, { client = supabase } = {}) => {
  const { page, limit, from, to } = normalizePage(query)
  const candidates = await queryCandidateIds(query, client)
  if (candidates !== null && candidates.size === 0) {
    return { items: [], pagination: { page, limit, total: 0 } }
  }

  let usersQuery = client.from('users')
    .select('id,email,status,created_at,suspended_at,suspended_reason,deleted_at', { count: 'exact' })
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })
  const status = clean(query.status)
  const search = clean(query.search)
  if (status) usersQuery = usersQuery.eq('status', status)
  if (search) usersQuery = usersQuery.ilike('email', `%${search.replace(/[%_]/g, '')}%`)
  if (candidates !== null) usersQuery = usersQuery.in('id', [...candidates].sort())
  const usersRes = await usersQuery.range(from, to)
  if (usersRes.error) throw new HttpError(500, 'Unable to load admin users', 'USERS_QUERY_FAILED')

  const users = usersRes.data || []
  if (!users.length) {
    return { items: [], pagination: { page, limit, total: Number(usersRes.count || 0) } }
  }
  const associations = await loadPageAssociations(users.map((row) => row.id), client)
  const items = users.map((user) => buildAdminUserDetail({
    user,
    profile: associations.profiles.find((profile) => profile.user_id === user.id),
    roles: associations.roles.filter((row) => row.user_id === user.id).map((row) => row.roles?.code).filter(Boolean),
    credentials: associations.credentials.filter((row) => row.user_id === user.id)
  }))
  return {
    items,
    pagination: { page, limit, total: Number(usersRes.count || 0) }
  }
}
