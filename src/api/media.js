import { request } from '@/utils'

export const apiListGeneratedVideos = () =>
  request({
    url: '/media/generated-videos',
    method: 'get',
    silentNetworkErrorToast: true
  })
