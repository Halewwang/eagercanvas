import assert from 'node:assert/strict'
import test from 'node:test'

const workspaceDisplay = await import('./workspaceDisplay.js').catch(() => ({}))

test('workspace display helpers preserve brand and section copy behavior', () => {
  assert.equal(typeof workspaceDisplay.getWorkspaceBrand, 'function')
  assert.equal(typeof workspaceDisplay.getWorkspaceSectionTitle, 'function')
  assert.equal(typeof workspaceDisplay.getWorkspaceSectionDescription, 'function')

  assert.equal(
    workspaceDisplay.getWorkspaceBrand({
      user: { displayName: '  Hale  ', id: 'user-a' },
      currentWorkspace: { name: 'Team Canvas' }
    }),
    'Team Canvas'
  )
  assert.equal(
    workspaceDisplay.getWorkspaceBrand({
      user: { displayName: '  ', id: ' member-7 ' },
      currentWorkspace: { name: 'Team Canvas' }
    }),
    'Team Canvas'
  )
  assert.equal(
    workspaceDisplay.getWorkspaceBrand({
      user: null,
      currentWorkspace: { name: 'Team Canvas' }
    }),
    'Team Canvas'
  )
  assert.equal(workspaceDisplay.getWorkspaceBrand({}), 'Shared Workspace')

  assert.equal(workspaceDisplay.getWorkspaceSectionTitle('featured'), 'Share Templates')
  assert.equal(workspaceDisplay.getWorkspaceSectionTitle('shared'), 'Shared with me')
  assert.equal(workspaceDisplay.getWorkspaceSectionTitle('projects'), 'My Project')
  assert.equal(
    workspaceDisplay.getWorkspaceSectionDescription('featured'),
    'Community and workspace templates. Using one creates a full copy in the active workspace.'
  )
  assert.equal(
    workspaceDisplay.getWorkspaceSectionDescription('shared'),
    'Team projects you can open in read-only mode'
  )
  assert.equal(
    workspaceDisplay.getWorkspaceSectionDescription('projects'),
    'Projects are created in the active workspace. Team members can view team projects by default.'
  )
})

test('workspace display helpers preserve project and template card derivation', () => {
  assert.equal(typeof workspaceDisplay.formatWorkspaceDate, 'function')
  assert.equal(typeof workspaceDisplay.describeWorkspaceItem, 'function')
  assert.equal(typeof workspaceDisplay.getWorkspaceCardIconKey, 'function')
  const now = new Date('2026-05-31T12:00:00Z')

  assert.equal(workspaceDisplay.formatWorkspaceDate('', now), 'just now')
  assert.equal(workspaceDisplay.formatWorkspaceDate('2026-05-31T11:59:30Z', now), 'just now')
  assert.equal(workspaceDisplay.formatWorkspaceDate('2026-05-31T11:45:00Z', now), '15 minutes ago')
  assert.equal(workspaceDisplay.formatWorkspaceDate('2026-05-31T09:00:00Z', now), '3 hours ago')
  assert.equal(workspaceDisplay.formatWorkspaceDate('2026-05-29T12:00:00Z', now), '2 days ago')
  assert.equal(workspaceDisplay.formatWorkspaceDate('2026-05-20T12:00:00Z', now), '5/20')
  assert.equal(
    workspaceDisplay.describeWorkspaceItem({
      activeSection: 'projects',
      item: { updatedAt: '2026-05-31T11:45:00Z' },
      now
    }),
    'Updated 15 minutes ago'
  )
  assert.equal(
    workspaceDisplay.describeWorkspaceItem({
      activeSection: 'featured',
      item: { ownerDisplayName: 'Mina', description: 'Storyboard kit' }
    }),
    'Mina · Storyboard kit'
  )
  assert.equal(
    workspaceDisplay.describeWorkspaceItem({
      activeSection: 'featured',
      item: { ownerDisplayName: 'Mina', description: '  ' }
    }),
    'Mina'
  )
  assert.equal(
    workspaceDisplay.describeWorkspaceItem({
      activeSection: 'featured',
      item: { ownerDisplayName: '', description: 'Lighting setup' }
    }),
    'Lighting setup'
  )
  assert.equal(workspaceDisplay.describeWorkspaceItem({ activeSection: 'featured', item: {} }), 'Template')

  assert.equal(workspaceDisplay.getWorkspaceCardIconKey({ activeSection: 'projects', item: { icon: 'ImageOutline' } }), 'project')
  assert.equal(workspaceDisplay.getWorkspaceCardIconKey({ activeSection: 'featured', item: { icon: 'ImageOutline' } }), 'image')
  assert.equal(workspaceDisplay.getWorkspaceCardIconKey({ activeSection: 'featured', item: { icon: 'VideocamOutline' } }), 'video')
  assert.equal(workspaceDisplay.getWorkspaceCardIconKey({ activeSection: 'featured', item: { icon: 'Other' } }), 'default')
})

test('workspace project menu helper preserves action order and keys', () => {
  assert.equal(typeof workspaceDisplay.getWorkspaceProjectMenuOptions, 'function')
  assert.deepEqual(workspaceDisplay.getWorkspaceProjectMenuOptions(), [
    { label: 'Refresh from cloud', key: 'refresh-cloud' },
    { label: 'Copy project link', key: 'copy-link' },
    { label: 'Rename project', key: 'rename' },
    { label: 'Duplicate project', key: 'duplicate' },
    { type: 'divider', key: 'divider-1' },
    { label: 'Delete project', key: 'delete' }
  ])
  assert.deepEqual(workspaceDisplay.getWorkspaceProjectMenuOptions({ permission: 'viewer' }), [
    { label: 'Refresh from cloud', key: 'refresh-cloud' },
    { label: 'Copy project link', key: 'copy-link' },
    { type: 'divider', key: 'divider-1' },
    { label: 'Request edit access', key: 'request-edit' }
  ])
})
