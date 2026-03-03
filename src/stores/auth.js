import { computed, ref } from 'vue'
import { getAdminSession } from '@/api/admin'
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

const ACCESS_TOKEN_KEY = 'ec_access_token'

const user = ref(null)
const accessToken = ref('')
const bootstrapped = ref(false)
const adminUser = ref(null)
const roles = ref([])
const permissions = ref([])
const adminBootstrapped = ref(false)

const readToken = () => {
  try {
    return localStorage.getItem(ACCESS_TOKEN_KEY) || ''
  } catch {
    return ''
  }
}

const persistToken = (token) => {
  accessToken.value = token || ''
  if (!token) {
    adminUser.value = null
    roles.value = []
    permissions.value = []
    adminBootstrapped.value = false
  } else {
    adminBootstrapped.value = false
  }
  try {
    if (token) localStorage.setItem(ACCESS_TOKEN_KEY, token)
    else localStorage.removeItem(ACCESS_TOKEN_KEY)
  } catch {
    // ignore
  }
}

export const useAuthStore = () => {
  const isAuthenticated = computed(() => !!accessToken.value)
  const isAdmin = computed(() => permissions.value.includes('admin.dashboard.read'))

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
        }
      }
    }

    bootstrapped.value = true
  }

  const loadAdminSession = async ({ force = false } = {}) => {
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
      adminUser.value = null
      roles.value = []
      permissions.value = []
      adminBootstrapped.value = false
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
    loadAdminSession,
    hasPermission,
    logout,
    updateProfile,
    persistToken
  }
}
