export const getAdminAuditPagination = (response = {}, query = {}) => ({
  page: Number(response?.pagination?.page || query.page || 1),
  limit: Number(response?.pagination?.limit || query.limit || 20),
  total: Number(response?.pagination?.total || 0)
})
