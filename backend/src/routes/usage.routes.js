import { Router } from 'express'
import { authRequired } from '../middleware/auth.js'
import { asyncHandler } from '../utils/http.js'
import { getUsageSummary, getUsageTimeseries } from '../services/usage.service.js'

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
