export const getWorkspaceBrand = ({ user = null, currentWorkspace = null } = {}) => {
  if (currentWorkspace?.name) return currentWorkspace.name
  const displayName = String(user?.displayName || '').trim()
  if (displayName) return `${displayName} Workspace`
  const userId = String(user?.id || '').trim()
  if (userId) return `${userId} Workspace`
  return currentWorkspace?.name || 'Shared Workspace'
}

export const getWorkspaceSectionTitle = (activeSection) => {
  if (activeSection === 'featured') return 'Share Templates'
  if (activeSection === 'shared') return 'Shared with me'
  return 'My Project'
}

export const getWorkspaceSectionDescription = (activeSection) => {
  if (activeSection === 'featured') {
    return 'Community and workspace templates. Using one creates a full copy in the active workspace.'
  }
  if (activeSection === 'shared') {
    return 'Team projects you can open in read-only mode'
  }
  return 'Projects are created in the active workspace. Team members can view team projects by default.'
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
  if (activeSection === 'projects' || activeSection === 'shared') {
    const owner = item.ownerDisplayName ? ` · ${item.ownerDisplayName}` : ''
    return `Updated ${formatWorkspaceDate(item.updatedAt, now)}${owner}`
  }
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

export const getWorkspaceProjectMenuOptions = (project = {}) => {
  const base = [
    { label: 'Refresh from cloud', key: 'refresh-cloud' },
    { label: 'Copy project link', key: 'copy-link' }
  ]
  if (project.permission === 'viewer') {
    return [
      ...base,
      { type: 'divider', key: 'divider-1' },
      { label: 'Request edit access', key: 'request-edit' }
    ]
  }
  return [
    ...base,
    { label: 'Rename project', key: 'rename' },
    { label: 'Duplicate project', key: 'duplicate' },
    { type: 'divider', key: 'divider-1' },
    { label: 'Delete project', key: 'delete' }
  ]
}
