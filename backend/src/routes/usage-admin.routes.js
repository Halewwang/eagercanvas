import { Router } from 'express'
import { z } from 'zod'
import { env } from '../config/env.js'
import { adminUsageRequired, issueAdminToken } from '../middleware/admin-auth.js'
import { asyncHandler } from '../utils/http.js'
import { HttpError } from '../utils/http.js'
import {
  create302ApiKey,
  delete302ApiKey,
  get302ApiKey,
  get302ApiKeys,
  get302ApiRecords,
  get302ApiRecordsForApiName,
  get302Balance,
  get302RecordByRequestId,
  normalize302ApiKeyList,
  normalize302ApiRecordList,
  update302ApiKey
} from '../services/dashboard302.service.js'
import { assignApiKeyToUser, listUsersForAdmin, removeApiKeyAssignments, unassignApiKeyFromUser } from '../services/admin-usage.service.js'

const loginSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1)
})

const apiKeySchema = z.object({
  api_name: z.string().min(1),
  allow_save_logs: z.boolean().default(false),
  allow_custom_model: z.boolean().default(false),
  allow_manage_key: z.boolean().default(false),
  limit_cost: z.number().int().nonnegative().default(0),
  limit_daily_cost: z.number().int().nonnegative().default(0),
  expired_on: z.number().int().nonnegative().default(0)
})

const assignSchema = z.object({
  apiName: z.string().min(1)
})

export const usageAdminRouter = Router()

usageAdminRouter.post('/login', asyncHandler(async (req, res) => {
  const payload = loginSchema.parse(req.body || {})

  const adminUser = String(env.adminDashboardUsername || '').trim()
  const adminPass = String(env.adminDashboardPassword || '').trim()
  if (!adminUser || !adminPass) {
    throw new HttpError(500, 'Admin dashboard credentials are not configured', 'ADMIN_NOT_CONFIGURED')
  }

  if (payload.username !== adminUser || payload.password !== adminPass) {
    throw new HttpError(401, 'Invalid admin credentials', 'ADMIN_LOGIN_FAILED')
  }

  const token = issueAdminToken({ username: payload.username })
  res.json({
    token,
    expiresInSec: Number(env.adminDashboardTokenTtlSec || 86400)
  })
}))

usageAdminRouter.get('/session', adminUsageRequired, asyncHandler(async (req, res) => {
  res.json({ admin: req.admin })
}))

usageAdminRouter.get('/302/balance', adminUsageRequired, asyncHandler(async (_req, res) => {
  const result = await get302Balance()
  res.json({ data: result?.data ?? result })
}))

usageAdminRouter.get('/302/record/:requestId', adminUsageRequired, asyncHandler(async (req, res) => {
  const result = await get302RecordByRequestId(req.params.requestId)
  res.json({ data: result?.data ?? result })
}))

usageAdminRouter.get('/302/api-record', adminUsageRequired, asyncHandler(async (req, res) => {
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

usageAdminRouter.get('/302/api-keys', adminUsageRequired, asyncHandler(async (_req, res) => {
  const result = await get302ApiKeys()
  res.json({ data: normalize302ApiKeyList(result) })
}))

usageAdminRouter.get('/302/api-keys/:apiName', adminUsageRequired, asyncHandler(async (req, res) => {
  const result = await get302ApiKey(req.params.apiName)
  res.json({ data: result?.data ?? result })
}))

usageAdminRouter.post('/302/api-keys', adminUsageRequired, asyncHandler(async (req, res) => {
  const payload = apiKeySchema.parse(req.body || {})
  const result = await create302ApiKey(payload)
  res.json({ data: result?.data ?? result, msg: result?.msg || 'success' })
}))

usageAdminRouter.put('/302/api-keys/:apiName', adminUsageRequired, asyncHandler(async (req, res) => {
  const payload = apiKeySchema.parse(req.body || {})
  const result = await update302ApiKey(req.params.apiName, payload)
  res.json({ data: result?.data ?? result, msg: result?.msg || 'success' })
}))

usageAdminRouter.delete('/302/api-keys/:apiName', adminUsageRequired, asyncHandler(async (req, res) => {
  const result = await delete302ApiKey(req.params.apiName)
  await removeApiKeyAssignments(req.params.apiName)
  res.json({ data: result?.data ?? result, msg: result?.msg || 'success' })
}))

usageAdminRouter.get('/users', adminUsageRequired, asyncHandler(async (_req, res) => {
  const users = await listUsersForAdmin()
  res.json({ data: users })
}))

usageAdminRouter.post('/users/:userId/assignments', adminUsageRequired, asyncHandler(async (req, res) => {
  const payload = assignSchema.parse(req.body || {})
  const result = await assignApiKeyToUser({
    userId: req.params.userId,
    apiName: payload.apiName
  })
  res.json(result)
}))

usageAdminRouter.delete('/users/:userId/assignments/:apiName', adminUsageRequired, asyncHandler(async (req, res) => {
  const result = await unassignApiKeyFromUser({
    userId: req.params.userId,
    apiName: req.params.apiName
  })
  res.json(result)
}))
