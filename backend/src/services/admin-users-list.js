import { supabase } from '../config/supabase.js'
import { HttpError } from '../utils/http.js'
import { buildAdminUserUsageView } from './admin-usage-view.js'
import { loadApiKeyAssignments, loadUserApiKeyBillingInventory } from './admin-api-key-assignments.js'

const isMissingRelation = (error) => {
  const msg = String(error?.message || '').toLowerCase()
  return msg.includes('relation') && msg.includes('does not exist')
}

const loadRolesMap = async (userIds) => {
  const safeUserIds = [...new Set((userIds || []).filter(Boolean))]
  if (!safeUserIds.length) return new Map()

  const [{ data: userRoles, error: userRolesError }, { data: roles, error: rolesError }] = await Promise.all([
    supabase.from('user_roles').select('user_id, role_id').in('user_id', safeUserIds),
    supabase.from('roles').select('id, code')
  ])

  if (userRolesError) {
    if (isMissingRelation(userRolesError)) return new Map()
    throw new HttpError(500, userRolesError.message, 'USER_ROLES_QUERY_FAILED')
  }
  if (rolesError) {
    if (isMissingRelation(rolesError)) return new Map()
    throw new HttpError(500, rolesError.message, 'ROLES_QUERY_FAILED')
  }

  const roleCodeMap = new Map((roles || []).map((row) => [row.id, row.code]).filter(([, code]) => !!code))
  const mapped = new Map()

  for (const row of userRoles || []) {
    const roleCode = roleCodeMap.get(row.role_id)
    if (!roleCode) continue
    const list = mapped.get(row.user_id) || []
    list.push(roleCode)
    mapped.set(row.user_id, list)
  }

  for (const [key, list] of mapped.entries()) {
    mapped.set(key, [...new Set(list)].sort())
  }
  return mapped
}

export const listUsersForAdmin = async () => {
  const [usersRes, profilesRes, assignments, usageEventsRes, credentialsRes, billingRecordsRes] = await Promise.all([
    supabase.from('users').select('*').order('created_at', { ascending: false }),
    supabase.from('user_profiles').select('user_id, display_name, registered_at, last_login_at'),
    loadApiKeyAssignments(),
    supabase
      .from('usage_events')
      .select('user_id, api_name, cost_usd, estimated_cost_usd, billing_status, created_at')
      .order('created_at', { ascending: false }),
    supabase
      .from('user_service_credentials')
      .select('*')
      .order('created_at', { ascending: false }),
    supabase
      .from('provider_billing_records')
      .select('user_id, service_credential_id, model, input_tokens, output_tokens, image_count, video_seconds, cost_amount, cost_currency, reconciliation_status, official_created_at')
      .order('official_created_at', { ascending: false })
  ])

  if (usersRes.error) throw new HttpError(500, usersRes.error.message, 'USERS_QUERY_FAILED')
  if (profilesRes.error) throw new HttpError(500, profilesRes.error.message, 'PROFILES_QUERY_FAILED')
  if (usageEventsRes.error) throw new HttpError(500, usageEventsRes.error.message, 'USAGE_EVENTS_QUERY_FAILED')
  if (credentialsRes.error && !isMissingRelation(credentialsRes.error)) throw new HttpError(500, credentialsRes.error.message, 'SERVICE_CREDENTIALS_QUERY_FAILED')
  if (billingRecordsRes.error && !isMissingRelation(billingRecordsRes.error)) throw new HttpError(500, billingRecordsRes.error.message, 'BILLING_RECORDS_QUERY_FAILED')
  const credentialRows = credentialsRes.data || []
  const apiKeyInventory = await loadUserApiKeyBillingInventory([
    ...credentialRows,
    ...(assignments || [])
  ])
  const rolesMap = await loadRolesMap((usersRes.data || []).map((item) => item.id))
  const activeApiKeyNames = apiKeyInventory ? new Set(apiKeyInventory.keys()) : null

  return buildAdminUserUsageView({
    users: usersRes.data || [],
    profiles: profilesRes.data || [],
    assignments,
    usageEvents: usageEventsRes.data || [],
    credentials: credentialRows,
    billingRecords: billingRecordsRes.data || [],
    apiKeyInventory,
    activeApiKeyNames,
    rolesMap
  })
}
