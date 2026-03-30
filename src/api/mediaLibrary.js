import { request } from '@/utils'

export const getMediaAssets = (params = {}) =>
  request({
    url: '/media-library/assets',
    method: 'get',
    params,
    silentNetworkErrorToast: true
  })

export const getGenerationHistory = (params = {}) =>
  request({
    url: '/media-library/history',
    method: 'get',
    params,
    silentNetworkErrorToast: true
  })
