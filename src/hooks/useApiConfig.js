/**
 * API Config Hook | API 配置 Hook
 */

import { ref, computed, watch } from 'vue'
import { setApiBaseUrl as setRequestBaseUrl } from '@/api/_httpClient.js'
import { getStoredValue, setStoredValue } from '@/utils'
import { DEFAULT_API_BASE_URL, STORAGE_KEYS } from '@/utils'
import { isLocalPreviewEnabled } from '@/utils/localPreview'

const BYPASS_AUTH_IN_DEV = isLocalPreviewEnabled()

/**
 * API Configuration Hook | API 配置 Hook
 */
export const useApiConfig = () => {
  const baseUrl = ref(DEFAULT_API_BASE_URL)
  
  const isConfigured = computed(() => {
    if (BYPASS_AUTH_IN_DEV) return true
    return !!getStoredValue(STORAGE_KEYS.ACCESS_TOKEN)
  })

  watch(baseUrl, (newUrl) => {
    setRequestBaseUrl(newUrl)
    setStoredValue(STORAGE_KEYS.BASE_URL, newUrl)
  })

  const setBaseUrl = (url) => {
    baseUrl.value = url
    setStoredValue(STORAGE_KEYS.BASE_URL, url)
  }

  const configure = (config) => {
    if (config.baseUrl) setBaseUrl(config.baseUrl)
  }

  const clear = () => {
    baseUrl.value = DEFAULT_API_BASE_URL
    setStoredValue(STORAGE_KEYS.BASE_URL, DEFAULT_API_BASE_URL)
  }

  return {
    baseUrl,
    isConfigured,
    setBaseUrl,
    configure,
    clear
  }
}
