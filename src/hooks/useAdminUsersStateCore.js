export const buildAdminUsersRequestParams = (query = {}) => ({
  page: Math.max(1, Number(query.page) || 1),
  limit: Math.max(1, Number(query.limit) || 25),
  search: String(query.search || '').trim(),
  status: String(query.status || ''),
  serviceStatus: String(query.serviceStatus || ''),
  role: String(query.role || '')
})

export const normalizeAdminUsersPageResponse = (response = {}) => {
  const data = response?.data || {}
  const pagination = data.pagination || {}
  const limit = Math.max(1, Number(pagination.limit) || 25)
  const total = Math.max(0, Number(pagination.total) || 0)
  return {
    items: Array.isArray(data.items) ? data.items : [],
    pagination: {
      page: Math.max(1, Number(pagination.page) || 1),
      limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / limit))
    }
  }
}

export const requestAdminUsersPage = async (fetchUsers, query = {}) => {
  const firstResponse = await fetchUsers(buildAdminUsersRequestParams(query))
  const firstPage = normalizeAdminUsersPageResponse(firstResponse)
  if (firstPage.pagination.page <= firstPage.pagination.totalPages) {
    return { page: firstPage, queryPage: firstPage.pagination.page }
  }

  const queryPage = firstPage.pagination.totalPages
  const correctedResponse = await fetchUsers(buildAdminUsersRequestParams({ ...query, page: queryPage }))
  return { page: normalizeAdminUsersPageResponse(correctedResponse), queryPage }
}
