import { z } from 'zod'
import { asyncHandler, sendData } from '../utils/http.js'
import {
  create302ApiKey,
  delete302ApiKey,
  get302ApiKey,
  get302ApiKeys,
  get302ApiRecords,
  get302Balance,
  get302RecordByRequestId,
  update302ApiKey
} from '../services/dashboard302.service.js'

export const dashboard302ApiKeySchema = z.object({
  api_name: z.string().min(1),
  allow_save_logs: z.boolean().default(false),
  allow_custom_model: z.boolean().default(false),
  allow_manage_key: z.boolean().default(false),
  limit_cost: z.number().int().nonnegative().default(0),
  limit_daily_cost: z.number().int().nonnegative().default(0),
  expired_on: z.number().int().nonnegative().default(0)
})

export const handle302Balance = asyncHandler(async (_req, res) => {
  const result = await get302Balance()
  sendData(res, result?.data ?? result)
})

export const handle302Record = asyncHandler(async (req, res) => {
  const result = await get302RecordByRequestId(req.params.requestId)
  sendData(res, result?.data ?? result)
})

export const handle302ApiRecord = asyncHandler(async (req, res) => {
  const result = await get302ApiRecords({
    page: req.query.page,
    limit: req.query.limit,
    start_time: req.query.start_time,
    end_time: req.query.end_time
  })

  sendData(res, {
    items: Array.isArray(result?.items) ? result.items : [],
    pagination: result?.pagination || null
  })
})

export const handle302ApiKeys = asyncHandler(async (_req, res) => {
  const result = await get302ApiKeys()
  sendData(res, Array.isArray(result?.data) ? result.data : [])
})

export const handle302ApiKeyDetail = asyncHandler(async (req, res) => {
  const result = await get302ApiKey(req.params.apiName)
  sendData(res, result?.data ?? result)
})

export const handle302CreateApiKey = asyncHandler(async (req, res) => {
  const payload = dashboard302ApiKeySchema.parse(req.body || {})
  const result = await create302ApiKey(payload)
  sendData(res, result?.data ?? result, { msg: result?.msg || 'success' })
})

export const handle302UpdateApiKey = asyncHandler(async (req, res) => {
  const payload = dashboard302ApiKeySchema.parse(req.body || {})
  const result = await update302ApiKey(req.params.apiName, payload)
  sendData(res, result?.data ?? result, { msg: result?.msg || 'success' })
})

export const handle302DeleteApiKey = asyncHandler(async (req, res) => {
  const result = await delete302ApiKey(req.params.apiName)
  sendData(res, result?.data ?? result, { msg: result?.msg || 'success' })
})
