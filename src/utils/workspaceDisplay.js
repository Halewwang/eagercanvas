export const getWorkspaceBrand = ({ user = null, currentWorkspace = null } = {}) => {
  if (currentWorkspace?.name) return currentWorkspace.name
  const displayName = String(user?.displayName || '').trim()
  if (displayName) return `${displayName} Workspace`
  const userId = String(user?.id || '').trim()
  if (userId) return `${userId} Workspace`
  return currentWorkspace?.name || 'Shared Workspace'
}

export const getWorkspaceSectionTitle = (activeSection, { currentWorkspace = null } = {}) => {
  if (activeSection === 'featured') return 'Share Templates'
  if (activeSection === 'shared') return 'Shared with me'
  if (currentWorkspace?.kind === 'team') return 'Team Workspace'
  return 'My Project'
}

export const getWorkspaceSectionDescription = (activeSection, { currentWorkspace = null } = {}) => {
  if (activeSection === 'featured') {
    return 'Community and workspace templates. Using one creates a full copy in the active workspace.'
  }
  if (activeSection === 'shared') {
    return 'Projects shared directly with you by another user.'
  }
  if (currentWorkspace?.kind === 'team') {
    return 'Projects in this team workspace. Members can open team projects in read-only mode by default.'
  }
  return 'Projects are created in the active workspace. Team members can view team projects by default.'
}

export const getWorkspaceProjectSectionKey = (project = {}) => {
  if (project.accessSource === 'direct_share') return 'shared'
  if (project.accessSource === 'team_workspace') return 'projects'
  if (project.accessMode === 'team') return 'projects'
  if (project.permission === 'viewer') return 'shared'
  return 'projects'
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

export const getWorkspaceProjectMenuOptions = (project = {}, options = {}) => {
  const base = [
    { label: 'Refresh from cloud', key: 'refresh-cloud', icon: 'refresh' },
    { label: 'Copy project link', key: 'copy-link', icon: 'copy' }
  ]
  if (project.permission === 'viewer') {
    return [
      ...base,
      { type: 'divider', key: 'divider-1' },
      { label: 'Request edit access', key: 'request-edit', icon: 'edit' }
    ]
  }
  return [
    ...base,
    { label: 'Rename project', key: 'rename', icon: 'edit' },
    { label: 'Duplicate project', key: 'duplicate', icon: 'copy' },
    ...(options.canCopyToTeam !== false && project.accessMode !== 'team'
      ? [{ label: 'Copy to team', key: 'copy-to-workspace', icon: 'folder' }]
      : []),
    ...(options.canShareWithUser !== false && project.accessMode !== 'team'
      ? [{ label: 'Share with user', key: 'share-user', icon: 'person' }]
      : []),
    { type: 'divider', key: 'divider-1' },
    { label: 'Delete project', key: 'delete', icon: 'trash' }
  ]
}
