import { computed, ref } from 'vue'
import { getAdminSession } from '@/api/admin'
import { STORAGE_KEYS } from '@/utils/constants'
import { getStoredValue, removeStoredValue, setStoredValue } from '@/utils/storage'
import {
  getMe,
  logoutSession,
  patchProfile,
  refreshSession,
  sendLoginCode,
  sendRegisterCode,
  verifyLoginCode,
  verifyRegisterCode
} from '@/api/auth'
import { getLocalPreviewAdminSession, isLocalPreviewEnabled, resolveLocalPreviewAccessToken } from '@/utils/localPreview'
import { hasAdminAccessPermission } from '@/utils/adminNavigation'

const BYPASS_AUTH_IN_DEV = isLocalPreviewEnabled()
const LOCAL_PREVIEW_ACCESS_TOKEN = resolveLocalPreviewAccessToken('')
const LOCAL_PREVIEW_ADMIN_SESSION = getLocalPreviewAdminSession()
const INITIAL_STORED_ACCESS_TOKEN = getStoredValue(STORAGE_KEYS.ACCESS_TOKEN)
const INITIAL_LOCAL_PREVIEW_SESSION = BYPASS_AUTH_IN_DEV && !INITIAL_STORED_ACCESS_TOKEN
const BYPASS_USER = {
  id: 'dev-bypass-user',
  email: 'preview@local.dev',
  displayName: 'Local Preview',
  serviceStatus: 'active'
}

const user = ref(INITIAL_LOCAL_PREVIEW_SESSION ? { ...BYPASS_USER } : null)
const accessToken = ref(INITIAL_STORED_ACCESS_TOKEN || (INITIAL_LOCAL_PREVIEW_SESSION ? LOCAL_PREVIEW_ACCESS_TOKEN : ''))
const bootstrapped = ref(INITIAL_LOCAL_PREVIEW_SESSION)
const adminUser = ref(INITIAL_LOCAL_PREVIEW_SESSION ? { ...LOCAL_PREVIEW_ADMIN_SESSION.user } : null)
const roles = ref(INITIAL_LOCAL_PREVIEW_SESSION ? [...LOCAL_PREVIEW_ADMIN_SESSION.roles] : [])
const permissions = ref(INITIAL_LOCAL_PREVIEW_SESSION ? [...LOCAL_PREVIEW_ADMIN_SESSION.permissions] : [])
const adminBootstrapped = ref(INITIAL_LOCAL_PREVIEW_SESSION)
const localPreviewSessionActive = ref(INITIAL_LOCAL_PREVIEW_SESSION)

const applyLocalPreviewAdminSession = () => {
  adminUser.value = { ...LOCAL_PREVIEW_ADMIN_SESSION.user }
  roles.value = [...LOCAL_PREVIEW_ADMIN_SESSION.roles]
  permissions.value = [...LOCAL_PREVIEW_ADMIN_SESSION.permissions]
  adminBootstrapped.value = true
}

const activateLocalPreviewSession = () => {
  accessToken.value = LOCAL_PREVIEW_ACCESS_TOKEN
  user.value = { ...BYPASS_USER }
  localPreviewSessionActive.value = true
  applyLocalPreviewAdminSession()
  bootstrapped.value = true
}

const readToken = () => {
  return getStoredValue(STORAGE_KEYS.ACCESS_TOKEN)
}

const persistToken = (token) => {
  accessToken.value = token || ''
  localPreviewSessionActive.value = false
  adminUser.value = null
  roles.value = []
  permissions.value = []
  adminBootstrapped.value = false
  if (token) setStoredValue(STORAGE_KEYS.ACCESS_TOKEN, token)
  else removeStoredValue(STORAGE_KEYS.ACCESS_TOKEN)
}

export const useAuthStore = () => {
  const isAuthenticated = computed(() => !!accessToken.value)
  const isAdmin = computed(() => hasAdminAccessPermission(permissions.value))

  const sendCode = (email) => sendLoginCode(email)
  const sendRegister = (email) => sendRegisterCode(email)

  const verifyCode = async (email, code) => {
    const result = await verifyLoginCode(email, code)
    if (result?.accessToken) {
      persistToken(result.accessToken)
      user.value = result.user || null
    }
    return result
  }

  const verifyRegister = async (email, code, displayName) => {
    const result = await verifyRegisterCode(email, code, displayName)
    if (result?.accessToken) {
      persistToken(result.accessToken)
      user.value = result.user || null
    }
    return result
  }

  const bootstrapAuth = async () => {
    if (bootstrapped.value) return

    const token = readToken()
    if (token) {
      localPreviewSessionActive.value = false
      accessToken.value = token
      try {
        const me = await getMe()
        user.value = me.user
      } catch {
        try {
          const refreshed = await refreshSession()
          persistToken(refreshed.accessToken)
          user.value = refreshed.user
        } catch {
          persistToken('')
          user.value = null
          if (BYPASS_AUTH_IN_DEV) {
            activateLocalPreviewSession()
            return
          }
        }
      }
    } else if (BYPASS_AUTH_IN_DEV) {
      activateLocalPreviewSession()
      return
    } else {
      accessToken.value = ''
    }

    bootstrapped.value = true
  }

  const refreshUser = async () => {
    if (!isAuthenticated.value) {
      user.value = null
      return null
    }

    const me = await getMe()
    user.value = me.user
    return user.value
  }

  const loadAdminSession = async ({ force = false } = {}) => {
    if (localPreviewSessionActive.value) {
      applyLocalPreviewAdminSession()
      return true
    }

    if (!isAuthenticated.value) {
      adminUser.value = null
      roles.value = []
      permissions.value = []
      adminBootstrapped.value = true
      return false
    }

    if (adminBootstrapped.value && !force) {
      return isAdmin.value
    }

    try {
      const session = await getAdminSession()
      adminUser.value = session?.user || null
      roles.value = Array.isArray(session?.roles) ? session.roles : []
      permissions.value = Array.isArray(session?.permissions) ? session.permissions : []
    } catch {
      adminUser.value = null
      roles.value = []
      permissions.value = []
    } finally {
      adminBootstrapped.value = true
    }

    return isAdmin.value
  }

  const hasPermission = (code) => permissions.value.includes(String(code || ''))

  const logout = async () => {
    try {
      await logoutSession()
    } finally {
      persistToken('')
      user.value = null
      if (BYPASS_AUTH_IN_DEV) activateLocalPreviewSession()
    }
  }

  const updateProfile = async (payload) => {
    const result = await patchProfile(payload)
    user.value = result.user
    return result.user
  }

  return {
    user,
    accessToken,
    isAuthenticated,
    isAdmin,
    bootstrapped,
    adminUser,
    roles,
    permissions,
    adminBootstrapped,
    sendCode,
    sendRegister,
    verifyCode,
    verifyRegister,
    bootstrapAuth,
    refreshUser,
    loadAdminSession,
    hasPermission,
    logout,
    updateProfile,
    persistToken
  }
}
