import { computed, ref, watch } from 'vue'
import { getAdminUsers } from '@/api/admin'
import { getErrorMessage } from '@/utils'
import {
  getAdminActiveServiceUserCount,
  getAdminFilteredUsers,
  getAdminNotEnabledActiveUsers,
  getAdminPagedUsers,
  getAdminPendingBillingUserCount,
  getAdminServiceActivationRate,
  getAdminTopSpenders,
  getAdminTotalUserPages,
  getAdminUserPageEnd,
  getAdminUserPageStart,
  getAdminUserStats,
  getAdminVisibleUserPages,
  getClampedAdminUserPage
} from '@/utils/adminUsersData'
import { getAdminSelectedRoleMap } from './useAdminUsersStateCore.js'

const DEFAULT_USER_PAGE_SIZE = 10

const getWindowMessageApi = () => (typeof window === 'undefined' ? null : window.$message)

export const useAdminUsersState = ({
  canReadUsers,
  fetchUsers = getAdminUsers,
  getMessageApi = getWindowMessageApi,
  userPageSize = DEFAULT_USER_PAGE_SIZE
}) => {
  const users = ref([])
  const userSearchQuery = ref('')
  const userStatusFilter = ref('all')
  const userPage = ref(1)
  const selectedRoles = ref({})
  const loadingUsers = ref(false)

  const userStats = computed(() => getAdminUserStats(users.value))
  const topSpenders = computed(() => getAdminTopSpenders(users.value))
  const notEnabledActiveUsers = computed(() => getAdminNotEnabledActiveUsers(users.value))
  const pendingBillingUsers = computed(() => getAdminPendingBillingUserCount(users.value))
  const activeServiceUsers = computed(() => getAdminActiveServiceUserCount(users.value))
  const serviceActivationRate = computed(() => getAdminServiceActivationRate(users.value))
  const filteredUsers = computed(() => getAdminFilteredUsers(users.value, {
    query: userSearchQuery.value,
    statusFilter: userStatusFilter.value
  }))
  const totalUserPages = computed(() => getAdminTotalUserPages(filteredUsers.value, userPageSize))
  const pagedUsers = computed(() => getAdminPagedUsers(filteredUsers.value, { page: userPage.value, pageSize: userPageSize }))
  const userPageStart = computed(() => getAdminUserPageStart(filteredUsers.value, { page: userPage.value, pageSize: userPageSize }))
  const userPageEnd = computed(() => getAdminUserPageEnd(filteredUsers.value, { page: userPage.value, pageSize: userPageSize }))
  const visibleUserPages = computed(() => getAdminVisibleUserPages({ currentPage: userPage.value, totalPages: totalUserPages.value }))

  const setUserPage = (page) => {
    userPage.value = getClampedAdminUserPage(page, totalUserPages.value)
  }

  const updateRoleSelection = (userId, role) => {
    selectedRoles.value = { ...selectedRoles.value, [userId]: role }
  }

  watch([userSearchQuery, userStatusFilter], () => {
    userPage.value = 1
  })

  watch(filteredUsers, () => {
    if (userPage.value > totalUserPages.value) {
      userPage.value = totalUserPages.value
    }
  })

  const loadUsers = async () => {
    if (!canReadUsers.value) return
    loadingUsers.value = true
    try {
      const rsp = await fetchUsers()
      const list = Array.isArray(rsp?.data) ? rsp.data : []
      users.value = list
      selectedRoles.value = getAdminSelectedRoleMap(list)
    } catch (error) {
      if (!error?.__handled) getMessageApi()?.error(getErrorMessage(error, '加载用户列表失败'))
    } finally {
      loadingUsers.value = false
    }
  }

  return {
    activeServiceUsers,
    filteredUsers,
    loadUsers,
    loadingUsers,
    notEnabledActiveUsers,
    pagedUsers,
    pendingBillingUsers,
    selectedRoles,
    serviceActivationRate,
    setUserPage,
    topSpenders,
    totalUserPages,
    updateRoleSelection,
    userPage,
    userPageEnd,
    userPageStart,
    userSearchQuery,
    userStats,
    userStatusFilter,
    users,
    visibleUserPages
  }
}

export default useAdminUsersState
