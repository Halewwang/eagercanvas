import { Router } from 'express'
import { z } from 'zod'
import { authRequired } from '../middleware/auth.js'
import { requirePermission } from '../middleware/authz.js'
import { requireAdminLifecycleMutationEnabled } from '../middleware/admin-lifecycle-release-guard.js'
import { asyncHandler } from '../utils/http.js'
import { listUsersForAdmin } from '../services/admin-users-list.js'
import { getAdminUserDetail } from '../services/admin-user-detail.js'
import { deleteUserAccount, restoreUserAccount, updateUserStatus, updateUserRoles } from '../services/admin-user-management.js'
import { listAdminOperationLogs } from '../services/admin-operation-logs.js'
import { createUserServiceCredential, disableUserServiceCredential } from '../services/service-access.service.js'

export const adminRouter = Router()
adminRouter.use(authRequired)

const updateRolesSchema = z.object({
  roleCodes: z.array(z.string().min(1)).min(1)
})

const updateUserStatusSchema = z.object({
  status: z.enum(['active', 'suspended']),
  reason: z.string().trim().min(1).max(500).optional()
}).superRefine((value, ctx) => {
  if (value.status === 'suspended' && !value.reason) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['reason'], message: 'reason is required for suspension' })
  }
})

const adminReasonSchema = z.object({
  reason: z.string().trim().min(1).max(500)
})

const disableServiceSchema = z.object({
  reason: z.string().trim().max(200).optional()
})

adminRouter.get('/session', requirePermission(['admin.user.read']), asyncHandler(async (req, res) => {
  res.json({
    user: {
      id: req.user.id,
      email: req.user.email
    },
    roles: req.user.roles || [],
    permissions: req.user.permissions || []
  })
}))

adminRouter.get('/users', requirePermission(['admin.user.read']), asyncHandler(async (req, res) => {
  res.json({ data: await listUsersForAdmin(req.query) })
}))

adminRouter.get('/users/:userId/audit', requirePermission(['admin.audit.read']), asyncHandler(async (req, res) => {
  const data = await listAdminOperationLogs({
    page: req.query.page,
    limit: req.query.limit,
    targetUserId: req.params.userId,
    requireTarget: true
  })
  res.json({ data })
}))

adminRouter.get('/users/:userId', requirePermission(['admin.user.read']), asyncHandler(async (req, res) => {
  const data = await getAdminUserDetail(req.params.userId)
  res.json({ data })
}))

adminRouter.patch('/users/:userId/roles', requirePermission(['admin.user.role.update']), requireAdminLifecycleMutationEnabled, asyncHandler(async (req, res) => {
  const payload = updateRolesSchema.parse(req.body || {})
  const result = await updateUserRoles({
    operatorUserId: req.user.id,
    operatorRoles: req.user.roles || [],
    targetUserId: req.params.userId,
    roleCodes: payload.roleCodes,
    ip: req.ip,
    userAgent: req.headers['user-agent'] || '',
    requestId: req.requestId
  })
  res.json(result)
}))

adminRouter.patch('/users/:userId/status', requirePermission(['admin.user.status.update']), requireAdminLifecycleMutationEnabled, asyncHandler(async (req, res) => {
  const payload = updateUserStatusSchema.parse(req.body || {})
  const result = await updateUserStatus({
    operatorUserId: req.user.id,
    operatorRoles: req.user.roles || [],
    targetUserId: req.params.userId,
    status: payload.status,
    reason: payload.reason,
    ip: req.ip,
    userAgent: req.headers['user-agent'] || '',
    requestId: req.requestId
  })
  res.json(result)
}))

adminRouter.delete('/users/:userId', requirePermission(['admin.user.delete']), requireAdminLifecycleMutationEnabled, asyncHandler(async (req, res) => {
  const { reason } = adminReasonSchema.parse(req.body || {})
  const result = await deleteUserAccount({
    operatorUserId: req.user.id,
    operatorRoles: req.user.roles || [],
    targetUserId: req.params.userId,
    reason,
    ip: req.ip,
    userAgent: req.headers['user-agent'],
    requestId: req.requestId
  })
  res.json(result)
}))

adminRouter.post('/users/:userId/restore', requirePermission(['admin.user.restore']), requireAdminLifecycleMutationEnabled, asyncHandler(async (req, res) => {
  const { reason } = adminReasonSchema.parse(req.body || {})
  const result = await restoreUserAccount({
    operatorUserId: req.user.id,
    operatorRoles: req.user.roles || [],
    targetUserId: req.params.userId,
    reason,
    ip: req.ip,
    userAgent: req.headers['user-agent'],
    requestId: req.requestId
  })
  res.json(result)
}))

adminRouter.post('/users/:userId/service-access/activate', requirePermission(['admin.service_access.activate']), requireAdminLifecycleMutationEnabled, asyncHandler(async (req, res) => {
  const result = await createUserServiceCredential({
    userId: req.params.userId,
    operatorUserId: req.user.id,
    ip: req.ip,
    userAgent: req.headers['user-agent'] || '',
    requestId: req.requestId
  })
  res.json({ ok: true, data: { userId: req.params.userId, ...result.serviceCredential } })
}))

adminRouter.post('/users/:userId/service-access/disable', requirePermission(['admin.service_access.disable']), requireAdminLifecycleMutationEnabled, asyncHandler(async (req, res) => {
  const payload = disableServiceSchema.parse(req.body || {})
  const result = await disableUserServiceCredential({
    userId: req.params.userId,
    operatorUserId: req.user.id,
    reason: payload.reason,
    ip: req.ip,
    userAgent: req.headers['user-agent'] || '',
    requestId: req.requestId
  })
  res.json({ ok: true, data: { userId: req.params.userId, ...result.serviceCredential } })
}))

adminRouter.get('/audit-logs', requirePermission(['admin.audit.read']), asyncHandler(async (req, res) => {
  const result = await listAdminOperationLogs({
    page: req.query.page,
    limit: req.query.limit
  })
  res.json({ data: result.items, pagination: result.pagination })
}))
