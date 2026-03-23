import { Router } from 'express'
import { z } from 'zod'
import { env } from '../config/env.js'
import { adminUsageRequired, issueAdminToken } from '../middleware/admin-auth.js'
import { asyncHandler, sendData, sendJson } from '../utils/http.js'
import { HttpError } from '../utils/http.js'
import {
  assignApiKeyToUser,
  listUsersForAdmin,
  unassignApiKeyFromUser
} from '../services/admin-usage.service.js'
import {
  handle302ApiKeyDetail,
  handle302ApiKeys,
  handle302ApiRecord,
  handle302Balance,
  handle302CreateApiKey,
  handle302DeleteApiKey,
  handle302Record,
  handle302UpdateApiKey
} from './dashboard302.handlers.js'

const loginSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1)
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
  sendJson(res, {
    token,
    expiresInSec: Number(env.adminDashboardTokenTtlSec || 86400)
  })
}))

usageAdminRouter.get('/session', adminUsageRequired, asyncHandler(async (req, res) => {
  sendJson(res, { admin: req.admin })
}))

usageAdminRouter.get('/302/balance', adminUsageRequired, handle302Balance)

usageAdminRouter.get('/302/record/:requestId', adminUsageRequired, handle302Record)

usageAdminRouter.get('/302/api-record', adminUsageRequired, handle302ApiRecord)

usageAdminRouter.get('/302/api-keys', adminUsageRequired, handle302ApiKeys)

usageAdminRouter.get('/302/api-keys/:apiName', adminUsageRequired, handle302ApiKeyDetail)

usageAdminRouter.post('/302/api-keys', adminUsageRequired, handle302CreateApiKey)

usageAdminRouter.put('/302/api-keys/:apiName', adminUsageRequired, handle302UpdateApiKey)

usageAdminRouter.delete('/302/api-keys/:apiName', adminUsageRequired, handle302DeleteApiKey)

usageAdminRouter.get('/users', adminUsageRequired, asyncHandler(async (_req, res) => {
  const users = await listUsersForAdmin()
  sendData(res, users)
}))

usageAdminRouter.post('/users/:userId/assignments', adminUsageRequired, asyncHandler(async (req, res) => {
  const payload = assignSchema.parse(req.body || {})
  const result = await assignApiKeyToUser({
    userId: req.params.userId,
    apiName: payload.apiName
  })
  sendJson(res, result)
}))

usageAdminRouter.delete('/users/:userId/assignments/:apiName', adminUsageRequired, asyncHandler(async (req, res) => {
  const result = await unassignApiKeyFromUser({
    userId: req.params.userId,
    apiName: req.params.apiName
  })
  sendJson(res, result)
}))
