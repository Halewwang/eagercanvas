/**
 * Image API | 图片生成 API
 */

import { apiRequest } from './_httpClient.js'

const IMAGE_REQUEST_TIMEOUT_MS = 180000

// 生成图片
export const generateImage = (data, options = {}) => {
  const { requestType = 'json', endpoint = '/images/generations', timeout = IMAGE_REQUEST_TIMEOUT_MS } = options
  
  return apiRequest({
    url: endpoint,
    method: 'post',
    data,
    timeout,
    headers: requestType === 'formdata' ? { 'Content-Type': 'multipart/form-data' } : {}
  })
}

export const getImageGenerationTask = (taskId, options = {}) => {
  const { timeout = IMAGE_REQUEST_TIMEOUT_MS, ...requestOptions } = options

  return apiRequest({
    url: `/images/${encodeURIComponent(String(taskId || '').trim())}`,
    method: 'get',
    timeout,
    silentErrorToast: true,
    silentNetworkErrorToast: true,
    ...requestOptions
  })
}
