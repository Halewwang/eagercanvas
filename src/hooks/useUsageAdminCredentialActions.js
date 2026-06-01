import { ref } from 'vue'
import {
  assignUsageAdminUserKey,
  createUsageAdminApiKey,
  deleteUsageAdminApiKey,
  unassignUsageAdminUserKey
} from '@/api/usageAdmin'
import { getErrorMessage } from '@/utils'
import { createAdminServiceCredentialForm } from './adminServiceCredentialCore.js'

const noopAsync = async () => {}

const getWindowMessageApi = () => (typeof window === 'undefined' ? null : window.$message)

export const useUsageAdminCredentialActions = ({
  assignKeyRequest = assignUsageAdminUserKey,
  createKeyRequest = createUsageAdminApiKey,
  deleteKeyRequest = deleteUsageAdminApiKey,
  getMessageApi = getWindowMessageApi,
  loadAll = noopAsync,
  unassignKeyRequest = unassignUsageAdminUserKey
} = {}) => {
  const creatingKey = ref(false)
  const assignSelections = ref({})
  const createForm = ref(createAdminServiceCredentialForm())

  const updateCreateFormField = (field, value) => {
    createForm.value = { ...createForm.value, [field]: value }
  }

  const updateAssignmentSelection = (apiName, userId) => {
    assignSelections.value = { ...assignSelections.value, [apiName]: userId }
  }

  const createApiKey = async () => {
    if (!createForm.value.api_name.trim()) {
      getMessageApi()?.warning('api_name is required')
      return
    }

    creatingKey.value = true
    try {
      await createKeyRequest({
        ...createForm.value,
        api_name: createForm.value.api_name.trim()
      })
      getMessageApi()?.success('Service credential created')
      createForm.value.api_name = ''
      await loadAll()
    } catch (error) {
      if (!error?.__handled) getMessageApi()?.error(getErrorMessage(error, 'Failed to create service credential'))
    } finally {
      creatingKey.value = false
    }
  }

  const deleteApiKey = async (apiName) => {
    if (!apiName) return
    try {
      await deleteKeyRequest(apiName)
      getMessageApi()?.success('Service credential deleted')
      await loadAll()
    } catch (error) {
      if (!error?.__handled) getMessageApi()?.error(getErrorMessage(error, 'Failed to delete service credential'))
    }
  }

  const assignKeyFromRow = async (apiName) => {
    const userId = assignSelections.value[apiName]
    if (!userId) {
      getMessageApi()?.warning('Select user first')
      return
    }

    try {
      await assignKeyRequest(userId, apiName)
      getMessageApi()?.success('Assigned')
      await loadAll()
    } catch (error) {
      if (!error?.__handled) getMessageApi()?.error(getErrorMessage(error, 'Failed to assign credential'))
    }
  }

  const unassignKey = async (userId, apiName) => {
    try {
      await unassignKeyRequest(userId, apiName)
      getMessageApi()?.success('Unassigned')
      await loadAll()
    } catch (error) {
      if (!error?.__handled) getMessageApi()?.error(getErrorMessage(error, 'Failed to unassign credential'))
    }
  }

  return {
    assignKeyFromRow,
    assignSelections,
    createApiKey,
    createForm,
    creatingKey,
    deleteApiKey,
    unassignKey,
    updateAssignmentSelection,
    updateCreateFormField
  }
}

export default useUsageAdminCredentialActions
