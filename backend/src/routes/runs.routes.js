import { Router } from 'express'
import { authRequired } from '../middleware/auth.js'
import { asyncHandler } from '../utils/http.js'
import {
  createChatCompletion,
  createImageGeneration,
  createRun,
  createVideoGeneration,
  getRunById,
  getVideoTask
} from '../services/runs.service.js'

export const runsRouter = Router()
runsRouter.use(authRequired)

runsRouter.post('/', asyncHandler(async (req, res) => {
  const run = await createRun(req.user.id, req.body)
  res.status(201).json(run)
}))

runsRouter.get('/:id', asyncHandler(async (req, res) => {
  const run = await getRunById(req.user.id, req.params.id)
  res.json({ data: run })
}))

// Backward-compatible endpoints for existing frontend hooks
runsRouter.post('/compat/chat/completions', asyncHandler(async (req, res) => {
  const run = await createChatCompletion(req.user.id, req.body)
  res.json(run.result)
}))

runsRouter.post('/compat/images/generations', asyncHandler(async (req, res) => {
  const run = await createImageGeneration(req.user.id, req.body)
  res.json(run.result)
}))

runsRouter.post('/compat/videos', asyncHandler(async (req, res) => {
  const run = await createVideoGeneration(req.user.id, req.body)
  res.json(run.result)
}))

runsRouter.get('/compat/videos/:taskId', asyncHandler(async (req, res) => {
  const result = await getVideoTask(req.user.id, req.params.taskId)
  res.json(result)
}))
