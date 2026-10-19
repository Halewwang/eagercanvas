import { computed, onUnmounted, ref, watch } from 'vue'
import { getAdminUsers } from '@/api/admin'
import { getErrorMessage } from '@/utils'
import { getAdminVisibleUserPages } from '@/utils/adminUsersData'
import { requestAdminUsersPage } from './useAdminUsersStateCore.js'

const DEFAULT_USER_PAGE_SIZE = 25
const getWindowMessageApi = () => (typeof window === 'undefined' ? null : window.$message)

export const useAdminUsersState = ({
  canReadUsers,
  fetchUsers = getAdminUsers,
  getMessageApi = getWindowMessageApi,
  userPageSize = DEFAULT_USER_PAGE_SIZE
}) => {
  const users = ref([])
  const query = ref({
    page: 1,
    limit: userPageSize,
    search: '',
    status: '',
    serviceStatus: '',
    role: ''
  })
  const pagination = ref({ page: 1, limit: userPageSize, total: 0, totalPages: 1 })
  const loadingUsers = ref(false)

  const userSearchQuery = computed({
    get: () => query.value.search,
    set: (value) => { query.value.search = String(value || '') }
  })
  const filterRef = (key) => computed({
    get: () => query.value[key] || 'all',
    set: (value) => { query.value[key] = value === 'all' ? '' : String(value || '') }
  })
  const userStatusFilter = filterRef('status')
  const userServiceStatusFilter = filterRef('serviceStatus')
  const userRoleFilter = filterRef('role')
  const userPage = computed({
    get: () => query.value.page,
    set: (value) => { query.value.page = Math.max(1, Number(value) || 1) }
  })

  const totalUserPages = computed(() => pagination.value.totalPages)
  const userPageStart = computed(() => pagination.value.total ? ((pagination.value.page - 1) * pagination.value.limit) + 1 : 0)
  const userPageEnd = computed(() => Math.min(pagination.value.total, pagination.value.page * pagination.value.limit))
  const visibleUserPages = computed(() => getAdminVisibleUserPages({
    currentPage: userPage.value,
    totalPages: totalUserPages.value
  }))

  let searchTimer = null
  let requestSequence = 0

  const loadUsers = async () => {
    if (!canReadUsers.value) return
    const requestId = ++requestSequence
    loadingUsers.value = true
    try {
      const result = await requestAdminUsersPage(fetchUsers, query.value)
      if (requestId !== requestSequence) return
      const page = result.page
      users.value = page.items
      pagination.value = page.pagination
      query.value.page = result.queryPage
    } catch (error) {
      if (requestId === requestSequence && !error?.__handled) {
        getMessageApi()?.error(getErrorMessage(error, '加载用户列表失败'))
      }
    } finally {
      if (requestId === requestSequence) loadingUsers.value = false
    }
  }

  const setUserPage = async (page) => {
    userPage.value = Math.min(Math.max(1, Number(page) || 1), totalUserPages.value)
    await loadUsers()
  }

  watch([userStatusFilter, userServiceStatusFilter, userRoleFilter], () => {
    requestSequence += 1
    userPage.value = 1
    void loadUsers()
  })
  watch(userSearchQuery, () => {
    requestSequence += 1
    userPage.value = 1
    if (searchTimer) clearTimeout(searchTimer)
    searchTimer = setTimeout(() => void loadUsers(), 250)
  })

  onUnmounted(() => {
    requestSequence += 1
    if (searchTimer) clearTimeout(searchTimer)
    searchTimer = null
  })

  return {
    loadUsers,
    loadingUsers,
    pagination,
    query,
    setUserPage,
    totalUserPages,
    userPage,
    userPageEnd,
    userPageStart,
    userRoleFilter,
    userSearchQuery,
    userServiceStatusFilter,
    userStatusFilter,
    users,
    visibleUserPages
  }
}

export default useAdminUsersState
