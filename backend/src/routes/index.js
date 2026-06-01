import { Router } from 'express'
import { authRequired } from '../middleware/auth.js'
import { asyncHandler } from '../utils/http.js'
import { createChatCompletion, createImageGeneration, createVideoGeneration, getImageTask, getVideoTask, streamChatCompletion } from '../services/runs.service.js'
import { providerRemoveBackground } from '../services/provider.service.js'
import { resolveActiveUserServiceCredential } from '../services/service-access.service.js'
import { adminRouter } from './admin.routes.js'
import { authRouter } from './auth.routes.js'
import { mediaLibraryRouter } from './media-library.routes.js'
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
apiRouter.use('/media-library', mediaLibraryRouter)
apiRouter.use('/usage', usageRouter)
apiRouter.use('/admin', adminRouter)
apiRouter.use('/usage-admin', usageAdminRouter)
apiRouter.use('/upload', uploadRouter)

// Compatibility endpoints for existing frontend hooks
apiRouter.post('/chat/completions', authRequired, asyncHandler(async (req, res) => {
  if (req.body?.stream) {
    res.status(200)
    res.setHeader('Content-Type', 'text/event-stream')
    res.setHeader('Cache-Control', 'no-cache, no-transform')
    res.setHeader('Connection', 'keep-alive')
    await streamChatCompletion(req.user.id, req.body, {
      onEvent: (event) => res.write(event)
    })
    res.end()
    return
  }

  const run = await createChatCompletion(req.user.id, req.body)
  res.json(run.result)
}))

apiRouter.post('/images/generations', authRequired, asyncHandler(async (req, res) => {
  const run = await createImageGeneration(req.user.id, req.body)
  res.json(run.result)
}))

apiRouter.post('/images/remove-background', authRequired, asyncHandler(async (req, res) => {
  const providerAccess = await resolveActiveUserServiceCredential(req.user.id)
  const result = await providerRemoveBackground(
    req.body || {},
    providerAccess?.apiKey ? { apiKey: providerAccess.apiKey } : {}
  )
  res.json(result)
}))

apiRouter.get('/images/:taskId', authRequired, asyncHandler(async (req, res) => {
  const result = await getImageTask(req.user.id, req.params.taskId)
  res.json(result)
}))

apiRouter.post('/videos', authRequired, asyncHandler(async (req, res) => {
  const run = await createVideoGeneration(req.user.id, req.body)
  res.json(run.result)
}))

apiRouter.get('/videos/:taskId', authRequired, asyncHandler(async (req, res) => {
  const result = await getVideoTask(req.user.id, req.params.taskId)
  res.json(result)
}))
