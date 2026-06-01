import { ref } from 'vue'
import {
  getUsageAdminApiKeys,
  getUsageAdminBalance,
  getUsageAdminUsers
} from '@/api/usageAdmin'

export const useUsageAdminDataState = ({
  fetchApiKeys = getUsageAdminApiKeys,
  fetchBalance = getUsageAdminBalance,
  fetchUsers = getUsageAdminUsers
} = {}) => {
  const balance = ref('')
  const users = ref([])
  const apiKeys = ref([])
  const loadingAll = ref(false)

  const loadAll = async () => {
    loadingAll.value = true
    try {
      const [balanceRsp, usersRsp, keysRsp] = await Promise.all([
        fetchBalance(),
        fetchUsers(),
        fetchApiKeys()
      ])

      balance.value = String(balanceRsp?.data?.balance ?? '')
      users.value = Array.isArray(usersRsp?.data) ? usersRsp.data : []
      apiKeys.value = Array.isArray(keysRsp?.data) ? keysRsp.data : []
    } finally {
      loadingAll.value = false
    }
  }

  return {
    apiKeys,
    balance,
    loadAll,
    loadingAll,
    users
  }
}

export default useUsageAdminDataState
