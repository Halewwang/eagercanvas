import { apiRequest } from './_httpClient.js'

export const getUsageSummary = (from, to, options = {}) =>
  apiRequest({
    url: '/usage/summary',
    method: 'get',
    params: { from, to },
    ...options
  })

export const getUsageTimeseries = (granularity = 'day') =>
  apiRequest({
    url: '/usage/timeseries',
    method: 'get',
    params: { granularity }
  })
