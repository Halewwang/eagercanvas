const toUserList = (users) => (Array.isArray(users) ? users : [])

export const getAdminUserStats = (users = []) => {
  return toUserList(users).reduce((acc, item) => {
    const status = String(item.status || 'active')
    acc.total += 1
    if (status === 'suspended') acc.suspended += 1
    else if (status === 'deleted') acc.deleted += 1
    else acc.active += 1
    return acc
  }, { total: 0, active: 0, suspended: 0, deleted: 0 })
}

export const getAdminTopSpenders = (users = []) => {
  return [...toUserList(users)]
    .filter((item) => Number(item?.officialUsage?.totalCostAmount || 0) > 0)
    .sort((a, b) => Number(b?.officialUsage?.totalCostAmount || 0) - Number(a?.officialUsage?.totalCostAmount || 0))
    .slice(0, 5)
}

export const getAdminNotEnabledActiveUsers = (users = []) => {
  return toUserList(users).filter((item) => {
    const status = String(item.status || 'active')
    const serviceStatus = String(item.service?.serviceStatus || 'not_enabled')
    return status === 'active' && serviceStatus !== 'active'
  })
}

export const getAdminPendingBillingUserCount = (users = []) => {
  return toUserList(users).filter((item) => Number(item?.reconciliation?.pendingCount || 0) > 0).length
}

export const getAdminActiveServiceUserCount = (users = []) => {
  return toUserList(users).filter((item) => item.service?.serviceStatus === 'active').length
}

export const getAdminServiceActivationRate = (users = []) => {
  const list = toUserList(users)
  const total = list.filter((item) => String(item.status || 'active') === 'active').length
  if (!total) return 0
  return Math.round((getAdminActiveServiceUserCount(list) / total) * 100)
}

export const getAdminFilteredUsers = (users = [], { query = '', statusFilter = 'all' } = {}) => {
  const keyword = String(query || '').trim().toLowerCase()
  const filterStatus = String(statusFilter || 'all')
  return toUserList(users)
    .filter((item) => {
      const matchesKeyword = !keyword || [
        item.id,
        item.email,
        item.displayName
      ].some((value) => String(value || '').toLowerCase().includes(keyword))
      const status = String(item.status || 'active')
      const matchesStatus = filterStatus === 'all' || status === filterStatus
      return matchesKeyword && matchesStatus
    })
    .sort((a, b) => {
      const costGap = Number(b?.officialUsage?.totalCostAmount || 0) - Number(a?.officialUsage?.totalCostAmount || 0)
      if (costGap !== 0) return costGap
      return String(b?.usageMeta?.lastActivityAt || b?.createdAt || '').localeCompare(String(a?.usageMeta?.lastActivityAt || a?.createdAt || ''))
    })
}

export const getAdminTotalUserPages = (users = [], pageSize = 10) => {
  return Math.max(1, Math.ceil(toUserList(users).length / pageSize))
}

export const getAdminPagedUsers = (users = [], { page = 1, pageSize = 10 } = {}) => {
  const start = (page - 1) * pageSize
  return toUserList(users).slice(start, start + pageSize)
}

export const getAdminUserPageStart = (users = [], { page = 1, pageSize = 10 } = {}) => {
  if (toUserList(users).length === 0) return 0
  return (page - 1) * pageSize + 1
}

export const getAdminUserPageEnd = (users = [], { page = 1, pageSize = 10 } = {}) => {
  const list = toUserList(users)
  if (list.length === 0) return 0
  return Math.min(page * pageSize, list.length)
}

export const getAdminVisibleUserPages = ({ currentPage = 1, totalPages = 1 } = {}) => {
  if (totalPages <= 5) return Array.from({ length: totalPages }, (_, idx) => idx + 1)
  if (currentPage <= 3) return [1, 2, 3, 4, 5]
  if (currentPage >= totalPages - 2) return [totalPages - 4, totalPages - 3, totalPages - 2, totalPages - 1, totalPages]
  return [currentPage - 2, currentPage - 1, currentPage, currentPage + 1, currentPage + 2]
}

export const getClampedAdminUserPage = (page, totalPages = 1) => {
  return Math.min(Math.max(Number(page) || 1, 1), totalPages)
}
