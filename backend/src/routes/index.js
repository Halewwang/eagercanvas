import { Router } from 'express'
import { authRequired } from '../middleware/auth.js'
import { asyncHandler } from '../utils/http.js'
import { createChatCompletion, createImageGeneration, createVideoGeneration, getVideoTask } from '../services/runs.service.js'
import { authRouter } from './auth.routes.js'
import { projectsRouter } from './projects.routes.js'
import { runsRouter } from './runs.routes.js'
import { usageRouter } from './usage.routes.js'

export const apiRouter = Router()

apiRouter.get('/health', (_req, res) => {
  res.json({ ok: true, service: 'eagercanvas-api' })
})

apiRouter.use('/auth', authRouter)
apiRouter.use('/projects', projectsRouter)
apiRouter.use('/runs', runsRouter)
apiRouter.use('/usage', usageRouter)

// Compatibility endpoints for existing frontend hooks
apiRouter.post('/chat/completions', authRequired, asyncHandler(async (req, res) => {
  const run = await createChatCompletion(req.user.id, req.body)
  res.json(run.result)
}))

apiRouter.post('/images/generations', authRequired, asyncHandler(async (req, res) => {
  const run = await createImageGeneration(req.user.id, req.body)
  res.json(run.result)
}))

apiRouter.post('/videos', authRequired, asyncHandler(async (req, res) => {
  const run = await createVideoGeneration(req.user.id, req.body)
  res.json(run.result)
}))

apiRouter.get('/videos/:taskId', authRequired, asyncHandler(async (req, res) => {
  const result = await getVideoTask(req.user.id, req.params.taskId)
  res.json(result)
}))
