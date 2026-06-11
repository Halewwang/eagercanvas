import { Router } from 'express'
import { z } from 'zod'
import { authRequired } from '../middleware/auth.js'
import { requirePermission } from '../middleware/authz.js'
import { asyncHandler } from '../utils/http.js'
import {
  create302ApiKey,
  delete302ApiKey,
  get302ApiKeys,
  get302ApiRecords,
  get302ApiRecordsForApiName,
  get302Balance,
  get302RecordByRequestId,
  normalize302ApiKeyList,
  normalize302ApiRecordList,
  update302ApiKey
} from '../services/dashboard302.service.js'
import {
  assignApiKeyToUser,
  deleteUserAccount,
  getAdminUsageSummary,
  getAdminUsageTimeseries,
  listAdminOperationLogs,
  listUsersForAdmin,
  removeApiKeyAssignments,
  unassignApiKeyFromUser,
  updateUserStatus,
  updateUserRoles
} from '../services/admin-usage.service.js'
import {
  createUserServiceCredential,
  disableUserServiceCredential,
  resetUserServiceCredential,
  updateUserServiceLimits
} from '../services/service-access.service.js'
import { syncProviderBillingRecords } from '../services/billing-reconciliation.service.js'
import {
  getIssueGroupForAdmin,
  listIssueGroupsForAdmin,
  updateIssueGroupStatus
} from '../services/admin-issues.service.js'
import { exportCodexIssues } from '../services/issue-codex-export.service.js'
import { sendIssueAlertForGroup, sendIssueDigestEmail } from '../services/issue-notification.service.js'

export const adminRouter = Router()
adminRouter.use(authRequired)

const updateRolesSchema = z.object({
  roleCodes: z.array(z.string().min(1)).min(1)
})

const apiKeyAssignSchema = z.object({
  userId: z.string().min(1),
  apiName: z.string().min(1)
})

const admin302ApiKeySchema = z.object({
  api_name: z.string().min(1),
  allow_save_logs: z.boolean().default(false),
  allow_custom_model: z.boolean().default(false),
  allow_manage_key: z.boolean().default(false),
  limit_cost: z.number().int().nonnegative().default(0),
  limit_daily_cost: z.number().int().nonnegative().default(0),
  expired_on: z.number().int().nonnegative().default(0)
})

const updateUserStatusSchema = z.object({
  status: z.enum(['active', 'suspended']),
  reason: z.string().max(200).optional()
})

const serviceAccessLimitsSchema = z.object({
  limitCost: z.number().nonnegative().default(0),
  limitDailyCost: z.number().nonnegative().default(0),
  expiredOn: z.number().int().nonnegative().default(0)
})

const disableServiceSchema = z.object({
  reason: z.string().max(200).optional()
})

const reconcileSchema = z.object({
  startTime: z.string().optional(),
  endTime: z.string().optional(),
  pageSize: z.number().int().min(1).max(500).optional()
})

const updateIssueStatusSchema = z.object({
  status: z.enum(['open', 'investigating', 'resolved', 'ignored'])
})

const exportIssuesSchema = z.object({
  status: z.string().optional(),
  severity: z.string().optional(),
  sourceLayer: z.string().optional(),
  source_layer: z.string().optional(),
  issueGroupIds: z.array(z.string().min(1)).max(100).optional(),
  issue_group_ids: z.array(z.string().min(1)).max(100).optional(),
  limit: z.number().int().min(1).max(100).optional()
})

const sendIssueDigestSchema = exportIssuesSchema.extend({
  to: z.string().trim().email()
})

adminRouter.get('/session', requirePermission(['admin.dashboard.read']), asyncHandler(async (req, res) => {
  res.json({
    user: {
      id: req.user.id,
      email: req.user.email
    },
    roles: req.user.roles || [],
    permissions: req.user.permissions || []
  })
}))

adminRouter.get('/users', requirePermission(['admin.user.read']), asyncHandler(async (_req, res) => {
  const users = await listUsersForAdmin()
  res.json({ data: users })
}))

adminRouter.patch('/users/:userId/roles', requirePermission(['admin.user.role.update']), asyncHandler(async (req, res) => {
  const payload = updateRolesSchema.parse(req.body || {})
  const result = await updateUserRoles({
    operatorUserId: req.user.id,
    operatorRoles: req.user.roles || [],
    targetUserId: req.params.userId,
    roleCodes: payload.roleCodes,
    ip: req.ip,
    userAgent: req.headers['user-agent'] || ''
  })
  res.json(result)
}))

adminRouter.patch('/users/:userId/status', requirePermission(['admin.user.status.update']), asyncHandler(async (req, res) => {
  const payload = updateUserStatusSchema.parse(req.body || {})
  const result = await updateUserStatus({
    operatorUserId: req.user.id,
    operatorRoles: req.user.roles || [],
    targetUserId: req.params.userId,
    status: payload.status,
    reason: payload.reason,
    ip: req.ip,
    userAgent: req.headers['user-agent'] || ''
  })
  res.json(result)
}))

adminRouter.delete('/users/:userId', requirePermission(['admin.user.status.update']), asyncHandler(async (req, res) => {
  const result = await deleteUserAccount({
    operatorUserId: req.user.id,
    operatorRoles: req.user.roles || [],
    targetUserId: req.params.userId,
    ip: req.ip,
    userAgent: req.headers['user-agent'] || ''
  })
  res.json(result)
}))

adminRouter.post('/users/:userId/service-access/activate', requirePermission(['admin.service_access.activate']), asyncHandler(async (req, res) => {
  const payload = serviceAccessLimitsSchema.parse(req.body || {})
  const result = await createUserServiceCredential({
    userId: req.params.userId,
    operatorUserId: req.user.id,
    limitCost: payload.limitCost,
    limitDailyCost: payload.limitDailyCost,
    expiredOn: payload.expiredOn,
    ip: req.ip,
    userAgent: req.headers['user-agent'] || ''
  })
  res.json({ ok: true, data: { userId: req.params.userId, ...result.serviceCredential } })
}))

adminRouter.post('/users/:userId/service-access/disable', requirePermission(['admin.service_access.disable']), asyncHandler(async (req, res) => {
  const payload = disableServiceSchema.parse(req.body || {})
  const result = await disableUserServiceCredential({
    userId: req.params.userId,
    operatorUserId: req.user.id,
    reason: payload.reason,
    ip: req.ip,
    userAgent: req.headers['user-agent'] || ''
  })
  res.json({ ok: true, data: { userId: req.params.userId, ...result.serviceCredential } })
}))

adminRouter.post('/users/:userId/service-access/reset', requirePermission(['admin.service_access.reset']), asyncHandler(async (req, res) => {
  const result = await resetUserServiceCredential({
    userId: req.params.userId,
    operatorUserId: req.user.id,
    ip: req.ip,
    userAgent: req.headers['user-agent'] || ''
  })
  res.json({ ok: true, data: { userId: req.params.userId, ...result.serviceCredential } })
}))

adminRouter.patch('/users/:userId/service-access/limits', requirePermission(['admin.service_access.update_limits']), asyncHandler(async (req, res) => {
  const payload = serviceAccessLimitsSchema.parse(req.body || {})
  const result = await updateUserServiceLimits({
    userId: req.params.userId,
    operatorUserId: req.user.id,
    limitCost: payload.limitCost,
    limitDailyCost: payload.limitDailyCost,
    expiredOn: payload.expiredOn,
    ip: req.ip,
    userAgent: req.headers['user-agent'] || ''
  })
  res.json({ ok: true, data: { userId: req.params.userId, ...result.serviceCredential } })
}))

adminRouter.post('/api-keys/assign', requirePermission(['admin.api_key.assign']), asyncHandler(async (req, res) => {
  const payload = apiKeyAssignSchema.parse(req.body || {})
  const result = await assignApiKeyToUser({
    userId: payload.userId,
    apiName: payload.apiName,
    operatorUserId: req.user.id,
    ip: req.ip,
    userAgent: req.headers['user-agent'] || ''
  })
  res.json(result)
}))

adminRouter.delete('/api-keys/assign', requirePermission(['admin.api_key.assign']), asyncHandler(async (req, res) => {
  const payload = apiKeyAssignSchema.parse(req.body || req.query || {})
  const result = await unassignApiKeyFromUser({
    userId: payload.userId,
    apiName: payload.apiName,
    operatorUserId: req.user.id,
    ip: req.ip,
    userAgent: req.headers['user-agent'] || ''
  })
  res.json(result)
}))

adminRouter.get('/audit-logs', requirePermission(['admin.audit.read']), asyncHandler(async (req, res) => {
  const result = await listAdminOperationLogs({
    page: req.query.page,
    limit: req.query.limit
  })
  res.json({ data: result.items, pagination: result.pagination })
}))

adminRouter.get('/issues', requirePermission(['admin.issue.read']), asyncHandler(async (req, res) => {
  const result = await listIssueGroupsForAdmin({
    status: req.query.status,
    severity: req.query.severity,
    sourceLayer: req.query.source_layer,
    category: req.query.category,
    from: req.query.from,
    to: req.query.to,
    page: req.query.page,
    limit: req.query.limit
  })
  res.json({ data: result.items, pagination: result.pagination })
}))

adminRouter.get('/issues/:issueGroupId', requirePermission(['admin.issue.read']), asyncHandler(async (req, res) => {
  const result = await getIssueGroupForAdmin(req.params.issueGroupId, {
    groupIds: req.query.group_ids
  })
  res.json({ data: result })
}))

adminRouter.patch('/issues/:issueGroupId', requirePermission(['admin.issue.update']), asyncHandler(async (req, res) => {
  const payload = updateIssueStatusSchema.parse(req.body || {})
  const data = await updateIssueGroupStatus(req.params.issueGroupId, payload.status)
  res.json({ data })
}))

adminRouter.post('/issues/export', requirePermission(['admin.issue.export']), asyncHandler(async (req, res) => {
  const payload = exportIssuesSchema.parse(req.body || {})
  const result = await exportCodexIssues({
    writeFiles: false,
    filters: {
      status: payload.status,
      severity: payload.severity,
      sourceLayer: payload.sourceLayer || payload.source_layer,
      issueGroupIds: payload.issueGroupIds || payload.issue_group_ids || [],
      limit: payload.limit
    }
  })
  res.json({
    data: {
      generatedAt: result.generatedAt,
      issueCount: result.issueCount,
      jsonFileName: result.jsonFileName,
      markdownFileName: result.markdownFileName,
      jsonContent: result.jsonContent,
      markdownContent: result.markdownContent
    }
  })
}))

adminRouter.post(
  '/issues/send-email',
  requirePermission(['admin.issue.export']),
  requirePermission(['admin.issue.notify']),
  asyncHandler(async (req, res) => {
    const payload = sendIssueDigestSchema.parse(req.body || {})
    const result = await sendIssueDigestEmail({
      to: payload.to,
      filters: {
        status: payload.status,
        severity: payload.severity,
        sourceLayer: payload.sourceLayer || payload.source_layer,
        issueGroupIds: payload.issueGroupIds || payload.issue_group_ids || [],
        limit: payload.limit
      }
    })
    res.json({ data: result })
  })
)

adminRouter.post('/issues/:issueGroupId/notify', requirePermission(['admin.issue.notify']), asyncHandler(async (req, res) => {
  const result = await sendIssueAlertForGroup(req.params.issueGroupId)
  res.json({ data: result })
}))

adminRouter.get('/usage/summary', requirePermission(['admin.usage.read_all']), asyncHandler(async (req, res) => {
  const data = await getAdminUsageSummary({
    from: req.query.from,
    to: req.query.to,
    userId: req.query.userId
  })
  res.json({ data })
}))

adminRouter.get('/usage/timeseries', requirePermission(['admin.usage.read_all']), asyncHandler(async (req, res) => {
  const data = await getAdminUsageTimeseries({
    from: req.query.from,
    to: req.query.to,
    userId: req.query.userId
  })
  res.json({ data, granularity: 'day' })
}))

adminRouter.post('/billing/reconcile', requirePermission(['admin.billing.reconcile']), asyncHandler(async (req, res) => {
  const payload = reconcileSchema.parse(req.body || {})
  const result = await syncProviderBillingRecords(payload)
  res.json({ data: result })
}))

adminRouter.get('/302/balance', requirePermission(['admin.usage.read_all']), asyncHandler(async (_req, res) => {
  const result = await get302Balance()
  res.json({ data: result?.data ?? result })
}))

adminRouter.get('/302/record/:requestId', requirePermission(['admin.usage.read_all']), asyncHandler(async (req, res) => {
  const result = await get302RecordByRequestId(req.params.requestId)
  res.json({ data: result?.data ?? result })
}))

adminRouter.get('/302/api-record', requirePermission(['admin.usage.read_all']), asyncHandler(async (req, res) => {
  const query = {
    page: req.query.page,
    limit: req.query.limit,
    start_time: req.query.start_time,
    end_time: req.query.end_time
  }
  const apiName = req.query.api_name || req.query.apiName
  const result = apiName
    ? await get302ApiRecordsForApiName(apiName, query)
    : await get302ApiRecords(query)
  const normalized = normalize302ApiRecordList(result)
  res.json({
    data: {
      items: normalized.items,
      pagination: normalized.pagination
    }
  })
}))

adminRouter.get('/302/api-keys', requirePermission(['admin.api_key.manage', 'admin.api_key.assign']), asyncHandler(async (req, res) => {
  const result = await get302ApiKeys()
  const list = normalize302ApiKeyList(result)
  const canManage = (req.user.permissions || []).includes('admin.api_key.manage')
  res.json({
    data: canManage
      ? list
      : list.map((item) => ({
        id: item.id,
        api_name: item.api_name,
        current_cost: item.current_cost,
        limit_cost: item.limit_cost,
        limit_daily_cost: item.limit_daily_cost,
        current_date_cost: item.current_date_cost,
        expired_on: item.expired_on
      }))
  })
}))

adminRouter.post('/302/api-keys', requirePermission(['admin.api_key.manage']), asyncHandler(async (req, res) => {
  const payload = admin302ApiKeySchema.parse(req.body || {})
  const result = await create302ApiKey(payload)
  res.json({ data: result?.data ?? result, msg: result?.msg || 'success' })
}))

adminRouter.put('/302/api-keys/:apiName', requirePermission(['admin.api_key.manage']), asyncHandler(async (req, res) => {
  const payload = admin302ApiKeySchema.parse(req.body || {})
  const result = await update302ApiKey(req.params.apiName, payload)
  res.json({ data: result?.data ?? result, msg: result?.msg || 'success' })
}))

adminRouter.delete('/302/api-keys/:apiName', requirePermission(['admin.api_key.manage']), asyncHandler(async (req, res) => {
  const result = await delete302ApiKey(req.params.apiName)
  await removeApiKeyAssignments(req.params.apiName)
  res.json({ data: result?.data ?? result, msg: result?.msg || 'success' })
}))
