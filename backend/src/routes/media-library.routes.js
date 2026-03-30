import { Router } from 'express'
import { z } from 'zod'
import { authRequired } from '../middleware/auth.js'
import { listGenerationHistory, listMediaAssets } from '../services/media-library.service.js'
import { asyncHandler } from '../utils/http.js'

const listQuerySchema = z.object({
  projectId: z.string().uuid().optional(),
  limit: z.coerce.number().int().min(1).max(100).optional()
})

export const mediaLibraryRouter = Router()

mediaLibraryRouter.get('/assets', authRequired, asyncHandler(async (req, res) => {
  const query = listQuerySchema.parse(req.query || {})
  const result = await listMediaAssets({
    userId: req.user.id,
    projectId: query.projectId,
    limit: query.limit
  })
  res.json(result)
}))

mediaLibraryRouter.get('/history', authRequired, asyncHandler(async (req, res) => {
  const query = listQuerySchema.parse(req.query || {})
  const result = await listGenerationHistory({
    userId: req.user.id,
    projectId: query.projectId,
    limit: query.limit
  })
  res.json(result)
}))
