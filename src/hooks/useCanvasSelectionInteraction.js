import { computed } from 'vue'

export const useCanvasSelectionInteraction = ({
  nodes,
  edges,
  groups,
  selectedGroupId,
  showNodeMenu,
  suppressPaneClickUntil,
  clearNodeMenuContext = () => {},
  handleDeleteSelectedGroup = () => {},
  manualSaveHistory = () => {},
  removeNodesByIds = () => {},
  nowFn = () => Date.now()
} = {}) => {
  const selectedNodeIds = computed(() =>
    (nodes?.value || []).filter((node) => node.selected || node.data?.selected).map((node) => node.id)
  )

  const selectedGroup = computed(() => {
    const id = selectedGroupId?.value
    return (groups?.value || []).find((group) => group.id === id) || null
  })

  const clearNodeSelection = () => {
    nodes.value = (nodes.value || []).map((node) => ({
      ...node,
      selected: false,
      data: {
        ...(node.data || {}),
        selected: false,
        openPortMenu: null
      }
    }))
  }

  const clearGroupSelection = () => {
    selectedGroupId.value = null
  }

  const syncNodeSelectedState = () => {
    const multiSelected = (nodes.value || []).filter((node) => !!node.selected).map((node) => node.id)
    const multiSelectedSet = new Set(multiSelected)
    const selectedGroupNodeIds = new Set(
      selectedGroup.value?.nodeIds?.filter((nodeId) => !multiSelectedSet.has(nodeId)) || []
    )

    const nextNodes = (nodes.value || []).map((node) => {
      const selected = !!node.selected
      const current = !!node.data?.selected
      const suppressCapsule = multiSelected.length >= 2
        ? multiSelectedSet.has(node.id)
        : selectedGroupNodeIds.has(node.id)
      const currentSuppressCapsule = !!node.data?.suppressCapsule
      if (selected === current && suppressCapsule === currentSuppressCapsule) return node
      return {
        ...node,
        data: {
          ...(node.data || {}),
          selected,
          suppressCapsule
        }
      }
    })

    if (nextNodes.some((node, index) => node !== nodes.value[index])) {
      nodes.value = nextNodes
    }
  }

  const onNodeClick = () => {
    clearGroupSelection()
    if (showNodeMenu) showNodeMenu.value = false
    clearNodeMenuContext()
  }

  const onPaneClick = () => {
    if (nowFn() < (suppressPaneClickUntil?.value || 0)) {
      return
    }
    clearGroupSelection()
    if (showNodeMenu) showNodeMenu.value = false
    clearNodeMenuContext()
    clearNodeSelection()
  }

  const isTypingElement = (target) => {
    if (!target) return false
    const tag = String(target.tagName || '').toLowerCase()
    if (tag === 'input' || tag === 'textarea' || tag === 'select') return true
    return !!target.closest?.('[contenteditable="true"]')
  }

  const removeSelectedElements = () => {
    const selectedNodeIdsSet = new Set(
      (nodes.value || []).filter((node) => node.selected || node.data?.selected).map((node) => node.id)
    )
    const selectedEdgeIds = new Set((edges.value || []).filter((edge) => edge.selected).map((edge) => edge.id))
    if (selectedNodeIdsSet.size === 0 && selectedEdgeIds.size === 0) return

    removeNodesByIds(Array.from(selectedNodeIdsSet), false)
    edges.value = (edges.value || []).filter((edge) => !selectedEdgeIds.has(edge.id))
    manualSaveHistory()
  }

  const handleGlobalKeydown = (event) => {
    if (isTypingElement(event.target)) return
    if (event.key !== 'Delete' && event.key !== 'Backspace') return
    if (selectedGroupId.value) {
      event.preventDefault?.()
      handleDeleteSelectedGroup()
      return
    }
    removeSelectedElements()
  }

  return {
    selectedGroup,
    selectedNodeIds,
    clearGroupSelection,
    clearNodeSelection,
    handleGlobalKeydown,
    isTypingElement,
    onNodeClick,
    onPaneClick,
    removeSelectedElements,
    syncNodeSelectedState
  }
}

export default useCanvasSelectionInteraction
