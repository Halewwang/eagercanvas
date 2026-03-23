import { Router } from 'express'
import { authRequired } from '../middleware/auth.js'
import { asyncHandler, sendData, sendJson } from '../utils/http.js'
import {
  handleCompatChatCompletions,
  handleCompatImageGenerations,
  handleCompatVideoTask,
  handleCompatVideos
} from './compat-runs.handlers.js'
import {
  createRun,
  getRunById
} from '../services/runs.service.js'

export const runsRouter = Router()
runsRouter.use(authRequired)

runsRouter.post('/', asyncHandler(async (req, res) => {
  const run = await createRun(req.user.id, req.body)
  sendJson(res, run, 201)
}))

runsRouter.get('/:id', asyncHandler(async (req, res) => {
  const run = await getRunById(req.user.id, req.params.id)
  sendData(res, run)
}))

// Backward-compatible endpoints for existing frontend hooks
runsRouter.post('/compat/chat/completions', handleCompatChatCompletions)

runsRouter.post('/compat/images/generations', handleCompatImageGenerations)

runsRouter.post('/compat/videos', handleCompatVideos)

runsRouter.get('/compat/videos/:taskId', handleCompatVideoTask)
