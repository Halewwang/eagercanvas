const ADMIN_USER_DETAIL_TABS = new Set(['summary', 'roles'])

const normalizeString = (value) => typeof value === 'string' ? value.trim() : ''

export const buildAdminAccessAssignmentTarget = (userId) => {
  const targetUserId = normalizeString(userId)
  return {
    name: 'AdminUsers',
    query: {
      ...(targetUserId ? { userId: targetUserId } : {}),
      tab: 'roles'
    }
  }
}

export const buildAdminUserDetailTarget = (userId, tab = 'summary') => {
  const targetUserId = normalizeString(userId)
  const requestedTab = normalizeString(tab)
  if (requestedTab === 'roles') {
    return buildAdminAccessAssignmentTarget(targetUserId)
  }
  return {
    name: 'AdminUserDetail',
    params: { userId: targetUserId },
    ...(ADMIN_USER_DETAIL_TABS.has(requestedTab) ? { query: { tab: requestedTab } } : {})
  }
}

export const resolveAdminUsersAccessFocus = (query = {}) => {
  const targetUserId = normalizeString(query?.userId)
  if (!targetUserId || normalizeString(query?.tab) !== 'roles') return null
  return { embedded: true, initialTab: 'roles', targetUserId }
}

export const resolveAdminUserDetailTarget = ({
  targetUserId,
  routeUserId,
  initialTab
} = {}) => {
  const userId = normalizeString(targetUserId) || normalizeString(routeUserId)
  const requestedTab = normalizeString(initialTab)
  return {
    activeTab: ADMIN_USER_DETAIL_TABS.has(requestedTab) ? requestedTab : 'summary',
    userId
  }
}
