/**
 * Video API | 视频生成 API
 */

import { apiRequest } from './_httpClient.js'

// 创建视频任务
export const createVideoTask = (data, options = {}) => {
  const { endpoint = '/videos', ...requestOptions } = options
  return apiRequest({
    url: endpoint,
    method: 'post',
    data,
    ...requestOptions
  })
}

// 查询视频任务状态
export const getVideoTaskStatus = (taskId, options = {}) =>
  apiRequest({
    url: `/videos/${taskId}`,
    method: 'get',
    silentErrorToast: true,
    silentNetworkErrorToast: true,
    ...options
  })
