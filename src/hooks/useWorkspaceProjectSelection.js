import { computed, ref, watch } from 'vue'

export const canDeleteWorkspaceProject = (item) => (
  typeof item?.id === 'string' && item.id.trim().length > 0 &&
  (item.permission === 'owner' || item.permission === 'editor')
)

export const useWorkspaceProjectSelection = ({ items, scope, deleteProject, getUserId = () => '' }) => {
  const selectedIds = ref([])
  const selectionMode = ref(false)
  const deleting = ref(false)
  const showDeleteConfirmation = ref(false)
  let scopeGeneration = 0
  const eligibleItems = computed(() => [...new Map(
    items.value.filter(canDeleteWorkspaceProject).map((item) => [item.id, item])
  ).values()])
  const selectedItems = computed(() => {
    const byId = new Map(eligibleItems.value.map((item) => [item.id, item]))
    return selectedIds.value.map((id) => byId.get(id)).filter(Boolean)
  })

  const resetSelection = () => {
    selectedIds.value = []
    selectionMode.value = false
    showDeleteConfirmation.value = false
  }
  watch(scope, () => {
    scopeGeneration += 1
    resetSelection()
  }, { flush: 'sync' })
  watch(eligibleItems, (eligible) => {
    const available = new Set(eligible.map((item) => item.id))
    selectedIds.value = selectedIds.value.filter((id) => available.has(id))
    if (!selectedIds.value.length && !deleting.value) showDeleteConfirmation.value = false
  }, { flush: 'sync' })

  const startSelection = () => {
    if (!deleting.value) selectionMode.value = true
  }
  const toggleProject = (id) => {
    if (deleting.value || !eligibleItems.value.some((item) => item.id === id)) return
    selectionMode.value = true
    selectedIds.value = selectedIds.value.includes(id)
      ? selectedIds.value.filter((selected) => selected !== id)
      : [...selectedIds.value, id]
  }
  const selectAll = () => {
    if (deleting.value) return
    selectionMode.value = true
    selectedIds.value = eligibleItems.value.map((item) => item.id)
  }
  const clearSelection = () => {
    if (deleting.value) return
    selectedIds.value = []
    showDeleteConfirmation.value = false
  }
  const cancelSelection = () => {
    if (!deleting.value) resetSelection()
  }
  const requestDelete = () => {
    if (deleting.value || !selectedItems.value.length) return false
    showDeleteConfirmation.value = true
    return true
  }
  const deleteSelected = async () => {
    if (deleting.value || !showDeleteConfirmation.value || !selectedItems.value.length) return { deleted: 0, failed: [] }
    const submittedUserId = getUserId()
    if (!submittedUserId) return { deleted: 0, failed: [] }
    const targets = selectedItems.value.map((item) => item.id)
    const submittedGeneration = scopeGeneration
    const results = new Array(targets.length)
    let cursor = 0
    deleting.value = true
    try {
      await Promise.all(Array.from({ length: Math.min(3, targets.length) }, async () => {
        while (cursor < targets.length) {
          const index = cursor++
          const id = targets[index]
          try {
            if (getUserId() !== submittedUserId) throw new DOMException('Account changed. Remaining deletions cancelled.', 'AbortError')
            await deleteProject(id)
          } catch (error) {
            results[index] = { id, error }
          }
        }
      }))
      const failed = results.filter(Boolean)
      if (submittedGeneration === scopeGeneration && getUserId() === submittedUserId) {
        const available = new Set(eligibleItems.value.map((item) => item.id))
        selectedIds.value = failed.map(({ id }) => id).filter((id) => available.has(id))
        selectionMode.value = selectedIds.value.length > 0
        showDeleteConfirmation.value = false
      }
      return { deleted: targets.length - failed.length, failed }
    } finally {
      deleting.value = false
    }
  }

  return {
    eligibleItems, selectedIds, selectedItems, selectionMode, deleting, showDeleteConfirmation,
    toggleProject, selectAll, clearSelection, startSelection, cancelSelection, requestDelete, deleteSelected
  }
}
