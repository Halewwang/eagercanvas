import { apiRequest } from './_httpClient.js'

export const getMediaAssets = (params = {}) =>
  apiRequest({
    url: '/media-library/assets',
    method: 'get',
    params,
    silentNetworkErrorToast: true
  })

export const getGenerationHistory = (params = {}) =>
  apiRequest({
    url: '/media-library/history',
    method: 'get',
    params,
    silentNetworkErrorToast: true
  })
