/**
 * HTTP Request Utility | HTTP 请求工具
 * Axios-based request with interceptors
 */

import axios from 'axios'
import { DEFAULT_API_KEY, STORAGE_KEYS } from './constants'

// Base URL from environment or default
const BASE_URL = import.meta.env.VITE_APP_API_BASE_URL || '/api/v1'

// Create axios instance | 创建 axios 实例
const instance = axios.create({
  baseURL: BASE_URL,
  timeout: 30000000,
  withCredentials: true
})

let isRefreshing = false
let refreshQueue = []

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
    const accessToken = localStorage.getItem(STORAGE_KEYS.ACCESS_TOKEN) || ''
    const apiKey = localStorage.getItem(STORAGE_KEYS.API_KEY) || DEFAULT_API_KEY
    
    // Skip auth for certain endpoints | 跳过某些端点的认证
    const noAuthEndpoints = ['/model/page', '/model/fullName', '/model/types']
    const isNoAuth = noAuthEndpoints.some(ep => config.url?.includes(ep))
    
    if (accessToken) {
      config.headers['Authorization'] = `Bearer ${accessToken}`
    } else if (apiKey && !isNoAuth) {
      // Backward compatibility for legacy direct-provider mode
      config.headers['Authorization'] = `Bearer ${apiKey}`
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
    
    // Handle stream response | 处理流响应
    if (res.config.responseType === 'stream') {
      return res.data
    }
    
    // Handle blob response | 处理 blob 响应
    if (res.data instanceof Blob) {
      return res.data
    }
    
    // Success response | 成功响应
    if (code === 200 || res.status === 200) {
      return res.data
    }
    
    // Error response | 错误响应
    window.$message?.error(message || 'Request failed')
    return Promise.reject(res.data)
  },
  async (error) => {
    const { response } = error
    
    if (response) {
      const { status, data } = response
      const message = data?.message || data?.error?.message || error.message
      
      if (status === 401) {
        const originalRequest = error.config || {}
        const isRefreshPath = originalRequest.url?.includes('/auth/refresh')
        const hasAccessToken = !!localStorage.getItem(STORAGE_KEYS.ACCESS_TOKEN)

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
              localStorage.setItem(STORAGE_KEYS.ACCESS_TOKEN, nextToken)
              flushQueue(null, nextToken)
              originalRequest.headers['Authorization'] = `Bearer ${nextToken}`
              return instance(originalRequest)
            }
          } catch (refreshError) {
            localStorage.removeItem(STORAGE_KEYS.ACCESS_TOKEN)
            flushQueue(refreshError, '')
            window.$message?.error('登录已过期，请重新登录')
            error.__handled = true
            return Promise.reject(refreshError)
          } finally {
            isRefreshing = false
          }
        }

        localStorage.removeItem(STORAGE_KEYS.ACCESS_TOKEN)
        window.$message?.error('登录已过期，请重新登录')
        error.__handled = true
      } else if (status === 429) {
        window.$message?.error('请求过于频繁，请稍后再试')
        error.__handled = true
      } else {
        window.$message?.error(message || '请求失败')
        error.__handled = true
      }

      if (import.meta.env.DEV) {
        console.error('[request:error]', {
          url: error.config?.url,
          status,
          data
        })
      }
    } else {
      window.$message?.error(error.message || '网络错误')
      error.__handled = true
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
