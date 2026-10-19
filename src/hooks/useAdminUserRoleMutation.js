import { updateAdminUserRoles } from '@/api/admin'
import { getErrorMessage } from '@/utils'
import { createAdminUserRoleMutationState } from './adminUserRoleMutationCore.js'

export const useAdminUserRoleMutation = (dependencies = {}) => createAdminUserRoleMutationState({
  updateRoles: updateAdminUserRoles,
  formatError: getErrorMessage,
  ...dependencies
})

export default useAdminUserRoleMutation
