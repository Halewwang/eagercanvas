import { request } from '@/utils'

export const apiGetCurrentWorkspace = () =>
  request({
    url: '/workspace/current',
    method: 'get',
    silentNetworkErrorToast: true
  })

export const apiListFeaturedTemplates = () =>
  request({
    url: '/workspace/current/templates',
    method: 'get',
    silentNetworkErrorToast: true
  })

export const apiGetProjectTemplateStatus = (projectId) =>
  request({
    url: `/workspace/current/projects/${projectId}/template`,
    method: 'get',
    silentNetworkErrorToast: true
  })

export const apiPublishProjectTemplate = (projectId, payload) =>
  request({
    url: `/workspace/current/projects/${projectId}/template`,
    method: 'put',
    data: payload,
    silentNetworkErrorToast: true
  })

export const apiUnpublishProjectTemplate = (projectId) =>
  request({
    url: `/workspace/current/projects/${projectId}/template`,
    method: 'delete',
    silentNetworkErrorToast: true
  })

export const apiUseSharedTemplate = (templateId) =>
  request({
    url: `/workspace/current/templates/${templateId}/use`,
    method: 'post',
    silentNetworkErrorToast: true
  })
