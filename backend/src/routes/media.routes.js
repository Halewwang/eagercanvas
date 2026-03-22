import { Router } from 'express'
import { authRequired } from '../middleware/auth.js'
import { asyncHandler } from '../utils/http.js'
import { listGeneratedVideos } from '../services/media.service.js'

export const mediaRouter = Router()
mediaRouter.use(authRequired)

mediaRouter.get('/generated-videos', asyncHandler(async (req, res) => {
  const data = await listGeneratedVideos(req.user.id)
  res.json({ data })
}))
