import { request } from '@/utils'

export const apiListProjects = () =>
  request({
    url: '/projects',
    method: 'get'
  })

export const apiCreateProject = (payload) =>
  request({
    url: '/projects',
    method: 'post',
    data: payload
  })

export const apiGetProject = (id) =>
  request({
    url: `/projects/${id}`,
    method: 'get'
  })

export const apiPatchProject = (id, payload) =>
  request({
    url: `/projects/${id}`,
    method: 'patch',
    data: payload
  })

export const apiDeleteProject = (id) =>
  request({
    url: `/projects/${id}`,
    method: 'delete'
  })
