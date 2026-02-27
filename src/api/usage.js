import { request } from '@/utils'

export const getUsageSummary = (from, to) =>
  request({
    url: '/usage/summary',
    method: 'get',
    params: { from, to }
  })

export const getUsageTimeseries = (granularity = 'day') =>
  request({
    url: '/usage/timeseries',
    method: 'get',
    params: { granularity }
  })
