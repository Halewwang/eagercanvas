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

export const get302Balance = () =>
  request({
    url: '/usage/302/balance',
    method: 'get'
  })

export const get302Record = (requestId) =>
  request({
    url: `/usage/302/record/${encodeURIComponent(requestId)}`,
    method: 'get'
  })

export const get302ApiRecord = (params) =>
  request({
    url: '/usage/302/api-record',
    method: 'get',
    params
  })

export const get302ApiKeys = () =>
  request({
    url: '/usage/302/api-keys',
    method: 'get'
  })
