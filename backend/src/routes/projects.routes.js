import { Router } from 'express'
import { authRequired } from '../middleware/auth.js'
import { asyncHandler, sendData, sendJson } from '../utils/http.js'
import {
  createProject,
  getProject,
  listProjects,
  removeProject,
  updateProject
} from '../services/projects.service.js'

export const projectsRouter = Router()
projectsRouter.use(authRequired)

projectsRouter.get('/', asyncHandler(async (req, res) => {
  const projects = await listProjects(req.user.id)
  sendData(res, projects)
}))

projectsRouter.post('/', asyncHandler(async (req, res) => {
  const project = await createProject(req.user.id, req.body)
  sendData(res, project, { status: 201 })
}))

projectsRouter.get('/:id', asyncHandler(async (req, res) => {
  const project = await getProject(req.user.id, req.params.id)
  sendData(res, project)
}))

projectsRouter.patch('/:id', asyncHandler(async (req, res) => {
  const project = await updateProject(req.user.id, req.params.id, req.body)
  sendData(res, project)
}))

projectsRouter.delete('/:id', asyncHandler(async (req, res) => {
  const result = await removeProject(req.user.id, req.params.id)
  sendJson(res, result)
}))
