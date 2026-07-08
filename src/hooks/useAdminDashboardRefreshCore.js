const SECTION_LOADER_KEYS = {
  overview: ['usage', 'users'],
  users: ['users'],
  service: ['users', 'service'],
  audit: ['audit'],
  issues: ['issues']
}

const loaderAllowed = {
  usage: ({ canReadUsage = false } = {}) => canReadUsage,
  users: ({ canReadUsers = false } = {}) => canReadUsers,
  service: ({ showServiceSection = false } = {}) => showServiceSection,
  audit: ({ canReadAudit = false } = {}) => canReadAudit,
  issues: ({ canReadIssues = false } = {}) => canReadIssues
}

export const getAdminDashboardRefreshLoaderKeys = ({
  sectionKey = 'overview',
  canReadAudit = false,
  canReadIssues = false,
  canReadUsage = false,
  canReadUsers = false,
  showServiceSection = false
} = {}) => {
  const keys = SECTION_LOADER_KEYS[sectionKey] || SECTION_LOADER_KEYS.overview
  const context = {
    canReadAudit,
    canReadIssues,
    canReadUsage,
    canReadUsers,
    showServiceSection
  }
  return keys.filter((key) => loaderAllowed[key]?.(context))
}

export const getAdminDashboardSessionOptions = ({ forceSession = false } = {}) => ({
  force: Boolean(forceSession)
})
