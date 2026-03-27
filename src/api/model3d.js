/**
 * 3D Model API | 3D 模型 API
 */

import { request } from '@/utils'

export const create3DTask = (data, options = {}) => {
  const { endpoint = '/3d/generations', ...requestOptions } = options
  return request({
    url: endpoint,
    method: 'post',
    data,
    ...requestOptions
  })
}

export const get3DTaskStatus = (taskId, options = {}) =>
  request({
    url: `/3d/${taskId}`,
    method: 'get',
    silentErrorToast: true,
    silentNetworkErrorToast: true,
    ...options
  })
