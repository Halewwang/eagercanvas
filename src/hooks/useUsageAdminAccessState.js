import { computed, ref } from 'vue'
import {
  clearUsageAdminToken,
  setUsageAdminToken,
  usageAdminLogin,
  usageAdminSession
} from '@/api/usageAdmin'
import { STORAGE_KEYS } from '@/utils/constants'
import { getErrorMessage, getStoredValue } from '@/utils'

const noopAsync = async () => {}

const getWindowMessageApi = () => (typeof window === 'undefined' ? null : window.$message)

const hasStoredUsageAdminToken = () => !!getStoredValue(STORAGE_KEYS.USAGE_ADMIN_TOKEN)

export const useUsageAdminAccessState = ({
  clearToken = clearUsageAdminToken,
  getMessageApi = getWindowMessageApi,
  hasToken = hasStoredUsageAdminToken,
  loadAll = noopAsync,
  loginRequest = usageAdminLogin,
  sessionRequest = usageAdminSession,
  setToken = setUsageAdminToken
} = {}) => {
  const loginForm = ref({ username: '', password: '' })
  const loggingIn = ref(false)
  const adminSession = ref(null)
  const isAdminAuthenticated = computed(() => !!adminSession.value)

  const updateLoginFormField = (field, value) => {
    loginForm.value = { ...loginForm.value, [field]: value }
  }

  const handleLogin = async () => {
    if (!loginForm.value.username || !loginForm.value.password) {
      getMessageApi()?.warning('Please input admin username and password')
      return
    }

    loggingIn.value = true
    try {
      const rsp = await loginRequest(loginForm.value)
      setToken(rsp?.token)
      const session = await sessionRequest()
      adminSession.value = session
      await loadAll()
      getMessageApi()?.success('Admin login success')
    } catch (error) {
      clearToken()
      adminSession.value = null
      if (!error?.__handled) getMessageApi()?.error(getErrorMessage(error, 'Admin login failed'))
    } finally {
      loggingIn.value = false
    }
  }

  const logout = () => {
    clearToken()
    adminSession.value = null
    getMessageApi()?.success('Logged out')
  }

  const restoreSession = async () => {
    if (!hasToken()) return

    try {
      const session = await sessionRequest()
      adminSession.value = session
      await loadAll()
    } catch {
      clearToken()
      adminSession.value = null
    }
  }

  return {
    adminSession,
    handleLogin,
    isAdminAuthenticated,
    loggingIn,
    loginForm,
    logout,
    restoreSession,
    updateLoginFormField
  }
}

export default useUsageAdminAccessState
