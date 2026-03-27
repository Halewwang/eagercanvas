import { Router } from 'express'
import { authRequired } from '../middleware/auth.js'
import { asyncHandler } from '../utils/http.js'
import {
  createProjectFromTemplate,
  getCurrentWorkspace,
  getProjectTemplateStatus,
  listFeaturedTemplates,
  publishProjectTemplate,
  unpublishProjectTemplate
} from '../services/workspace.service.js'

export const workspaceRouter = Router()
workspaceRouter.use(authRequired)

workspaceRouter.get('/current', asyncHandler(async (req, res) => {
  const workspace = await getCurrentWorkspace(req.user.id)
  res.json({ data: workspace })
}))

workspaceRouter.get('/current/templates', asyncHandler(async (req, res) => {
  const result = await listFeaturedTemplates(req.user.id)
  res.json({ data: result })
}))

workspaceRouter.get('/current/projects/:projectId/template', asyncHandler(async (req, res) => {
  const result = await getProjectTemplateStatus(req.user.id, req.params.projectId)
  res.json({ data: result })
}))

workspaceRouter.put('/current/projects/:projectId/template', asyncHandler(async (req, res) => {
  const result = await publishProjectTemplate(req.user.id, req.params.projectId, req.body)
  res.json({ data: result })
}))

workspaceRouter.delete('/current/projects/:projectId/template', asyncHandler(async (req, res) => {
  const result = await unpublishProjectTemplate(req.user.id, req.params.projectId)
  res.json({ data: result })
}))

workspaceRouter.post('/current/templates/:templateId/use', asyncHandler(async (req, res) => {
  const result = await createProjectFromTemplate(req.user.id, req.params.templateId)
  res.status(201).json({ data: result })
}))
