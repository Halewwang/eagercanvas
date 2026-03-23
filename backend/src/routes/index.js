import { Router } from 'express'
import { authRequired } from '../middleware/auth.js'
import { sendJson } from '../utils/http.js'
import { adminRouter } from './admin.routes.js'
import { authRouter } from './auth.routes.js'
import {
  handleCompatChatCompletions,
  handleCompatImageGenerations,
  handleCompatRemoveBackground,
  handleCompatVideoTask,
  handleCompatVideos
} from './compat-runs.handlers.js'
import { projectsRouter } from './projects.routes.js'
import { runsRouter } from './runs.routes.js'
import { usageRouter } from './usage.routes.js'
import { usageAdminRouter } from './usage-admin.routes.js'

import { uploadRouter } from './upload.routes.js'

export const apiRouter = Router()

apiRouter.get('/health', (_req, res) => {
  sendJson(res, { ok: true, service: 'eagercanvas-api' })
})

apiRouter.use('/auth', authRouter)
apiRouter.use('/projects', projectsRouter)
apiRouter.use('/runs', runsRouter)
apiRouter.use('/usage', usageRouter)
apiRouter.use('/admin', adminRouter)
apiRouter.use('/usage-admin', usageAdminRouter)
apiRouter.use('/upload', uploadRouter)

// Compatibility endpoints for existing frontend hooks
apiRouter.post('/chat/completions', authRequired, handleCompatChatCompletions)

apiRouter.post('/images/generations', authRequired, handleCompatImageGenerations)

apiRouter.post('/images/remove-background', authRequired, handleCompatRemoveBackground)

apiRouter.post('/videos', authRequired, handleCompatVideos)

apiRouter.get('/videos/:taskId', authRequired, handleCompatVideoTask)
