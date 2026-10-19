import { onUnmounted } from 'vue'
import { getAdminUser } from '@/api/admin'
import { getErrorMessage } from '@/utils'
import { createAdminUserDetailState } from './useAdminUserDetailCore.js'

export const useAdminUserDetail = (dependencies) => {
  const state = createAdminUserDetailState({
    fetchUser: getAdminUser,
    formatError: getErrorMessage,
    ...dependencies
  })
  onUnmounted(state.invalidate)
  return state
}

export default useAdminUserDetail
