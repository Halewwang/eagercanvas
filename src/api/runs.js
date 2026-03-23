import { request } from '@/utils'

export const getRunStatus = (runId, options = {}) =>
  request({
    url: `/runs/${runId}`,
    method: 'get',
    silentErrorToast: true,
    silentNetworkErrorToast: true,
    ...options
  })
