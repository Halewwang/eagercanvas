/**
 * Model Config Hook | 模型配置 Hook
 * Manages model configuration with local storage persistence
 */

import { ref, computed, watch } from 'vue'
import { STORAGE_KEYS } from '@/utils'
import { 
  CHAT_MODELS, 
  IMAGE_MODELS, 
  VIDEO_MODELS,
  DEFAULT_CHAT_MODEL,
  DEFAULT_IMAGE_MODEL,
  DEFAULT_VIDEO_MODEL
} from '@/config/models'

const MODEL_KEY_RE = /^[a-z0-9][a-z0-9.-]*$/
const BUILTIN_IMAGE_KEYS = new Set(IMAGE_MODELS.map(m => m.key))
const BUILTIN_VIDEO_KEYS = new Set(VIDEO_MODELS.map(m => m.key))

const sanitizeCustomModels = (models, allowedKeys = null) => {
  const list = Array.isArray(models) ? models : []
  const seen = new Set()
  const result = []

  for (const item of list) {
    const key = String(item?.key || '').trim()
    if (!key || seen.has(key)) continue
    if (!MODEL_KEY_RE.test(key)) continue
    if (allowedKeys && !allowedKeys.has(key)) continue
    seen.add(key)
    result.push({ key, label: String(item?.label || key).trim() || key })
  }

  return result
}

/**
 * Get stored JSON value from localStorage
 */
const getStoredJson = (key, defaultValue = []) => {
  try {
    const stored = localStorage.getItem(key)
    return stored ? JSON.parse(stored) : defaultValue
  } catch {
    return defaultValue
  }
}

/**
 * Set stored JSON value to localStorage
 */
const setStoredJson = (key, value) => {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // Ignore storage errors
  }
}

/**
 * Get stored string value from localStorage
 */
const getStored = (key, defaultValue = '') => {
  try {
    return localStorage.getItem(key) || defaultValue
  } catch {
    return defaultValue
  }
}

/**
 * Set stored string value to localStorage
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

// Shared reactive state (singleton pattern)
const customChatModels = ref(getStoredJson(STORAGE_KEYS.CUSTOM_CHAT_MODELS, []))
const customImageModels = ref(sanitizeCustomModels(getStoredJson(STORAGE_KEYS.CUSTOM_IMAGE_MODELS, []), BUILTIN_IMAGE_KEYS))
const customVideoModels = ref(sanitizeCustomModels(getStoredJson(STORAGE_KEYS.CUSTOM_VIDEO_MODELS, []), BUILTIN_VIDEO_KEYS))

const selectedChatModel = ref(getStored(STORAGE_KEYS.SELECTED_CHAT_MODEL, DEFAULT_CHAT_MODEL))
const selectedImageModel = ref(getStored(STORAGE_KEYS.SELECTED_IMAGE_MODEL, DEFAULT_IMAGE_MODEL))
const selectedVideoModel = ref(getStored(STORAGE_KEYS.SELECTED_VIDEO_MODEL, DEFAULT_VIDEO_MODEL))

/**
 * Model Configuration Hook
 */
export const useModelConfig = () => {
  const mergeBuiltinsAndCustom = (builtins, custom) => {
    const builtinsWithFlag = builtins.map(m => ({ ...m, isCustom: false }))
    const builtinKeys = new Set(builtinsWithFlag.map(m => m.key))
    const customOnly = custom.filter(m => !builtinKeys.has(m.key))
    return [
      ...builtinsWithFlag,
      ...customOnly
    ]
  }

  // Combined models (built-in + custom)
  const allChatModels = computed(() => [
    ...CHAT_MODELS.map(m => ({ ...m, isCustom: false })),
    ...customChatModels.value.map(m => ({ 
      label: m.label || m.key, 
      key: m.key,
      isCustom: true 
    }))
  ])

  const allImageModels = computed(() => mergeBuiltinsAndCustom(
    IMAGE_MODELS,
    sanitizeCustomModels(customImageModels.value, BUILTIN_IMAGE_KEYS).map(m => ({
      label: m.label || m.key,
      key: m.key,
      isCustom: true,
      sizes: [],
      defaultParams: { quality: 'standard', style: 'vivid' }
    }))
  ))

  const allVideoModels = computed(() => mergeBuiltinsAndCustom(
    VIDEO_MODELS,
    sanitizeCustomModels(customVideoModels.value, BUILTIN_VIDEO_KEYS).map(m => ({
      label: m.label || m.key, 
      key: m.key,
      isCustom: true,
      ratios: ['16:9', '9:16', '1:1'],
      durs: [{ label: '5 秒', key: 5 }, { label: '10 秒', key: 10 }],
      defaultParams: { ratio: '16:9', duration: 5 }
    }))
  ))

  // Watch and persist changes
  watch(customChatModels, (val) => setStoredJson(STORAGE_KEYS.CUSTOM_CHAT_MODELS, val), { deep: true })
  watch(customImageModels, (val) => {
    const next = sanitizeCustomModels(val, BUILTIN_IMAGE_KEYS)
    if (JSON.stringify(next) !== JSON.stringify(val)) {
      customImageModels.value = next
      return
    }
    setStoredJson(STORAGE_KEYS.CUSTOM_IMAGE_MODELS, next)
  }, { deep: true, immediate: true })
  watch(customVideoModels, (val) => {
    const next = sanitizeCustomModels(val, BUILTIN_VIDEO_KEYS)
    if (JSON.stringify(next) !== JSON.stringify(val)) {
      customVideoModels.value = next
      return
    }
    setStoredJson(STORAGE_KEYS.CUSTOM_VIDEO_MODELS, next)
  }, { deep: true, immediate: true })

  watch(selectedChatModel, (val) => setStored(STORAGE_KEYS.SELECTED_CHAT_MODEL, val))
  watch(selectedImageModel, (val) => {
    if (!allImageModels.value.some(m => m.key === val)) {
      selectedImageModel.value = DEFAULT_IMAGE_MODEL
      return
    }
    setStored(STORAGE_KEYS.SELECTED_IMAGE_MODEL, val)
  }, { immediate: true })
  watch(selectedVideoModel, (val) => {
    if (!allVideoModels.value.some(m => m.key === val)) {
      selectedVideoModel.value = DEFAULT_VIDEO_MODEL
      return
    }
    setStored(STORAGE_KEYS.SELECTED_VIDEO_MODEL, val)
  }, { immediate: true })

  // Add custom model
  const addCustomChatModel = (modelKey, label = '') => {
    if (!modelKey || customChatModels.value.some(m => m.key === modelKey)) return false
    customChatModels.value.push({ key: modelKey, label: label || modelKey })
    return true
  }

  const addCustomImageModel = (modelKey, label = '') => {
    if (!modelKey || !BUILTIN_IMAGE_KEYS.has(modelKey) || customImageModels.value.some(m => m.key === modelKey)) return false
    customImageModels.value.push({ key: modelKey, label: label || modelKey })
    return true
  }

  const addCustomVideoModel = (modelKey, label = '') => {
    if (!modelKey || !BUILTIN_VIDEO_KEYS.has(modelKey) || customVideoModels.value.some(m => m.key === modelKey)) return false
    customVideoModels.value.push({ key: modelKey, label: label || modelKey })
    return true
  }

  // Remove custom model
  const removeCustomChatModel = (modelKey) => {
    const idx = customChatModels.value.findIndex(m => m.key === modelKey)
    if (idx > -1) {
      customChatModels.value.splice(idx, 1)
      if (selectedChatModel.value === modelKey) {
        selectedChatModel.value = DEFAULT_CHAT_MODEL
      }
      return true
    }
    return false
  }

  const removeCustomImageModel = (modelKey) => {
    const idx = customImageModels.value.findIndex(m => m.key === modelKey)
    if (idx > -1) {
      customImageModels.value.splice(idx, 1)
      if (selectedImageModel.value === modelKey) {
        selectedImageModel.value = DEFAULT_IMAGE_MODEL
      }
      return true
    }
    return false
  }

  const removeCustomVideoModel = (modelKey) => {
    const idx = customVideoModels.value.findIndex(m => m.key === modelKey)
    if (idx > -1) {
      customVideoModels.value.splice(idx, 1)
      if (selectedVideoModel.value === modelKey) {
        selectedVideoModel.value = DEFAULT_VIDEO_MODEL
      }
      return true
    }
    return false
  }

  // Get model by key
  const getChatModel = (key) => allChatModels.value.find(m => m.key === key)
  const getImageModel = (key) => allImageModels.value.find(m => m.key === key)
  const getVideoModel = (key) => allVideoModels.value.find(m => m.key === key)

  // Clear all custom models
  const clearCustomModels = () => {
    customChatModels.value = []
    customImageModels.value = []
    customVideoModels.value = []
    selectedChatModel.value = DEFAULT_CHAT_MODEL
    selectedImageModel.value = DEFAULT_IMAGE_MODEL
    selectedVideoModel.value = DEFAULT_VIDEO_MODEL
  }

  return {
    // All models (built-in + custom)
    allChatModels,
    allImageModels,
    allVideoModels,
    
    // Custom models only
    customChatModels,
    customImageModels,
    customVideoModels,
    
    // Selected models
    selectedChatModel,
    selectedImageModel,
    selectedVideoModel,
    
    // Add methods
    addCustomChatModel,
    addCustomImageModel,
    addCustomVideoModel,
    
    // Remove methods
    removeCustomChatModel,
    removeCustomImageModel,
    removeCustomVideoModel,
    
    // Get model
    getChatModel,
    getImageModel,
    getVideoModel,
    
    // Clear
    clearCustomModels
  }
}
