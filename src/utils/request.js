/**
 * HTTP Request Utility | HTTP 请求工具
 * Axios-based request with interceptors
 */

import axios from 'axios'
import { DEFAULT_API_BASE_URL, STORAGE_KEYS } from './constants'
import { notifier } from './notifier.js'
import { getStoredValue, removeStoredValue, setStoredValue } from './storage.js'
import { OBSERVABILITY_SLOW_API_MS, reportApiIssue } from '@/observability'

// Create axios instance | 创建 axios 实例
const instance = axios.create({
  baseURL: DEFAULT_API_BASE_URL,
  timeout: 180000,
  withCredentials: true
})

let isRefreshing = false
let refreshQueue = []

const getRequestTime = () => {
  if (typeof performance !== 'undefined' && typeof performance.now === 'function') {
    return performance.now()
  }
  return Date.now()
}

const createClientRequestId = () => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `web-${Date.now()}-${Math.random().toString(16).slice(2)}`
}

const getRequestDuration = (config = {}) => {
  const startedAt = Number(config?.metadata?.startedAt || 0)
  return startedAt ? Math.max(0, getRequestTime() - startedAt) : 0
}

const isObservabilityRequest = (config = {}) => String(config?.url || '').includes('/observability/events')

const queueRequest = (resolve, reject) => {
  refreshQueue.push({ resolve, reject })
}

const flushQueue = (error, token = '') => {
  refreshQueue.forEach(({ resolve, reject }) => {
    if (error) reject(error)
    else resolve(token)
  })
  refreshQueue = []
}

// Request interceptor | 请求拦截器
instance.interceptors.request.use(
  (config) => {
    const accessToken = getStoredValue(STORAGE_KEYS.ACCESS_TOKEN)
    config.metadata = {
      ...(config.metadata || {}),
      startedAt: getRequestTime()
    }
    config.headers = config.headers || {}
    if (!config.headers['x-request-id'] && !config.headers['X-Request-Id']) {
      config.headers['x-request-id'] = createClientRequestId()
    }
    
    if (accessToken) {
      config.headers['Authorization'] = `Bearer ${accessToken}`
    }
    
    return config
  },
  (error) => {
    console.error('Request error:', error)
    return Promise.reject(error)
  }
)

// Response interceptor | 响应拦截器
instance.interceptors.response.use(
  (res) => {
    const { data, code, message } = res.data || {}
    const silent = !!res.config?.silentErrorToast
    const durationMs = getRequestDuration(res.config)
    if (!isObservabilityRequest(res.config) && durationMs >= OBSERVABILITY_SLOW_API_MS) {
      reportApiIssue({
        category: 'performance',
        severity: 'p2',
        response: res,
        config: res.config,
        durationMs
      })
    }
    
    // Handle stream response | 处理流响应
    if (res.config.responseType === 'stream') {
      return res.data
    }
    
    // Handle blob response | 处理 blob 响应
    if (res.data instanceof Blob) {
      return res.data
    }
    
    // Success response | 成功响应 (any 2xx)
    if ((res.status >= 200 && res.status < 300) || code === 200) {
      return res.data
    }
    
    // Error response | 错误响应
    if (!silent) notifier.error(message || 'Request failed')
    return Promise.reject(res.data)
  },
  async (error) => {
    const { response } = error
    const silent = !!error?.config?.silentErrorToast
    const silentNetwork = !!error?.config?.silentNetworkErrorToast
    const isTimeout = error?.code === 'ECONNABORTED' || /timeout/i.test(String(error?.message || ''))
    const durationMs = getRequestDuration(error?.config)
    const reportRequestIssue = () => {
      if (!isObservabilityRequest(error?.config)) {
        reportApiIssue({
          category: 'api_error',
          severity: Number(response?.status || 0) >= 500 ? 'p1' : 'p2',
          error,
          response,
          config: error?.config,
          durationMs
        })
      }
    }

    if (response) {
      const { status, data } = response
      const message = data?.message || data?.error?.message || error.message
      if (message) error.message = message
      
      if (status === 401) {
        const originalRequest = error.config || {}
        const isRefreshPath = originalRequest.url?.includes('/auth/refresh')
        const hasAccessToken = !!getStoredValue(STORAGE_KEYS.ACCESS_TOKEN)

        if (!isRefreshPath && hasAccessToken && !originalRequest._retry) {
          originalRequest._retry = true

          if (isRefreshing) {
            return new Promise((resolve, reject) => {
              queueRequest(resolve, reject)
            }).then((token) => {
              originalRequest.headers['Authorization'] = `Bearer ${token}`
              return instance(originalRequest)
            })
          }

          isRefreshing = true

          try {
            const refreshRes = await instance.post('/auth/refresh')
            const nextToken = refreshRes?.accessToken || ''
            if (nextToken) {
              setStoredValue(STORAGE_KEYS.ACCESS_TOKEN, nextToken)
              flushQueue(null, nextToken)
              originalRequest.headers['Authorization'] = `Bearer ${nextToken}`
              return instance(originalRequest)
            }
          } catch (refreshError) {
            removeStoredValue(STORAGE_KEYS.ACCESS_TOKEN)
            flushQueue(refreshError, '')
            if (!silent) notifier.error('登录已过期，请重新登录')
            error.__handled = true
            reportRequestIssue()
            return Promise.reject(refreshError)
          } finally {
            isRefreshing = false
          }
        }

        removeStoredValue(STORAGE_KEYS.ACCESS_TOKEN)
        if (!silent) notifier.error('登录已过期，请重新登录')
        error.__handled = true
      } else if (status === 429) {
        if (!silent) notifier.error('请求过于频繁，请稍后再试')
        error.__handled = true
      } else {
        if (!silent && !silentNetwork) notifier.error(message || '请求失败')
        error.__handled = true
      }

      reportRequestIssue()

      if (import.meta.env.DEV) {
        console.error('[request:error]', {
          url: error.config?.url,
          status,
          data
        })
      }
    } else {
      if (isTimeout) {
        error.message = '请求超时。图片生成时间较长，请稍后重试。'
      }
      if (!silent && !silentNetwork) notifier.error(error.message || '网络错误')
      error.__handled = true
      reportRequestIssue()
    }
    
    return Promise.reject(error)
  }
)

/**
 * Set API base URL | 设置 API 基础 URL
 * @param {string} url - Base URL
 */
export const setBaseUrl = (url) => {
  instance.defaults.baseURL = url
}

/**
 * Get current base URL | 获取当前基础 URL
 * @returns {string}
 */
export const getBaseUrl = () => {
  return instance.defaults.baseURL
}

export default instance
