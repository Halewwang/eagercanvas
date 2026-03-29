import { Router } from 'express'
import { authRequired } from '../middleware/auth.js'
import { asyncHandler } from '../utils/http.js'
import {
  createRun,
  getRunById
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
