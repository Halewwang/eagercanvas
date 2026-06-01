export const getWorkspaceBrand = ({ user = null, currentWorkspace = null } = {}) => {
  const displayName = String(user?.displayName || '').trim()
  if (displayName) return `${displayName} Workspace`
  const userId = String(user?.id || '').trim()
  if (userId) return `${userId} Workspace`
  return currentWorkspace?.name || 'Shared Workspace'
}

export const getWorkspaceSectionTitle = (activeSection) => {
  if (activeSection === 'featured') return 'Share Templates'
  return 'My Project'
}

export const getWorkspaceSectionDescription = (activeSection) => {
  if (activeSection === 'featured') {
    return 'Templates published by workspace members. Using one creates a full copy in your own projects.'
  }
  return 'Project cover is shown as 16:9. Manage project actions from the menu.'
}

export const formatWorkspaceDate = (date, now = new Date()) => {
  if (!date) return 'just now'
  const d = new Date(date)
  const diff = new Date(now) - d
  if (diff < 60000) return 'just now'
  if (diff < 3600000) return `${Math.floor(diff / 60000)} minutes ago`
  if (diff < 86400000) return `${Math.floor(diff / 3600000)} hours ago`
  if (diff < 604800000) return `${Math.floor(diff / 86400000)} days ago`
  return `${d.getMonth() + 1}/${d.getDate()}`
}

export const describeWorkspaceItem = ({ activeSection = 'projects', item = {}, now = new Date() } = {}) => {
  if (activeSection === 'projects') return `Updated ${formatWorkspaceDate(item.updatedAt, now)}`
  const owner = String(item?.ownerDisplayName || '').trim()
  const detail = String(item?.description || '').trim()
  if (owner && detail) return `${owner} · ${detail}`
  if (owner) return owner
  return detail || 'Template'
}

export const getWorkspaceCardIconKey = ({ activeSection = 'projects', item = {} } = {}) => {
  if (activeSection === 'projects') return 'project'
  if (item?.icon === 'ImageOutline') return 'image'
  if (item?.icon === 'VideocamOutline') return 'video'
  return 'default'
}

export const getWorkspaceProjectMenuOptions = () => [
  { label: 'Refresh from cloud', key: 'refresh-cloud' },
  { label: 'Copy project link', key: 'copy-link' },
  { label: 'Rename project', key: 'rename' },
  { label: 'Duplicate project', key: 'duplicate' },
  { type: 'divider', key: 'divider-1' },
  { label: 'Delete project', key: 'delete' }
]
