/**
 * API Config Hook | API 配置 Hook
 */

import { ref, computed, watch } from 'vue'
import { setBaseUrl as setRequestBaseUrl } from '@/utils'
import { DEFAULT_API_BASE_URL, STORAGE_KEYS } from '@/utils'

const BYPASS_AUTH_IN_DEV = import.meta.env.DEV && import.meta.env.VITE_BYPASS_AUTH === 'true'

/**
 * Get stored value from localStorage | 从 localStorage 获取存储值
 */
const getStored = (key, defaultValue = '') => {
  try {
    return localStorage.getItem(key) || defaultValue
  } catch {
    return defaultValue
  }
}

/**
 * Set stored value to localStorage | 设置存储值到 localStorage
 */
const setStored = (key, value) => {
  try {
    if (value) {
      localStorage.setItem(key, value)
    } else {
      localStorage.removeItem(key)
    }
  } catch {
    // Ignore storage errors
  }
}

/**
 * API Configuration Hook | API 配置 Hook
 */
export const useApiConfig = () => {
  const baseUrl = ref(DEFAULT_API_BASE_URL)
  
  const isConfigured = computed(() => {
    if (BYPASS_AUTH_IN_DEV) return true
    return !!getStored(STORAGE_KEYS.ACCESS_TOKEN, '')
  })

  watch(baseUrl, (newUrl) => {
    setRequestBaseUrl(newUrl)
    setStored(STORAGE_KEYS.BASE_URL, newUrl)
  })

  const setBaseUrl = (url) => {
    baseUrl.value = url
    setStored(STORAGE_KEYS.BASE_URL, url)
  }

  const configure = (config) => {
    if (config.baseUrl) setBaseUrl(config.baseUrl)
  }

  const clear = () => {
    baseUrl.value = DEFAULT_API_BASE_URL
    setStored(STORAGE_KEYS.BASE_URL, DEFAULT_API_BASE_URL)
  }

  return {
    baseUrl,
    isConfigured,
    setBaseUrl,
    configure,
    clear
  }
}
