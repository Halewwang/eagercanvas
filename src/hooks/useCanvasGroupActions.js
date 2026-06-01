import { computed, ref } from 'vue'

export const useCanvasGroupActions = ({
  groups,
  selectedGroupId,
  selectedNodeIds,
  showNodeMenu = null,
  hideNodeMenu = null,
  clearNodeMenuContext = () => {},
  clearNodeSelection = () => {},
  createGroup = () => '',
  renameGroup = () => false,
  duplicateGroup = () => '',
  ungroup = () => false,
  deleteGroupWithNodes = () => false,
  notify = {},
  scheduleOverlayRectUpdate = () => {}
} = {}) => {
  const showGroupRenameModal = ref(false)
  const groupRenameTargetId = ref('')
  const groupRenameValue = ref('')
  const selectedGroup = computed(() => {
    const id = selectedGroupId?.value
    return groups?.value?.find((group) => group.id === id) || null
  })

  const clearGroupSelection = () => {
    selectedGroupId.value = null
  }

  const selectGroup = (groupIdToSelect) => {
    clearNodeSelection()
    selectedGroupId.value = groupIdToSelect
    if (showNodeMenu) showNodeMenu.value = false
    hideNodeMenu?.()
    clearNodeMenuContext()
  }

  const handleCreateGroup = () => {
    const nodeIds = Array.isArray(selectedNodeIds?.value) ? selectedNodeIds.value : []
    if (nodeIds.length < 2) return
    const groupId = createGroup(nodeIds)
    if (!groupId) return
    clearNodeSelection()
    selectedGroupId.value = groupId
    notify.success?.('Group created')
    scheduleOverlayRectUpdate()
  }

  const openRenameGroupModal = () => {
    if (!selectedGroup.value) return
    groupRenameTargetId.value = selectedGroup.value.id
    groupRenameValue.value = selectedGroup.value.name || ''
    showGroupRenameModal.value = true
  }

  const confirmRenameGroup = () => {
    if (!groupRenameTargetId.value) return
    const ok = renameGroup(groupRenameTargetId.value, groupRenameValue.value)
    if (!ok) return
    showGroupRenameModal.value = false
    notify.success?.('Group renamed')
    scheduleOverlayRectUpdate()
  }

  const handleDuplicateSelectedGroup = () => {
    if (!selectedGroupId.value) return
    const newGroupId = duplicateGroup(selectedGroupId.value, { x: 60, y: 60 })
    if (!newGroupId) return
    selectedGroupId.value = newGroupId
    notify.success?.('Group duplicated')
    scheduleOverlayRectUpdate()
  }

  const handleUngroupSelectedGroup = () => {
    if (!selectedGroupId.value) return
    const ok = ungroup(selectedGroupId.value)
    if (!ok) return
    selectedGroupId.value = null
    notify.success?.('Group removed')
    scheduleOverlayRectUpdate()
  }

  const handleDeleteSelectedGroup = () => {
    if (!selectedGroupId.value) return
    const ok = deleteGroupWithNodes(selectedGroupId.value)
    if (!ok) return
    selectedGroupId.value = null
    notify.success?.('Group deleted')
    scheduleOverlayRectUpdate()
  }

  return {
    selectedGroup,
    showGroupRenameModal,
    groupRenameValue,
    clearGroupSelection,
    selectGroup,
    handleCreateGroup,
    openRenameGroupModal,
    confirmRenameGroup,
    handleDuplicateSelectedGroup,
    handleUngroupSelectedGroup,
    handleDeleteSelectedGroup
  }
}
