import { computed, ref } from 'vue'
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

const readToken = () => {
  try {
    return localStorage.getItem(ACCESS_TOKEN_KEY) || ''
  } catch {
    return ''
  }
}

const persistToken = (token) => {
  accessToken.value = token || ''
  try {
    if (token) localStorage.setItem(ACCESS_TOKEN_KEY, token)
    else localStorage.removeItem(ACCESS_TOKEN_KEY)
  } catch {
    // ignore
  }
}

export const useAuthStore = () => {
  const isAuthenticated = computed(() => !!accessToken.value)

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

  const logout = async () => {
    try {
      await logoutSession()
    } finally {
      persistToken('')
      user.value = null
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
    bootstrapped,
    sendCode,
    sendRegister,
    verifyCode,
    verifyRegister,
    bootstrapAuth,
    logout,
    updateProfile,
    persistToken
  }
}
