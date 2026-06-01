import { apiRequest } from './_httpClient.js'

export const apiGetCurrentWorkspace = () =>
  apiRequest({
    url: '/workspace/current',
    method: 'get',
    silentNetworkErrorToast: true
  })

export const apiListFeaturedTemplates = () =>
  apiRequest({
    url: '/workspace/current/templates',
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
