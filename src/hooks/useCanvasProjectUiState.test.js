import assert from 'node:assert/strict'
import { test } from 'node:test'
import { ref } from 'vue'
import { useCanvasProjectUiState } from './useCanvasProjectUiState.js'

const createState = (overrides = {}) => {
  const route = overrides.route || { params: { id: 'project-2' } }
  const projects = overrides.projects || ref([
    { id: 'project-1', name: 'First Project' },
    { id: 'project-2', name: 'Second Project' }
  ])
  const currentWorkspace = overrides.currentWorkspace || ref({ name: 'Design Studio' })

  return useCanvasProjectUiState({ route, projects, currentWorkspace })
}

test('canvas project UI state owns project menu and rename/delete modal defaults', () => {
  const state = createState()

  assert.equal(state.projectName.value, 'Second Project')
  assert.equal(state.workspaceName.value, 'Design Studio')
  assert.deepEqual(state.projectOptions, [
    { label: 'Rename', key: 'rename' },
    { label: 'Duplicate', key: 'duplicate' },
    { label: 'Delete', key: 'delete' }
  ])

  state.openRenameModal()
  assert.equal(state.renameValue.value, 'Second Project')
  assert.equal(state.showRenameModal.value, true)

  state.closeRenameModal()
  assert.equal(state.showRenameModal.value, false)

  state.openDeleteModal()
  assert.equal(state.showDeleteModal.value, true)

  state.closeDeleteModal()
  assert.equal(state.showDeleteModal.value, false)
})

test('canvas project UI state owns share dialog defaults and template status updates', () => {
  const state = createState()

  state.openShareDialog()
  assert.equal(state.showShareModal.value, true)
  assert.equal(state.shareDialogLoading.value, true)
  assert.equal(state.shareTemplateName.value, 'Second Project')
  assert.equal(state.shareTemplateDescription.value, '')
  assert.equal(state.isTemplatePublished.value, false)
  assert.equal(state.lastPublishedAt.value, '')

  state.applyShareTemplateStatus({
    isPublished: true,
    title: 'Published Template',
    description: 'Template description',
    updatedAt: '2026-06-01T01:00:00Z'
  })
  assert.equal(state.isTemplatePublished.value, true)
  assert.equal(state.shareTemplateName.value, 'Published Template')
  assert.equal(state.shareTemplateDescription.value, 'Template description')
  assert.equal(state.lastPublishedAt.value, '2026-06-01T01:00:00Z')

  state.finishShareDialog()
  assert.equal(state.shareDialogLoading.value, false)

  state.setShareActionLoading(true)
  assert.equal(state.shareActionLoading.value, true)

  state.applySharedTemplateSave({
    isPublished: true,
    publishedAt: '2026-06-01T02:00:00Z'
  })
  assert.equal(state.isTemplatePublished.value, true)
  assert.equal(state.lastPublishedAt.value, '2026-06-01T02:00:00Z')

  state.applySharedTemplateRemoval()
  assert.equal(state.isTemplatePublished.value, false)
  assert.equal(state.lastPublishedAt.value, '')
})
