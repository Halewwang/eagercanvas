/**
 * Video API | 视频生成 API
 */

import { request } from '@/utils'

// 创建视频任务
export const createVideoTask = (data, options = {}) => {
  const { endpoint = '/videos' } = options
  return request({
    url: endpoint,
    method: 'post',
    data
  })
}

// 查询视频任务状态
export const getVideoTaskStatus = (taskId) =>
  request({
    url: `/videos/${taskId}`,
    method: 'get'
  })

// 轮询视频任务直到完成
export const pollVideoTask = async (taskId, maxAttempts = 120, interval = 5000) => {
  for (let i = 0; i < maxAttempts; i++) {
    const result = await getVideoTaskStatus(taskId)
    const status = String(
      result?.status ||
      result?.task_status ||
      result?.data?.status ||
      result?.data?.task_status ||
      ''
    ).toLowerCase()
    const videoUrl =
      result?.url ||
      result?.video_url ||
      result?.data?.url ||
      result?.data?.video_url ||
      result?.data?.task_result?.video_url ||
      result?.data?.task_result?.videos?.[0]?.url

    if (videoUrl && (!status || ['completed', 'succeeded', 'success', 'done', 'finished'].includes(status))) {
      return result
    }

    if (['failed', 'error', 'cancelled', 'canceled'].includes(status)) {
      throw new Error(result?.error?.message || result?.message || '视频生成失败')
    }

    await new Promise(resolve => setTimeout(resolve, interval))
  }

  throw new Error('视频生成超时')
}
