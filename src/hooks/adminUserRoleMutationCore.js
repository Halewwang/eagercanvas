import { ref, unref } from 'vue'

const FIXED_ROLE_CODES = ['super_admin', 'admin', 'ops', 'support', 'user']
const denied = Object.freeze({ value: false })

export const createAdminUserRoleMutationState = ({
  canMutateRoles = denied,
  canUseDesktopActions = denied,
  currentUserId = ref(''),
  error = ref(''),
  formatError = (cause, fallback) => String(cause?.message || fallback),
  refreshDetail = async () => {},
  selectedRoles = ref([]),
  targetUserId = ref(''),
  updateRoles = async () => {}
} = {}) => {
  const savingRoles = ref(false)

  const saveRoles = async () => {
    if (!unref(canMutateRoles) || !unref(canUseDesktopActions) || savingRoles.value) return false
    const userId = String(unref(targetUserId) || '').trim()
    const operatorUserId = String(unref(currentUserId) || '').trim()
    const selected = new Set(Array.isArray(unref(selectedRoles)) ? unref(selectedRoles) : [])
    const roles = FIXED_ROLE_CODES.filter((role) => selected.has(role))
    if (!userId || (operatorUserId && operatorUserId === userId) || !roles.length) return false

    savingRoles.value = true
    error.value = ''
    try {
      await updateRoles(userId, roles)
      await refreshDetail()
      return true
    } catch (cause) {
      error.value = formatError(cause, '更新角色失败')
      return false
    } finally {
      savingRoles.value = false
    }
  }

  return { saveRoles, savingRoles }
}
