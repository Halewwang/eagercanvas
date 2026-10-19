import { ref } from 'vue'

const FIXED_ROLE_CODES = ['super_admin', 'admin', 'ops', 'support', 'user']

export const createAdminUserDetailState = ({
  fetchUser,
  formatError = (cause, fallback) => String(cause?.message || fallback)
} = {}) => {
  const user = ref(null)
  const loading = ref(false)
  const error = ref('')
  const selectedRoles = ref(['user'])
  let generation = 0
  let loadedUserId = ''
  let requestedUserId = ''

  const invalidate = () => {
    generation += 1
    loading.value = false
  }

  const loadDetail = async (userId) => {
    const safeUserId = String(userId || '').trim()
    if (!safeUserId || typeof fetchUser !== 'function') return false
    const userChanged = safeUserId !== requestedUserId
    requestedUserId = safeUserId
    if (userChanged && safeUserId !== loadedUserId) {
      user.value = null
      selectedRoles.value = ['user']
      loadedUserId = ''
    }
    const requestGeneration = ++generation
    loading.value = true
    error.value = ''
    try {
      const detailResult = await fetchUser(safeUserId)
      if (requestGeneration !== generation) return false
      user.value = detailResult?.data || null
      loadedUserId = safeUserId
      const assignedRoles = new Set(user.value?.roles || [])
      selectedRoles.value = FIXED_ROLE_CODES.filter((role) => assignedRoles.has(role))
      if (!selectedRoles.value.length) selectedRoles.value = ['user']
      return true
    } catch (cause) {
      if (requestGeneration === generation) error.value = formatError(cause, '加载用户详情失败')
      return false
    } finally {
      if (requestGeneration === generation) loading.value = false
    }
  }

  return { error, invalidate, loadDetail, loading, selectedRoles, user }
}
