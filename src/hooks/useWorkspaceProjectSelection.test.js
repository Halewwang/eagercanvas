import assert from 'node:assert/strict'
import test from 'node:test'
import { effectScope, ref } from 'vue'
import { canDeleteWorkspaceProject, useWorkspaceProjectSelection } from './useWorkspaceProjectSelection.js'

const project = (id, permission = 'owner') => ({ id, permission })
const deferred = () => {
  let resolve
  const promise = new Promise((complete) => { resolve = complete })
  return { promise, resolve }
}
const setup = ({ list = [project('one'), project('two', 'editor')], deleteProject = async () => {}, getUserId = () => 'operator-a' } = {}) => {
  const items = ref(list)
  const scope = ref('team-a')
  return { items, scope, state: useWorkspaceProjectSelection({ items, scope, deleteProject, getUserId }) }
}

test('bulk project deletion requires an explicit writable permission and a valid id', () => {
  assert.equal(canDeleteWorkspaceProject(project('one')), true)
  assert.equal(canDeleteWorkspaceProject(project('two', 'editor')), true)
  for (const permission of ['viewer', undefined, '', 'admin']) assert.equal(canDeleteWorkspaceProject({ id: 'one', permission }), false)
  for (const id of ['', ' ', null, undefined, 42]) assert.equal(canDeleteWorkspaceProject(project(id)), false)
  assert.equal(canDeleteWorkspaceProject(null), false)
})

test('selection only includes current eligible projects and select all removes duplicates', () => {
  const { state } = setup({ list: [project('one'), project('one'), project('two', 'editor'), project('three', 'viewer'), { id: 'four' }] })
  state.startSelection()
  state.toggleProject('three')
  state.toggleProject('missing')
  assert.deepEqual(state.selectedIds.value, [])
  state.toggleProject('one')
  assert.deepEqual(state.selectedIds.value, ['one'])
  state.toggleProject('one')
  assert.deepEqual(state.selectedIds.value, [])
  state.selectAll()
  assert.equal(state.selectionMode.value, true)
  assert.deepEqual(state.selectedIds.value, ['one', 'two'])
  assert.deepEqual(state.selectedItems.value.map(({ id }) => id), ['one', 'two'])
  state.clearSelection()
  assert.equal(state.selectionMode.value, true)
  assert.deepEqual(state.selectedIds.value, [])
  state.cancelSelection()
  assert.equal(state.selectionMode.value, false)
})

test('scope changes clear selection and confirmation immediately', () => {
  const { scope, state } = setup()
  assert.equal(state.requestDelete(), false)
  state.selectAll()
  assert.equal(state.requestDelete(), true)
  assert.equal(state.showDeleteConfirmation.value, true)
  scope.value = 'team-b'
  assert.deepEqual(state.selectedIds.value, [])
  assert.equal(state.selectionMode.value, false)
  assert.equal(state.showDeleteConfirmation.value, false)
})

test('list and permission changes discard stale selections before deletion', async () => {
  const calls = []
  const { items, state } = setup({ deleteProject: async (id) => { calls.push(id) } })
  state.selectAll()
  items.value[0].permission = 'viewer'
  assert.deepEqual(state.selectedIds.value, ['two'])
  items.value = [project('three')]
  assert.deepEqual(state.selectedIds.value, [])
  assert.equal(state.requestDelete(), false)
  assert.deepEqual(await state.deleteSelected(), { deleted: 0, failed: [] })
  assert.deepEqual(calls, [])
})

test('confirmed deletion runs at most three requests concurrently and blocks duplicate submission', async () => {
  const gate = deferred()
  let active = 0
  let maximum = 0
  const calls = []
  const { state } = setup({
    list: Array.from({ length: 8 }, (_, index) => project(String(index))),
    deleteProject: async (id) => {
      calls.push(id)
      active += 1
      maximum = Math.max(maximum, active)
      await gate.promise
      active -= 1
    }
  })
  state.selectAll()
  assert.deepEqual(await state.deleteSelected(), { deleted: 0, failed: [] })
  assert.deepEqual(calls, [])
  state.requestDelete()
  const pending = state.deleteSelected()
  assert.equal(state.deleting.value, true)
  assert.equal(state.showDeleteConfirmation.value, true)
  assert.equal(calls.length, 3)
  assert.deepEqual(await state.deleteSelected(), { deleted: 0, failed: [] })
  state.cancelSelection()
  state.clearSelection()
  state.toggleProject('0')
  assert.equal(state.selectionMode.value, true)
  assert.equal(state.selectedIds.value.length, 8)
  gate.resolve()
  assert.deepEqual(await pending, { deleted: 8, failed: [] })
  assert.equal(maximum, 3)
  assert.equal(new Set(calls).size, 8)
  assert.equal(state.deleting.value, false)
  assert.equal(state.showDeleteConfirmation.value, false)
  assert.equal(state.selectionMode.value, false)
  assert.deepEqual(state.selectedIds.value, [])
})

test('partial deletion keeps only failures that remain visible and writable', async () => {
  const denied = new Error('denied')
  const invisible = new Error('removed elsewhere')
  const { items, state } = setup({
    list: [project('one'), project('two'), project('three')],
    deleteProject: async (id) => {
      if (id === 'two') throw denied
      if (id === 'three') {
        items.value = items.value.filter((item) => item.id !== id)
        throw invisible
      }
    }
  })
  state.selectAll()
  state.requestDelete()
  assert.deepEqual(await state.deleteSelected(), { deleted: 1, failed: [{ id: 'two', error: denied }, { id: 'three', error: invisible }] })
  assert.equal(state.selectionMode.value, true)
  assert.equal(state.showDeleteConfirmation.value, false)
  assert.deepEqual(state.selectedIds.value, ['two'])
})

test('an in-flight deletion retains its target snapshot without restoring selection in another scope', async () => {
  const gate = deferred()
  const calls = []
  const { scope, items, state } = setup({
    list: Array.from({ length: 4 }, (_, index) => project(`old-${index}`)),
    deleteProject: async (id) => {
      calls.push(id)
      await gate.promise
      throw new Error('old scope failure')
    }
  })
  state.selectAll()
  state.requestDelete()
  const pending = state.deleteSelected()
  scope.value = 'team-b'
  items.value = [project('new-project')]
  assert.equal(state.selectionMode.value, false)
  assert.equal(state.showDeleteConfirmation.value, false)
  assert.deepEqual(state.selectedIds.value, [])
  scope.value = 'team-a'
  gate.resolve()
  const result = await pending
  assert.equal(result.failed.length, 4)
  assert.deepEqual(calls, ['old-0', 'old-1', 'old-2', 'old-3'])
  assert.equal(state.deleting.value, false)
  assert.equal(state.selectionMode.value, false)
  assert.deepEqual(state.selectedIds.value, [])
})

test('an unauthenticated caller cannot submit a confirmed deletion', async () => {
  const calls = []
  const { state } = setup({ getUserId: () => '', deleteProject: async (id) => { calls.push(id) } })
  state.selectAll()
  state.requestDelete()
  assert.deepEqual(await state.deleteSelected(), { deleted: 0, failed: [] })
  assert.deepEqual(calls, [])
})

for (const nextActor of ['', 'operator-b']) {
  test(`queued deletion stops after actor changes to ${nextActor || 'logged-out'}, even after unmount`, async () => {
    const lifetime = effectScope()
    const actor = ref('operator-a')
    const gate = deferred()
    const calls = []
    const { state } = lifetime.run(() => setup({
      list: Array.from({ length: 4 }, (_, index) => project(`item-${index}`)),
      getUserId: () => actor.value,
      deleteProject: async (id) => {
        calls.push(id)
        await gate.promise
      }
    }))
    state.selectAll()
    state.requestDelete()
    const pending = state.deleteSelected()
    assert.deepEqual(calls, ['item-0', 'item-1', 'item-2'])
    lifetime.stop()
    actor.value = nextActor
    // A new session's state must survive completion of the old session's batch.
    state.selectedIds.value = ['new-session-selection']
    gate.resolve()
    const result = await pending
    assert.deepEqual(calls, ['item-0', 'item-1', 'item-2'])
    assert.equal(result.deleted, 3)
    assert.equal(result.failed.length, 1)
    assert.equal(result.failed[0].id, 'item-3')
    assert.equal(result.failed[0].error.name, 'AbortError')
    assert.deepEqual(state.selectedIds.value, ['new-session-selection'])
    assert.equal(state.deleting.value, false)
  })
}
