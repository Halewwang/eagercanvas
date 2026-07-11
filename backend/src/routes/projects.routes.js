import { Router } from 'express'
import { authRequired } from '../middleware/auth.js'
import { asyncHandler } from '../utils/http.js'
import {
  copyProjectToWorkspace,
  createProject,
  getProject,
  getProjectEditRequests,
  getProjectPermissions,
  listProjects,
  removeProject,
  requestProjectEditAccess,
  reviewProjectEditAccess,
  shareProjectWithUser,
  updateProjectPermission,
  updateProject
} from '../services/projects.service.js'

export const projectsRouter = Router()
projectsRouter.use(authRequired)

projectsRouter.get('/', asyncHandler(async (req, res) => {
  const workspaceId = typeof req.query.workspaceId === 'string'
    ? req.query.workspaceId.trim()
    : ''
  const projects = await listProjects(req.user.id, { workspaceId })
  res.json({ data: projects })
}))

projectsRouter.post('/', asyncHandler(async (req, res) => {
  const project = await createProject(req.user.id, req.body)
  res.status(201).json({ data: project })
}))

projectsRouter.post('/:id/copy-to-workspace', asyncHandler(async (req, res) => {
  const project = await copyProjectToWorkspace(req.user.id, req.params.id, req.body)
  res.status(201).json({ data: project })
}))

projectsRouter.post('/:id/shares', asyncHandler(async (req, res) => {
  const share = await shareProjectWithUser(req.user.id, req.params.id, req.body)
  res.status(201).json({ data: share })
}))

projectsRouter.get('/:id', asyncHandler(async (req, res) => {
  const project = await getProject(req.user.id, req.params.id)
  res.json({ data: project })
}))

projectsRouter.patch('/:id', asyncHandler(async (req, res) => {
  const project = await updateProject(req.user.id, req.params.id, req.body)
  res.json({ data: project })
}))

projectsRouter.post('/:id/edit-requests', asyncHandler(async (req, res) => {
  const result = await requestProjectEditAccess(req.user.id, req.params.id, req.body)
  res.status(201).json({ data: result })
}))

projectsRouter.get('/:id/edit-requests', asyncHandler(async (req, res) => {
  const result = await getProjectEditRequests(req.user.id, req.params.id)
  res.json({ data: result })
}))

projectsRouter.post('/:id/edit-requests/:requestId/review', asyncHandler(async (req, res) => {
  const result = await reviewProjectEditAccess(req.user.id, req.params.id, req.params.requestId, req.body)
  res.json({ data: result })
}))

projectsRouter.get('/:id/permissions', asyncHandler(async (req, res) => {
  const result = await getProjectPermissions(req.user.id, req.params.id)
  res.json({ data: result })
}))

projectsRouter.patch('/:id/permissions/:userId', asyncHandler(async (req, res) => {
  const result = await updateProjectPermission(req.user.id, req.params.id, req.params.userId, req.body)
  res.json({ data: result })
}))

projectsRouter.delete('/:id', asyncHandler(async (req, res) => {
  const result = await removeProject(req.user.id, req.params.id)
  res.json(result)
}))
