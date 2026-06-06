import { Router } from 'express'
import { z } from 'zod'
import { queueIssueEvent } from '../services/issue-events.service.js'
import { asyncHandler } from '../utils/http.js'

export const observabilityRouter = Router()

const MAX_BATCH_SIZE = 10
const ANONYMOUS_MAX_REQUESTS_PER_MINUTE = 20
const ANONYMOUS_LIMIT_WINDOW_MS = 60_000
const anonymousBuckets = new Map()
const ANONYMOUS_ALLOWED_CATEGORIES = new Set([
  'runtime_error',
  'route_load_error',
  'unhandled_rejection',
  'performance'
])

const eventSchema = z.object({
  source_layer: z.string().optional(),
  category: z.string().optional(),
  severity: z.string().optional(),
  environment: z.string().optional(),
  build_id: z.string().optional(),
  release_commit: z.string().optional(),
  session_hash: z.string().optional(),
  request_id: z.string().optional(),
  trace_id: z.string().optional(),
  route: z.string().optional(),
  route_name: z.string().optional(),
  component: z.string().optional(),
  method: z.string().optional(),
  path_template: z.string().optional(),
  status_code: z.number().int().optional(),
  duration_ms: z.number().int().optional(),
  provider: z.string().optional(),
  model: z.string().optional(),
  error_code: z.string().optional(),
  message_summary: z.string().optional(),
  stack_summary: z.string().optional(),
  metadata: z.record(z.string(), z.unknown()).optional()
}).passthrough()

export const isAnonymousIssueEventAllowed = (event = {}) => {
  if (event.source_layer !== 'frontend') return false
  if (!ANONYMOUS_ALLOWED_CATEGORIES.has(String(event.category || ''))) return false
  const metadata = event.metadata && typeof event.metadata === 'object' ? event.metadata : {}
  const metadataText = JSON.stringify(metadata).toLowerCase()
  return !/(prompt|token|cookie|authorization|api_key|canvas_json|media|image|file|localstorage|local_storage|data:image)/.test(metadataText)
}

export const isAnonymousIssueReportRateLimited = ({
  key = 'anonymous',
  now = Date.now()
} = {}) => {
  const windowStart = now - ANONYMOUS_LIMIT_WINDOW_MS
  const events = (anonymousBuckets.get(key) || []).filter((timestamp) => timestamp >= windowStart)
  if (events.length >= ANONYMOUS_MAX_REQUESTS_PER_MINUTE) {
    anonymousBuckets.set(key, events)
    return true
  }
  events.push(now)
  anonymousBuckets.set(key, events)
  return false
}

export const normalizeIssueEventBatch = (body = {}, { isAuthenticated = false } = {}) => {
  const events = Array.isArray(body.events) ? body.events.slice(0, MAX_BATCH_SIZE) : []
  const accepted = []
  let dropped = 0

  for (const raw of events) {
    const parsed = eventSchema.safeParse(raw)
    if (!parsed.success) {
      dropped += 1
      continue
    }
    const event = parsed.data
    if (!isAuthenticated && !isAnonymousIssueEventAllowed(event)) {
      dropped += 1
      continue
    }
    const { user_id: _userId, ...safeEvent } = event
    accepted.push(safeEvent)
  }

  dropped += Math.max(0, Array.isArray(body.events) ? body.events.length - MAX_BATCH_SIZE : 0)
  return { accepted, dropped }
}

observabilityRouter.post('/events', asyncHandler(async (req, res) => {
  const isAuthenticated = String(req.headers.authorization || '').toLowerCase().startsWith('bearer ')
  if (!isAuthenticated && isAnonymousIssueReportRateLimited({ key: req.ip || 'anonymous' })) {
    return res.status(202).json({ ok: true, accepted: 0, dropped: Array.isArray(req.body?.events) ? req.body.events.length : 0 })
  }
  const { accepted, dropped } = normalizeIssueEventBatch(req.body || {}, { isAuthenticated })
  const results = await Promise.all(accepted.map((event) => queueIssueEvent({
    ...event,
    request_id: event.request_id || req.requestId,
    metadata: {
      ...(event.metadata || {}),
      user_agent: req.headers['user-agent'] || ''
    }
  })))
  const written = results.filter((result) => result?.ok).length
  res.json({ ok: true, accepted: written, dropped: dropped + (accepted.length - written) })
}))
