import assert from 'node:assert/strict'
import test from 'node:test'
import { computed, ref } from 'vue'

import { useCanvasGroupActions } from './useCanvasGroupActions.js'

const createHarness = (overrides = {}) => {
  const calls = []
  const groups = ref(overrides.groups || [
    { id: 'group-1', name: 'Group One', nodeIds: ['node-1', 'node-2'] }
  ])
  const selectedGroupId = ref(overrides.selectedGroupId || '')
  const selectedNodeIds = ref(overrides.selectedNodeIds || ['node-1', 'node-2'])

  const actions = useCanvasGroupActions({
    groups,
    selectedGroupId,
    selectedNodeIds: computed(() => selectedNodeIds.value),
    showNodeMenu: ref(false),
    clearNodeMenuContext: () => calls.push(['clear-menu']),
    clearNodeSelection: () => calls.push(['clear-node-selection']),
    createGroup: (nodeIds) => {
      calls.push(['create-group', nodeIds])
      return overrides.createGroupResult ?? 'group-new'
    },
    renameGroup: (groupId, name) => {
      calls.push(['rename-group', groupId, name])
      return overrides.renameGroupResult ?? true
    },
    duplicateGroup: (groupId, offset) => {
      calls.push(['duplicate-group', groupId, offset])
      return overrides.duplicateGroupResult ?? 'group-copy'
    },
    ungroup: (groupId) => {
      calls.push(['ungroup', groupId])
      return overrides.ungroupResult ?? true
    },
    deleteGroupWithNodes: (groupId) => {
      calls.push(['delete-group', groupId])
      return overrides.deleteGroupResult ?? true
    },
    notify: {
      success: (message) => calls.push(['success', message])
    },
    scheduleOverlayRectUpdate: (options) => calls.push(['schedule', options])
  })

  return {
    actions,
    calls,
    groups,
    selectedGroupId,
    selectedNodeIds
  }
}

test('canvas group actions create and select a group from selected nodes', () => {
  const { actions, calls, selectedGroupId } = createHarness()

  actions.handleCreateGroup()

  assert.equal(selectedGroupId.value, 'group-new')
  assert.deepEqual(calls, [
    ['create-group', ['node-1', 'node-2']],
    ['clear-node-selection'],
    ['success', 'Group created'],
    ['schedule', undefined]
  ])
})

test('canvas group actions open and confirm group rename state', () => {
  const { actions, calls } = createHarness({ selectedGroupId: 'group-1' })

  actions.openRenameGroupModal()

  assert.equal(actions.showGroupRenameModal.value, true)
  assert.equal(actions.groupRenameValue.value, 'Group One')

  actions.groupRenameValue.value = 'Updated Group'
  actions.confirmRenameGroup()

  assert.equal(actions.showGroupRenameModal.value, false)
  assert.deepEqual(calls, [
    ['rename-group', 'group-1', 'Updated Group'],
    ['success', 'Group renamed'],
    ['schedule', undefined]
  ])
})

test('canvas group actions duplicate, ungroup, delete, clear, and select groups', () => {
  const { actions, calls, selectedGroupId } = createHarness({ selectedGroupId: 'group-1' })

  actions.selectGroup('group-1')
  assert.equal(selectedGroupId.value, 'group-1')
  assert.deepEqual(calls.splice(0), [
    ['clear-node-selection'],
    ['clear-menu']
  ])

  actions.handleDuplicateSelectedGroup()
  assert.equal(selectedGroupId.value, 'group-copy')
  assert.deepEqual(calls.splice(0), [
    ['duplicate-group', 'group-1', { x: 60, y: 60 }],
    ['success', 'Group duplicated'],
    ['schedule', undefined]
  ])

  actions.handleUngroupSelectedGroup()
  assert.equal(selectedGroupId.value, null)
  assert.deepEqual(calls.splice(0), [
    ['ungroup', 'group-copy'],
    ['success', 'Group removed'],
    ['schedule', undefined]
  ])

  selectedGroupId.value = 'group-1'
  actions.handleDeleteSelectedGroup()
  assert.equal(selectedGroupId.value, null)
  assert.deepEqual(calls.splice(0), [
    ['delete-group', 'group-1'],
    ['success', 'Group deleted'],
    ['schedule', undefined]
  ])

  selectedGroupId.value = 'group-1'
  actions.clearGroupSelection()
  assert.equal(selectedGroupId.value, null)
})

test('canvas group actions skip invalid operations without side effects', () => {
  const { actions, calls } = createHarness({
    selectedGroupId: '',
    selectedNodeIds: ['node-1']
  })

  actions.handleCreateGroup()
  actions.openRenameGroupModal()
  actions.confirmRenameGroup()
  actions.handleDuplicateSelectedGroup()
  actions.handleUngroupSelectedGroup()
  actions.handleDeleteSelectedGroup()

  assert.deepEqual(calls, [])
})
