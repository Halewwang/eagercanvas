import { Router } from 'express'
import { authRequired } from '../middleware/auth.js'
import { asyncHandler } from '../utils/http.js'
import { createChatCompletion, create3DGeneration, createImageGeneration, createVideoGeneration, get3DTask, getVideoTask } from '../services/runs.service.js'
import { providerRemoveBackground } from '../services/provider.service.js'
import { adminRouter } from './admin.routes.js'
import { authRouter } from './auth.routes.js'
import { projectsRouter } from './projects.routes.js'
import { runsRouter } from './runs.routes.js'
import { usageRouter } from './usage.routes.js'
import { usageAdminRouter } from './usage-admin.routes.js'
import { workspaceRouter } from './workspace.routes.js'

import { uploadRouter } from './upload.routes.js'

export const apiRouter = Router()

apiRouter.get('/health', (_req, res) => {
  res.json({ ok: true, service: 'eagercanvas-api' })
})

apiRouter.use('/auth', authRouter)
apiRouter.use('/projects', projectsRouter)
apiRouter.use('/workspace', workspaceRouter)
apiRouter.use('/runs', runsRouter)
apiRouter.use('/usage', usageRouter)
apiRouter.use('/admin', adminRouter)
apiRouter.use('/usage-admin', usageAdminRouter)
apiRouter.use('/upload', uploadRouter)

// Compatibility endpoints for existing frontend hooks
apiRouter.post('/chat/completions', authRequired, asyncHandler(async (req, res) => {
  const run = await createChatCompletion(req.user.id, req.body)
  res.json(run.result)
}))

apiRouter.post('/images/generations', authRequired, asyncHandler(async (req, res) => {
  const run = await createImageGeneration(req.user.id, req.body)
  res.json(run.result)
}))

apiRouter.post('/images/remove-background', authRequired, asyncHandler(async (req, res) => {
  const result = await providerRemoveBackground(req.body || {})
  res.json(result)
}))

apiRouter.post('/3d/generations', authRequired, asyncHandler(async (req, res) => {
  const run = await create3DGeneration(req.user.id, req.body)
  res.json(run.result)
}))

apiRouter.post('/videos', authRequired, asyncHandler(async (req, res) => {
  const run = await createVideoGeneration(req.user.id, req.body)
  res.json(run.result)
}))

apiRouter.get('/3d/:taskId', authRequired, asyncHandler(async (req, res) => {
  const result = await get3DTask(req.user.id, req.params.taskId)
  res.json(result)
}))

apiRouter.get('/videos/:taskId', authRequired, asyncHandler(async (req, res) => {
  const result = await getVideoTask(req.user.id, req.params.taskId)
  res.json(result)
}))
