import { Router } from 'express'
import { z } from 'zod'
import { authRequired } from '../middleware/auth.js'
import { requirePermission } from '../middleware/authz.js'
import { asyncHandler, sendData, sendJson } from '../utils/http.js'
import {
  assignApiKeyToUser,
  deleteUserAccount,
  getAdminUsageSummary,
  getAdminUsageTimeseries,
  listAdminOperationLogs,
  listUsersForAdmin,
  unassignApiKeyFromUser,
  updateUserStatus,
  updateUserRoles
} from '../services/admin-usage.service.js'
import {
  handle302ApiKeys,
  handle302ApiRecord,
  handle302Balance,
  handle302CreateApiKey,
  handle302DeleteApiKey,
  handle302Record,
  handle302UpdateApiKey
} from './dashboard302.handlers.js'

export const adminRouter = Router()
adminRouter.use(authRequired)

const updateRolesSchema = z.object({
  roleCodes: z.array(z.string().min(1)).min(1)
})

const apiKeyAssignSchema = z.object({
  userId: z.string().min(1),
  apiName: z.string().min(1)
})

const updateUserStatusSchema = z.object({
  status: z.enum(['active', 'suspended']),
  reason: z.string().max(200).optional()
})

adminRouter.get('/session', requirePermission(['admin.dashboard.read']), asyncHandler(async (req, res) => {
  sendJson(res, {
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
  sendData(res, users)
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
  sendJson(res, result)
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
  sendJson(res, result)
}))

adminRouter.delete('/users/:userId', requirePermission(['admin.user.status.update']), asyncHandler(async (req, res) => {
  const result = await deleteUserAccount({
    operatorUserId: req.user.id,
    operatorRoles: req.user.roles || [],
    targetUserId: req.params.userId,
    ip: req.ip,
    userAgent: req.headers['user-agent'] || ''
  })
  sendJson(res, result)
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
  sendJson(res, result)
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
  sendJson(res, result)
}))

adminRouter.get('/audit-logs', requirePermission(['admin.audit.read']), asyncHandler(async (req, res) => {
  const result = await listAdminOperationLogs({
    page: req.query.page,
    limit: req.query.limit
  })
  sendData(res, result.items, { pagination: result.pagination })
}))

adminRouter.get('/usage/summary', requirePermission(['admin.usage.read_all']), asyncHandler(async (req, res) => {
  const data = await getAdminUsageSummary({
    from: req.query.from,
    to: req.query.to,
    userId: req.query.userId
  })
  sendData(res, data)
}))

adminRouter.get('/usage/timeseries', requirePermission(['admin.usage.read_all']), asyncHandler(async (req, res) => {
  const data = await getAdminUsageTimeseries({
    from: req.query.from,
    to: req.query.to,
    userId: req.query.userId
  })
  sendData(res, data, { granularity: 'day' })
}))

adminRouter.get('/302/balance', requirePermission(['admin.usage.read_all']), handle302Balance)

adminRouter.get('/302/record/:requestId', requirePermission(['admin.usage.read_all']), handle302Record)

adminRouter.get('/302/api-record', requirePermission(['admin.usage.read_all']), handle302ApiRecord)

adminRouter.get('/302/api-keys', requirePermission(['admin.api_key.manage']), handle302ApiKeys)

adminRouter.post('/302/api-keys', requirePermission(['admin.api_key.manage']), handle302CreateApiKey)

adminRouter.put('/302/api-keys/:apiName', requirePermission(['admin.api_key.manage']), handle302UpdateApiKey)

adminRouter.delete('/302/api-keys/:apiName', requirePermission(['admin.api_key.manage']), handle302DeleteApiKey)
