/**
 * Model API | 模型 API
 */

import { apiRequest } from './_httpClient.js'

// 分页查询模型列表
export const getModelPage = (params) =>
  apiRequest({
    url: `/model/page`,
    method: 'get',
    params: { enable: true, size: 1000, current: 1, ...params }
  })

// 根据类型获取模型列表
export const getModelsByType = async (type) => {
  const rsp = await getModelPage({ type, enable: true, size: 1000, current: 1 })
  return rsp?.data?.records || []
}

// 根据全称获取模型详情
export const getModelByFullName = (fullName) =>
  apiRequest({
    url: `/model/fullName`,
    method: 'get',
    params: { fullName }
  })

// 获取所有模型类型
export const getModelTypes = () =>
  apiRequest({
    url: `/model/types`,
    method: 'get'
  })
