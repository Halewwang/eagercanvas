import { formatServiceCredentialForAdmin } from './service-access.service.js'

const readKeyCost = (item = {}) => {
  const candidates = [
    item?.usage_total_cost,
    item?.usageTotalCost,
    item?.usage?.totalCost,
    item?.usage?.total_cost
  ]
  for (const value of candidates) {
    if (value === undefined || value === null || String(value).trim() === '') continue
    const parsed = Number(value)
    if (Number.isFinite(parsed)) return parsed
  }
  return null
}

export const buildAdminUserUsageView = ({
  users = [],
  profiles = [],
  assignments = [],
  usageEvents = [],
  credentials = [],
  billingRecords = [],
  apiKeyInventory = null,
  activeApiKeyNames = null,
  rolesMap = new Map()
} = {}) => {
  const profileMap = new Map((profiles || []).map((p) => [p.user_id, p]))

  const usageMap = new Map()
  for (const row of billingRecords || []) {
    const key = row.user_id
    if (!key) continue
    const current = usageMap.get(key) || {
      totalCalls: 0,
      totalTokens: 0,
      totalImages: 0,
      totalVideoSeconds: 0,
      totalCostUsd: 0
    }
    current.totalCalls += 1
    current.totalTokens += Number(row.input_tokens || 0) + Number(row.output_tokens || 0)
    current.totalImages += Number(row.image_count || 0)
    current.totalVideoSeconds += Number(row.video_seconds || 0)
    current.totalCostUsd += Number(row.cost_amount || 0)
    usageMap.set(key, current)
  }

  const assignmentMap = new Map()
  for (const row of assignments || []) {
    const apiName = String(row.api_name || '').trim()
    if (!apiName) continue
    if (activeApiKeyNames && !activeApiKeyNames.has(apiName)) continue
    const list = assignmentMap.get(row.user_id) || []
    list.push({ apiName, createdAt: row.created_at })
    assignmentMap.set(row.user_id, list)
  }

  const usageEventMetaMap = new Map()
  for (const row of usageEvents || []) {
    const key = row.user_id
    const current = usageEventMetaMap.get(key) || {
      lastActivityAt: null,
      pendingBillingCount: 0,
      byApiKey: new Map()
    }

    if (!current.lastActivityAt) current.lastActivityAt = row.created_at || null
    if (String(row.billing_status || '') === 'pending') current.pendingBillingCount += 1

    const apiName = String(row.api_name || '').trim()
    if (apiName && (!activeApiKeyNames || activeApiKeyNames.has(apiName))) {
      const item = current.byApiKey.get(apiName) || {
        apiName,
        totalCostUsd: 0,
        totalCalls: 0
      }
      item.totalCalls += 1
      current.byApiKey.set(apiName, item)
    }

    usageEventMetaMap.set(key, current)
  }

  const credentialMap = new Map()
  for (const row of credentials || []) {
    const list = credentialMap.get(row.user_id) || []
    list.push(row)
    credentialMap.set(row.user_id, list)
  }

  const officialUsageMap = new Map()
  const reconciliationMap = new Map()
  for (const row of billingRecords || []) {
    const key = row.user_id
    if (!key) continue
    const official = officialUsageMap.get(key) || {
      totalCalls: 0,
      totalCostAmount: 0,
      currency: row.cost_currency || 'USD',
      byModel: new Map()
    }
    official.totalCalls += 1
    official.totalCostAmount += Number(row.cost_amount || 0)
    const model = String(row.model || 'unknown')
    const modelEntry = official.byModel.get(model) || { model, calls: 0, costAmount: 0 }
    modelEntry.calls += 1
    modelEntry.costAmount += Number(row.cost_amount || 0)
    official.byModel.set(model, modelEntry)
    officialUsageMap.set(key, official)

    const reconciliation = reconciliationMap.get(key) || { unmatchedCount: 0 }
    if (String(row.reconciliation_status || '') === 'unmatched') reconciliation.unmatchedCount += 1
    reconciliationMap.set(key, reconciliation)
  }

  for (const row of credentials || []) {
    const apiName = String(row.provider_api_name || '').trim()
    if (!apiName || !apiKeyInventory?.has(apiName)) continue
    const keyInfo = apiKeyInventory.get(apiName)
    const keyCost = readKeyCost(keyInfo)
    if (keyCost === null) continue
    const keyCurrency = keyInfo?.usage_currency || keyInfo?.usageCurrency || keyInfo?.currency || 'USD'
    const userId = row.user_id
    const official = officialUsageMap.get(userId) || {
      totalCalls: 0,
      totalCostAmount: 0,
      currency: keyCurrency,
      byModel: new Map()
    }
    official.totalCostAmount = Number(official.keyCostAmount || 0) + keyCost
    official.keyCostAmount = official.totalCostAmount
    official.currency = keyCurrency || official.currency || 'USD'
    officialUsageMap.set(userId, official)

    const usage = usageMap.get(userId) || {
      totalCalls: official.totalCalls,
      totalTokens: 0,
      totalImages: 0,
      totalVideoSeconds: 0,
      totalCostUsd: 0
    }
    usage.totalCostUsd = official.totalCostAmount
    usageMap.set(userId, usage)

    const meta = usageEventMetaMap.get(userId) || {
      lastActivityAt: null,
      pendingBillingCount: 0,
      byApiKey: new Map()
    }
    const byKey = meta.byApiKey.get(apiName) || { apiName, totalCalls: 0, totalCostUsd: 0 }
    byKey.totalCostUsd = keyCost
    meta.byApiKey.set(apiName, byKey)
    usageEventMetaMap.set(userId, meta)
  }

  return (users || []).map((user) => {
    const profile = profileMap.get(user.id)
    const usageMeta = usageEventMetaMap.get(user.id)
    const userCredentials = credentialMap.get(user.id) || []
    const latestCredential = userCredentials.find((item) => item.status === 'active') || userCredentials[0] || null
    const official = officialUsageMap.get(user.id)
    const reconciliation = reconciliationMap.get(user.id) || { unmatchedCount: 0 }
    const officialUsage = official
      ? {
          totalCalls: official.totalCalls,
          totalCostAmount: Number(official.totalCostAmount || 0),
          currency: official.currency || 'USD',
          byModel: [...official.byModel.values()].sort((a, b) => Number(b.costAmount || 0) - Number(a.costAmount || 0))
        }
      : {
          totalCalls: 0,
          totalCostAmount: 0,
          currency: 'USD',
          byModel: []
        }
    const officialLocalUsage = usageMap.get(user.id) || {
      totalCalls: 0,
      totalTokens: 0,
      totalImages: 0,
      totalVideoSeconds: 0,
      totalCostUsd: 0
    }

    return {
      id: user.id,
      email: user.email,
      createdAt: user.created_at,
      status: user.status || 'active',
      suspendedAt: user.suspended_at || null,
      suspendedReason: user.suspended_reason || null,
      deletedAt: user.deleted_at || null,
      displayName: profile?.display_name || '',
      registeredAt: profile?.registered_at || null,
      lastLoginAt: profile?.last_login_at || null,
      usage: {
        ...officialLocalUsage,
        totalCalls: officialUsage.totalCalls,
        totalCostUsd: officialUsage.totalCostAmount
      },
      service: formatServiceCredentialForAdmin(latestCredential),
      officialUsage,
      reconciliation: {
        pendingCount: Number(usageMeta?.pendingBillingCount || 0),
        unmatchedCount: Number(reconciliation.unmatchedCount || 0),
        diffAmount: 0
      },
      usageMeta: {
        lastActivityAt: usageMeta?.lastActivityAt || null,
        pendingBillingCount: Number(usageMeta?.pendingBillingCount || 0),
        byApiKey: usageMeta
          ? [...usageMeta.byApiKey.values()].sort((a, b) => Number(b.totalCostUsd || 0) - Number(a.totalCostUsd || 0))
          : []
      },
      assignedApiKeys: assignmentMap.get(user.id) || [],
      roles: rolesMap.get(user.id) || ['user']
    }
  })
}
