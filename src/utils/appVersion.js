import { computed, reactive } from 'vue'

const CURRENT_BUILD_ID = typeof __APP_BUILD_ID__ !== 'undefined' ? __APP_BUILD_ID__ : 'dev'
const CURRENT_BUILD_TIME = typeof __APP_BUILD_TIME__ !== 'undefined' ? __APP_BUILD_TIME__ : ''
const POLL_INTERVAL_MS = 3 * 60 * 1000
const DISMISSED_KEY = 'app-update-dismissed-build'

const state = reactive({
  currentBuildId: CURRENT_BUILD_ID,
  currentBuildTime: CURRENT_BUILD_TIME,
  latestBuildId: '',
  latestBuildTime: '',
  updateAvailable: false,
  checking: false
})

let pollTimer = null
let started = false

const shouldLogVersionCheckFailure = () => import.meta.env?.PROD === true

const readDismissedBuildId = () => {
  try {
    return sessionStorage.getItem(DISMISSED_KEY) || ''
  } catch {
    return ''
  }
}

const writeDismissedBuildId = (buildId) => {
  try {
    if (!buildId) {
      sessionStorage.removeItem(DISMISSED_KEY)
      return
    }
    sessionStorage.setItem(DISMISSED_KEY, buildId)
  } catch {
    // Ignore session storage failures.
  }
}

const applyManifest = (manifest = {}) => {
  const latestBuildId = String(manifest.buildId || '').trim()
  if (!latestBuildId) return false

  state.latestBuildId = latestBuildId
  state.latestBuildTime = String(manifest.builtAt || '')

  const updateDetected = latestBuildId !== state.currentBuildId
  const dismissedBuildId = readDismissedBuildId()
  state.updateAvailable = updateDetected && latestBuildId !== dismissedBuildId
  return state.updateAvailable
}

export const fetchVersionManifest = async () => {
  const response = await fetch(`/version.json?t=${Date.now()}`, {
    cache: 'no-store',
    headers: {
      'Cache-Control': 'no-cache'
    }
  })

  if (!response.ok) {
    throw new Error(`Version check failed: ${response.status}`)
  }

  return response.json()
}

export const checkForAppUpdate = async () => {
  if (state.checking) return state.updateAvailable

  state.checking = true
  try {
    const manifest = await fetchVersionManifest()
    return applyManifest(manifest)
  } catch (error) {
    if (shouldLogVersionCheckFailure()) {
      console.warn('App version check skipped:', error?.message || error)
    }
    return state.updateAvailable
  } finally {
    state.checking = false
  }
}

const handleVisibilityChange = () => {
  if (document.visibilityState === 'visible') {
    checkForAppUpdate()
  }
}

export const startAppVersionWatcher = () => {
  if (started || typeof window === 'undefined') return
  started = true

  checkForAppUpdate()
  pollTimer = window.setInterval(() => {
    if (document.visibilityState === 'visible') {
      checkForAppUpdate()
    }
  }, POLL_INTERVAL_MS)

  document.addEventListener('visibilitychange', handleVisibilityChange)
}

export const stopAppVersionWatcher = () => {
  if (pollTimer) {
    window.clearInterval(pollTimer)
    pollTimer = null
  }

  document.removeEventListener('visibilitychange', handleVisibilityChange)
  started = false
}

export const dismissAppUpdate = () => {
  if (!state.latestBuildId) return
  writeDismissedBuildId(state.latestBuildId)
  state.updateAvailable = false
}

export const clearDismissedAppUpdate = () => {
  writeDismissedBuildId('')
}

export const appVersionState = state

export const hasAppUpdate = computed(() => state.updateAvailable)
