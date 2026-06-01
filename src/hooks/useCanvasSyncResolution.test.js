import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { nextTick, ref } from 'vue'

const hookUrl = new URL('./useCanvasSyncResolution.js', import.meta.url)
const canvasSyncUrl = new URL('../utils/canvasSync.js', import.meta.url)
const vueUrl = import.meta.resolve('vue')
const hookSource = readFileSync(hookUrl, 'utf8')
  .replace("from 'vue'", `from '${vueUrl}'`)
  .replace("from '@/utils/canvasSync'", `from '${canvasSyncUrl.href}'`)
const { useCanvasSyncResolution } = await import(`data:text/javascript;base64,${Buffer.from(hookSource).toString('base64')}`)

const createHarness = (overrides = {}) => {
  const calls = []
  const projectSaveState = ref(overrides.projectSaveState || { status: 'synced', remoteSynced: true })
  const currentCanvasProjectId = ref(overrides.currentCanvasProjectId || 'project-current')
  const route = { params: { id: overrides.routeProjectId || 'project-route' } }

  const sync = useCanvasSyncResolution({
    currentCanvasProjectId,
    projectSaveState,
    route,
    router: {
      push: (path) => calls.push(['push', path])
    },
    duplicateProject: async (projectId) => {
      calls.push(['duplicate-project', projectId])
      return overrides.duplicateProjectResult ?? 'project-copy'
    },
    flushSave: async (options) => {
      calls.push(['flush-save', options])
      projectSaveState.value = overrides.flushSaveState || { status: 'synced', remoteSynced: true }
      return overrides.flushSaveResult ?? true
    },
    loadProjectById: async (projectId) => calls.push(['load-project', projectId]),
    notify: {
      error: (message) => calls.push(['error', message]),
      success: (message) => calls.push(['success', message])
    },
    refreshProjectById: async (projectId, options) => calls.push(['refresh-project', projectId, options])
  })

  return {
    calls,
    currentCanvasProjectId,
    projectSaveState,
    sync
  }
}

test('canvas sync resolution owns indicator labels and conflict modal visibility', async () => {
  const { projectSaveState, sync } = createHarness()

  assert.deepEqual(sync.syncIndicator.value, {
    label: 'Synced',
    title: 'This canvas is synced to the cloud.',
    dotClass: 'bg-emerald-400'
  })

  projectSaveState.value = { status: 'localPersisted' }
  assert.equal(sync.showRemoteRefreshControl.value, true)
  assert.equal(sync.syncIndicator.value.label, 'Saved locally')

  projectSaveState.value = { status: 'conflict' }
  await nextTick()

  assert.equal(sync.showConflictModal.value, true)
  assert.equal(sync.syncIndicator.value.label, 'Sync conflict')

  sync.cancelConflictResolution()
  assert.equal(sync.showConflictModal.value, false)
})

test('canvas sync resolution refreshes cloud state and overwrites conflicts through existing operations', async () => {
  const { calls, sync } = createHarness({
    projectSaveState: { status: 'conflict' }
  })

  await sync.refreshRemoteConflict()

  assert.equal(sync.showConflictModal.value, false)
  assert.equal(sync.conflictAction.value, '')
  assert.deepEqual(calls.splice(0), [
    ['refresh-project', 'project-current', { preferLocalDraft: false }],
    ['load-project', 'project-current'],
    ['success', 'Remote version loaded']
  ])

  sync.showConflictModal.value = true
  await sync.overwriteRemoteConflict()

  assert.equal(sync.showConflictModal.value, false)
  assert.deepEqual(calls.splice(0), [
    ['flush-save', { forceRemoteOverwrite: true }],
    ['success', 'Remote version overwritten']
  ])

  sync.openRemoteRefreshModal()
  assert.equal(sync.showRemoteRefreshModal.value, true)

  await sync.confirmRemoteRefresh()

  assert.equal(sync.showRemoteRefreshModal.value, false)
  assert.equal(sync.remoteRefreshAction.value, '')
  assert.deepEqual(calls.splice(0), [
    ['refresh-project', 'project-current', { preferLocalDraft: false }],
    ['load-project', 'project-current'],
    ['success', 'Cloud canvas refreshed']
  ])
})

test('canvas sync resolution saves conflict copies with the current project id', async () => {
  const { calls, sync } = createHarness()

  sync.showConflictModal.value = true
  await sync.saveConflictAsCopy()

  assert.equal(sync.showConflictModal.value, false)
  assert.equal(sync.conflictAction.value, '')
  assert.deepEqual(calls, [
    ['duplicate-project', 'project-current'],
    ['success', 'Saved as copy'],
    ['push', '/canvas/project-copy']
  ])
})
