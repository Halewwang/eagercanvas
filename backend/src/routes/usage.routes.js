import { Router } from 'express'
import { authRequired } from '../middleware/auth.js'
import { requirePermission } from '../middleware/authz.js'
import { asyncHandler } from '../utils/http.js'
import { getUsageSummary, getUsageTimeseries } from '../services/usage.service.js'
import {
  get302ApiKeys,
  get302ApiRecords,
  get302Balance,
  get302RecordByRequestId,
  normalize302ApiRecordList
} from '../services/dashboard302.service.js'

export const usageRouter = Router()
usageRouter.use(authRequired)

usageRouter.get('/summary', asyncHandler(async (req, res) => {
  const summary = await getUsageSummary(req.user.id, req.query.from, req.query.to)
  res.json({ data: summary })
}))

usageRouter.get('/timeseries', asyncHandler(async (req, res) => {
  const series = await getUsageTimeseries(req.user.id)
  res.json({ data: series, granularity: req.query.granularity || 'day' })
}))


usageRouter.get('/302/balance', requirePermission(['admin.usage.read_all']), asyncHandler(async (_req, res) => {
  const result = await get302Balance()
  res.json({ data: result?.data ?? result })
}))

usageRouter.get('/302/record/:requestId', requirePermission(['admin.usage.read_all']), asyncHandler(async (req, res) => {
  const result = await get302RecordByRequestId(req.params.requestId)
  res.json({ data: result?.data ?? result })
}))

usageRouter.get('/302/api-record', requirePermission(['admin.usage.read_all']), asyncHandler(async (req, res) => {
  const result = await get302ApiRecords({
    page: req.query.page,
    limit: req.query.limit,
    start_time: req.query.start_time,
    end_time: req.query.end_time
  })
  const normalized = normalize302ApiRecordList(result)

  res.json({
    data: {
      items: normalized.items,
      pagination: normalized.pagination
    }
  })
}))

usageRouter.get('/302/api-keys', requirePermission(['admin.usage.read_all']), asyncHandler(async (_req, res) => {
  const result = await get302ApiKeys()
  res.json({ data: Array.isArray(result?.data) ? result.data : [] })
}))
