import { Router } from 'express'
import { authRequired } from '../middleware/auth.js'
import { asyncHandler } from '../utils/http.js'
import {
  acceptWorkspaceDirectInvite,
  createTeamWorkspace,
  createWorkspaceDirectInvite,
  createWorkspaceLinkInvite,
  createProjectFromTemplate,
  deleteTeamWorkspace,
  favoriteSharedTemplate,
  getCurrentWorkspace,
  getSharedTemplateDetail,
  getWorkspaceMembers,
  getProjectTemplateStatus,
  joinWorkspaceInvite,
  leaveUserWorkspace,
  listFeaturedTemplates,
  listPendingWorkspaceInvites,
  listTemplatesByScope,
  listWorkspaces,
  publishProjectTemplate,
  selectWorkspace,
  updateTeamWorkspace,
  unfavoriteSharedTemplate,
  unpublishProjectTemplate
} from '../services/workspace.service.js'

export const workspaceRouter = Router()
workspaceRouter.use(authRequired)

workspaceRouter.get('/current', asyncHandler(async (req, res) => {
  const workspace = await getCurrentWorkspace(req.user.id)
  res.json({ data: workspace })
}))

workspaceRouter.get('/workspaces', asyncHandler(async (req, res) => {
  const result = await listWorkspaces(req.user.id)
  res.json({ data: result })
}))

workspaceRouter.post('/workspaces', asyncHandler(async (req, res) => {
  const result = await createTeamWorkspace(req.user.id, req.body)
  res.status(201).json({ data: result })
}))

workspaceRouter.post('/workspaces/:workspaceId/select', asyncHandler(async (req, res) => {
  const result = await selectWorkspace(req.user.id, req.params.workspaceId)
  res.json({ data: result })
}))

workspaceRouter.patch('/workspaces/:workspaceId', asyncHandler(async (req, res) => {
  const result = await updateTeamWorkspace(req.user.id, req.params.workspaceId, req.body)
  res.json({ data: result })
}))

workspaceRouter.delete('/workspaces/:workspaceId', asyncHandler(async (req, res) => {
  const result = await deleteTeamWorkspace(req.user.id, req.params.workspaceId)
  res.json({ data: result })
}))

workspaceRouter.get('/workspaces/:workspaceId/members', asyncHandler(async (req, res) => {
  const members = await getWorkspaceMembers(req.user.id, req.params.workspaceId)
  res.json({ data: { members } })
}))

workspaceRouter.post('/workspaces/:workspaceId/invites/link', asyncHandler(async (req, res) => {
  const result = await createWorkspaceLinkInvite(req.user.id, req.params.workspaceId)
  res.status(201).json({ data: result })
}))

workspaceRouter.post('/workspaces/:workspaceId/invites/direct', asyncHandler(async (req, res) => {
  const result = await createWorkspaceDirectInvite(req.user.id, req.params.workspaceId, req.body)
  res.status(201).json({ data: result })
}))

workspaceRouter.post('/join/:token', asyncHandler(async (req, res) => {
  const result = await joinWorkspaceInvite(req.user.id, req.params.token)
  res.json({ data: result })
}))

workspaceRouter.get('/invites/pending', asyncHandler(async (req, res) => {
  const invites = await listPendingWorkspaceInvites(req.user.id)
  res.json({ data: { invites } })
}))

workspaceRouter.post('/invites/:inviteId/accept', asyncHandler(async (req, res) => {
  const result = await acceptWorkspaceDirectInvite(req.user.id, req.params.inviteId)
  res.json({ data: result })
}))

workspaceRouter.post('/workspaces/:workspaceId/leave', asyncHandler(async (req, res) => {
  const result = await leaveUserWorkspace(req.user.id, req.params.workspaceId, req.body)
  res.json({ data: result })
}))

workspaceRouter.get('/current/templates', asyncHandler(async (req, res) => {
  const result = req.query?.scope
    ? await listTemplatesByScope(req.user.id, req.query.scope)
    : await listFeaturedTemplates(req.user.id)
  res.json({ data: result })
}))

workspaceRouter.get('/current/templates/:templateId', asyncHandler(async (req, res) => {
  const result = await getSharedTemplateDetail(req.user.id, req.params.templateId)
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

workspaceRouter.post('/current/templates/:templateId/favorite', asyncHandler(async (req, res) => {
  const result = await favoriteSharedTemplate(req.user.id, req.params.templateId)
  res.json({ data: result })
}))

workspaceRouter.delete('/current/templates/:templateId/favorite', asyncHandler(async (req, res) => {
  const result = await unfavoriteSharedTemplate(req.user.id, req.params.templateId)
  res.json({ data: result })
}))
