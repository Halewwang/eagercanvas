import { apiRequest } from './_httpClient.js'

export const apiGetCurrentWorkspace = () =>
  apiRequest({
    url: '/workspace/current',
    method: 'get',
    silentNetworkErrorToast: true
  })

export const apiListWorkspaces = () =>
  apiRequest({
    url: '/workspace/workspaces',
    method: 'get',
    silentNetworkErrorToast: true
  })

export const apiCreateTeamWorkspace = (payload) =>
  apiRequest({
    url: '/workspace/workspaces',
    method: 'post',
    data: payload,
    silentNetworkErrorToast: true
  })

export const apiUpdateTeamWorkspace = (workspaceId, payload) =>
  apiRequest({
    url: `/workspace/workspaces/${encodeURIComponent(workspaceId)}`,
    method: 'patch',
    data: payload,
    silentNetworkErrorToast: true
  })

export const apiDeleteTeamWorkspace = (workspaceId) =>
  apiRequest({
    url: `/workspace/workspaces/${encodeURIComponent(workspaceId)}`,
    method: 'delete',
    silentNetworkErrorToast: true
  })

export const apiSelectWorkspace = (workspaceId) =>
  apiRequest({
    url: `/workspace/workspaces/${encodeURIComponent(workspaceId)}/select`,
    method: 'post',
    silentNetworkErrorToast: true
  })

export const apiListWorkspaceMembers = (workspaceId) =>
  apiRequest({
    url: `/workspace/workspaces/${encodeURIComponent(workspaceId)}/members`,
    method: 'get',
    silentNetworkErrorToast: true
  })

export const apiCreateWorkspaceInviteLink = (workspaceId) =>
  apiRequest({
    url: `/workspace/workspaces/${encodeURIComponent(workspaceId)}/invites/link`,
    method: 'post',
    silentNetworkErrorToast: true
  })

export const apiCreateWorkspaceDirectInvite = (workspaceId, payload) =>
  apiRequest({
    url: `/workspace/workspaces/${encodeURIComponent(workspaceId)}/invites/direct`,
    method: 'post',
    data: payload,
    silentNetworkErrorToast: true
  })

export const apiJoinWorkspaceInvite = (token) =>
  apiRequest({
    url: `/workspace/join/${encodeURIComponent(token)}`,
    method: 'post',
    silentNetworkErrorToast: true
  })

export const apiListPendingWorkspaceInvites = () =>
  apiRequest({
    url: '/workspace/invites/pending',
    method: 'get',
    silentNetworkErrorToast: true
  })

export const apiGetWorkspaceInbox = () =>
  apiRequest({
    url: '/workspace/inbox',
    method: 'get',
    silentNetworkErrorToast: true
  })

export const apiAcceptWorkspaceInvite = (inviteId) =>
  apiRequest({
    url: `/workspace/invites/${encodeURIComponent(inviteId)}/accept`,
    method: 'post',
    silentNetworkErrorToast: true
  })

export const apiLeaveWorkspace = (workspaceId, payload = {}) =>
  apiRequest({
    url: `/workspace/workspaces/${encodeURIComponent(workspaceId)}/leave`,
    method: 'post',
    data: payload,
    silentNetworkErrorToast: true
  })

export const apiListFeaturedTemplates = (params = {}) =>
  apiRequest({
    url: '/workspace/current/templates',
    method: 'get',
    params,
    silentNetworkErrorToast: true
  })

export const apiGetSharedTemplate = (templateId) =>
  apiRequest({
    url: `/workspace/current/templates/${encodeURIComponent(templateId)}`,
    method: 'get',
    silentNetworkErrorToast: true
  })

export const apiGetProjectTemplateStatus = (projectId) =>
  apiRequest({
    url: `/workspace/current/projects/${projectId}/template`,
    method: 'get',
    silentNetworkErrorToast: true
  })

export const apiPublishProjectTemplate = (projectId, payload) =>
  apiRequest({
    url: `/workspace/current/projects/${projectId}/template`,
    method: 'put',
    data: payload,
    silentNetworkErrorToast: true
  })

export const apiUnpublishProjectTemplate = (projectId) =>
  apiRequest({
    url: `/workspace/current/projects/${projectId}/template`,
    method: 'delete',
    silentNetworkErrorToast: true
  })

export const apiUseSharedTemplate = (templateId) =>
  apiRequest({
    url: `/workspace/current/templates/${templateId}/use`,
    method: 'post',
    silentNetworkErrorToast: true
  })

export const apiFavoriteSharedTemplate = (templateId) =>
  apiRequest({
    url: `/workspace/current/templates/${encodeURIComponent(templateId)}/favorite`,
    method: 'post',
    silentNetworkErrorToast: true
  })

export const apiUnfavoriteSharedTemplate = (templateId) =>
  apiRequest({
    url: `/workspace/current/templates/${encodeURIComponent(templateId)}/favorite`,
    method: 'delete',
    silentNetworkErrorToast: true
  })
