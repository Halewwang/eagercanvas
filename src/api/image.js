/**
 * Image API | 图片生成 API
 */

import { request } from '@/utils'

const IMAGE_REQUEST_TIMEOUT_MS = 180000

// 生成图片
export const generateImage = (data, options = {}) => {
  const { requestType = 'json', endpoint = '/images/generations', timeout = IMAGE_REQUEST_TIMEOUT_MS } = options
  
  return request({
    url: endpoint,
    method: 'post',
    data,
    timeout,
    headers: requestType === 'formdata' ? { 'Content-Type': 'multipart/form-data' } : {}
  })
}

export const removeBackground = (data, options = {}) => {
  const { timeout = IMAGE_REQUEST_TIMEOUT_MS } = options

  return request({
    url: '/images/remove-background',
    method: 'post',
    data,
    timeout
  })
}
