import { supabase } from '../config/supabase.js'
import { HttpError } from '../utils/http.js'
import {
  get302ApiKey,
  get302ApiKeys,
  get302ApiKeyUsageByKey,
  get302RuntimeApiKeyByName,
  normalize302ApiKeyList,
  normalize302ApiKeyUsage
} from './dashboard302.service.js'
import { createAdminLog } from './admin-operation-logs.js'

const ASSIGNMENT_TABLE = 'user_api_key_assignments'

const isMissingRelation = (error) => {
  const msg = String(error?.message || '').toLowerCase()
  return msg.includes('relation') && msg.includes('does not exist')
}

const requireAssignmentTable = (error) => {
  if (isMissingRelation(error)) {
    throw new HttpError(
      500,
      'Table user_api_key_assignments is missing. Run supabase migration 003_usage_admin_key_assignments.sql first.',
      'ASSIGNMENT_TABLE_MISSING'
    )
  }
  throw new HttpError(500, error.message || 'Assignment query failed', 'ASSIGNMENT_QUERY_FAILED')
}

const readApiName = (item = {}) => String(item?.api_name || item?.apiName || '').trim()

const readProviderApiName = (item = {}) =>
  String(item?.provider_api_name || item?.api_name || item?.apiName || '').trim()

const unwrapDataObject = (payload = {}) =>
  payload?.data && typeof payload.data === 'object' && !Array.isArray(payload.data)
    ? payload.data
    : payload

const readRuntimeApiKey = (item = {}) => String(item?.api_key || item?.apiKey || '').trim()
const DEFAULT_BILLING_INVENTORY_CONCURRENCY = 4

const normalizeConcurrency = (value, fallback = DEFAULT_BILLING_INVENTORY_CONCURRENCY) => {
  const parsed = Number(value)
  if (!Number.isFinite(parsed) || parsed < 1) return fallback
  return Math.max(1, Math.floor(parsed))
}

const mapWithConcurrency = async (items = [], worker, concurrency = DEFAULT_BILLING_INVENTORY_CONCURRENCY) => {
  const list = Array.isArray(items) ? items : []
  if (!list.length) return []
  const limit = Math.min(normalizeConcurrency(concurrency), list.length)
  const results = new Array(list.length)
  let nextIndex = 0

  await Promise.all(Array.from({ length: limit }, async () => {
    while (nextIndex < list.length) {
      const index = nextIndex
      nextIndex += 1
      results[index] = await worker(list[index], index)
    }
  }))

  return results
}

const loadBillingInventoryEntry = async ({
  activeItems,
  apiName,
  getApiKey,
  getApiKeyUsage
}) => {
  if (!activeItems.has(apiName)) return null
  let detail = { api_name: apiName }

  try {
    detail = {
      api_name: apiName,
      ...unwrapDataObject(await getApiKey(apiName))
    }
  } catch {
    return [apiName, detail]
  }

  const apiKey = readRuntimeApiKey(detail)
  if (apiKey) {
    try {
      const usage = normalize302ApiKeyUsage(await getApiKeyUsage(apiKey))
      detail = {
        ...detail,
        usage_total_cost: usage.totalCost,
        usage_monthly_cost: usage.monthlyCost,
        usage_daily_cost: usage.dailyCost,
        usage_currency: usage.currency,
        currency: usage.currency
      }
    } catch {
      // Keep the key details, but do not fall back to list current_cost as billed usage.
    }
  }

  return [apiName, detail]
}

export const loadApiKeyAssignments = async () => {
  const { data, error } = await supabase
    .from(ASSIGNMENT_TABLE)
    .select('user_id, api_name, created_at')

  if (error) {
    if (isMissingRelation(error)) return []
    throw new HttpError(500, error.message, 'ASSIGNMENT_QUERY_FAILED')
  }

  return Array.isArray(data) ? data : []
}

export const loadActiveApiKeyInventory = async () => {
  try {
    const response = await get302ApiKeys()
    const list = normalize302ApiKeyList(response)
    return new Map(
      list
        .map((item) => [readApiName(item), item])
        .filter(([apiName]) => !!apiName)
    )
  } catch {
    return null
  }
}

export const loadUserApiKeyBillingInventory = async (
  credentials = [],
  {
    listApiKeys = get302ApiKeys,
    getApiKey = get302ApiKey,
    getApiKeyUsage = get302ApiKeyUsageByKey,
    concurrency = DEFAULT_BILLING_INVENTORY_CONCURRENCY
  } = {}
) => {
  try {
    const list = normalize302ApiKeyList(await listApiKeys())
    const activeItems = new Map(
      list
        .map((item) => [readApiName(item), item])
        .filter(([apiName]) => !!apiName)
    )
    const requestedNames = [
      ...new Set(
        (credentials || [])
          .map(readProviderApiName)
          .filter(Boolean)
      )
    ]
    const names = requestedNames.length ? requestedNames : [...activeItems.keys()]
    const inventory = new Map()

    const entries = await mapWithConcurrency(
      names,
      (apiName) => loadBillingInventoryEntry({
        activeItems,
        apiName,
        getApiKey,
        getApiKeyUsage
      }),
      concurrency
    )
    for (const entry of entries) {
      if (entry) inventory.set(entry[0], entry[1])
    }

    return inventory
  } catch {
    return null
  }
}

const loadActiveApiKeyNames = async () => {
  const inventory = await loadActiveApiKeyInventory()
  if (!inventory) return null
  return new Set(inventory.keys())
}

export const getUserAssignedApiKeys = async (userId) => {
  const safeUserId = String(userId || '').trim()
  if (!safeUserId) return []

  const { data, error } = await supabase
    .from(ASSIGNMENT_TABLE)
    .select('api_name, created_at')
    .eq('user_id', safeUserId)
    .order('created_at', { ascending: false })

  if (error) {
    if (isMissingRelation(error)) return []
    throw new HttpError(500, error.message, 'ASSIGNMENT_QUERY_FAILED')
  }

  const list = Array.isArray(data) ? data : []
  const activeApiKeyNames = await loadActiveApiKeyNames()
  if (!activeApiKeyNames) return list
  return list.filter((item) => activeApiKeyNames.has(String(item.api_name || '').trim()))
}

export const resolveUserProviderAccess = async (userId, requestedApiName = '') => {
  const preferredApiName = String(requestedApiName || '').trim()
  const assignments = await getUserAssignedApiKeys(userId)
  const assignedNames = assignments.map((item) => String(item.api_name || '').trim()).filter(Boolean)

  const apiName = preferredApiName && assignedNames.includes(preferredApiName)
    ? preferredApiName
    : assignedNames[0] || ''

  if (!apiName) {
    return {
      apiName: '',
      apiKey: '',
      assignedApiNames: assignedNames
    }
  }

  const apiKey = await get302RuntimeApiKeyByName(apiName)
  return {
    apiName,
    apiKey,
    assignedApiNames: assignedNames
  }
}

export const removeApiKeyAssignments = async (apiName) => {
  const safeApiName = String(apiName || '').trim()
  if (!safeApiName) return { ok: true }

  const { error } = await supabase
    .from(ASSIGNMENT_TABLE)
    .delete()
    .eq('api_name', safeApiName)

  if (error) requireAssignmentTable(error)
  return { ok: true }
}

export const removeApiKeyAssignmentsForUser = (userId) =>
  supabase
    .from(ASSIGNMENT_TABLE)
    .delete()
    .eq('user_id', String(userId || '').trim())

export const assignApiKeyToUser = async ({ userId, apiName, operatorUserId = null, ip, userAgent }) => {
  const safeUserId = String(userId || '').trim()
  const safeApiName = String(apiName || '').trim()
  if (!safeUserId) throw new HttpError(400, 'userId is required', 'INVALID_USER_ID')
  if (!safeApiName) throw new HttpError(400, 'apiName is required', 'INVALID_API_NAME')

  const activeApiKeyNames = await loadActiveApiKeyNames()
  if (!activeApiKeyNames) {
    throw new HttpError(503, 'Unable to verify API key inventory right now. Please try again later.', 'API_KEY_INVENTORY_UNAVAILABLE')
  }
  if (!activeApiKeyNames.has(safeApiName)) {
    throw new HttpError(404, 'API key does not exist or has been deleted', 'API_KEY_NOT_FOUND')
  }

  const { data: user, error: userError } = await supabase
    .from('users')
    .select('id')
    .eq('id', safeUserId)
    .maybeSingle()

  if (userError) throw new HttpError(500, userError.message, 'USER_QUERY_FAILED')
  if (!user) throw new HttpError(404, 'User not found', 'USER_NOT_FOUND')

  const { error } = await supabase
    .from(ASSIGNMENT_TABLE)
    .upsert(
      { user_id: safeUserId, api_name: safeApiName },
      { onConflict: 'user_id,api_name' }
    )

  if (error) requireAssignmentTable(error)

  if (operatorUserId) {
    await createAdminLog({
      operatorUserId,
      targetUserId: safeUserId,
      action: 'admin.api_key.assign',
      metadata: {
        apiName: safeApiName,
        ip: String(ip || ''),
        userAgent: String(userAgent || '')
      }
    })
  }

  return { ok: true }
}

export const unassignApiKeyFromUser = async ({ userId, apiName, operatorUserId = null, ip, userAgent }) => {
  const safeUserId = String(userId || '').trim()
  const safeApiName = String(apiName || '').trim()
  if (!safeUserId) throw new HttpError(400, 'userId is required', 'INVALID_USER_ID')
  if (!safeApiName) throw new HttpError(400, 'apiName is required', 'INVALID_API_NAME')

  const { error } = await supabase
    .from(ASSIGNMENT_TABLE)
    .delete()
    .eq('user_id', safeUserId)
    .eq('api_name', safeApiName)

  if (error) requireAssignmentTable(error)

  if (operatorUserId) {
    await createAdminLog({
      operatorUserId,
      targetUserId: safeUserId,
      action: 'admin.api_key.unassign',
      metadata: {
        apiName: safeApiName,
        ip: String(ip || ''),
        userAgent: String(userAgent || '')
      }
    })
  }

  return { ok: true }
}
