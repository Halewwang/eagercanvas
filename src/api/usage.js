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

export const get302Balance = () =>
  apiRequest({
    url: '/usage/302/balance',
    method: 'get'
  })

export const get302Record = (requestId) =>
  apiRequest({
    url: `/usage/302/record/${encodeURIComponent(requestId)}`,
    method: 'get'
  })

export const get302ApiRecord = (params) =>
  apiRequest({
    url: '/usage/302/api-record',
    method: 'get',
    params
  })

export const get302ApiKeys = () =>
  apiRequest({
    url: '/usage/302/api-keys',
    method: 'get'
  })
