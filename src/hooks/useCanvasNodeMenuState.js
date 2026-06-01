import { computed, ref } from 'vue'

export const CANVAS_NODE_TYPE_OPTIONS = [
  { type: 'text', name: 'Text', description: 'Write prompts, scripts, and supporting copy.' },
  { type: 'image', name: 'Image', description: 'Generate, preview, and upload still images.' },
  { type: 'video', name: 'Video', description: 'Generate videos with connected visual inputs.' }
]

const getViewportSize = () => ({
  width: Number(globalThis.window?.innerWidth || 1440),
  height: Number(globalThis.window?.innerHeight || 900)
})

export const useCanvasNodeMenuState = ({
  getFlowPointFromScreenPoint = (point) => point,
  clearGroupSelection = () => {},
  clearNodeSelection = () => {}
} = {}) => {
  const showNodeMenu = ref(false)
  const nodeCreateCount = ref(1)
  const nodeMenuMode = ref('toolbar')
  const nodeMenuScreenPosition = ref(null)
  const pendingPaneCreatePosition = ref(null)
  const pendingConnectMenuContext = ref(null)
  const suppressPaneClickUntil = ref(0)

  const nodeMenuTitle = computed(() =>
    nodeMenuMode.value === 'connect'
      ? 'Create And Link A Module'
      : nodeMenuMode.value === 'pane'
        ? 'Create Module'
      : 'Choose A Base Module'
  )
  const nodeMenuCopy = computed(() =>
    nodeMenuMode.value === 'connect'
      ? 'Release a loose connection anywhere on the canvas, then pick a module to create and link it from that spot.'
      : nodeMenuMode.value === 'pane'
        ? 'Pick a module type to place it at this canvas point.'
      : 'Pick a module type, then add between 1 and 5 modules at once.'
  )
  const nodeMenuStyle = computed(() => {
    if (nodeMenuScreenPosition.value) {
      const { width, height } = getViewportSize()
      const x = Math.max(92, Math.min(width - 334, nodeMenuScreenPosition.value.x))
      const y = Math.max(18, Math.min(height - 340, nodeMenuScreenPosition.value.y))
      return {
        left: `${x}px`,
        top: `${y}px`
      }
    }
    return {
      left: '90px',
      top: '50%',
      transform: 'translateY(-50%)'
    }
  })

  const clearNodeMenuContext = () => {
    nodeMenuMode.value = 'toolbar'
    nodeMenuScreenPosition.value = null
    pendingPaneCreatePosition.value = null
    pendingConnectMenuContext.value = null
  }

  const toggleToolbarNodeMenu = () => {
    if (showNodeMenu.value && nodeMenuMode.value === 'toolbar') {
      showNodeMenu.value = false
      clearNodeMenuContext()
      return
    }
    nodeMenuMode.value = 'toolbar'
    nodeMenuScreenPosition.value = null
    pendingPaneCreatePosition.value = null
    pendingConnectMenuContext.value = null
    showNodeMenu.value = true
  }

  const openConnectNodeMenu = (point, context) => {
    nodeMenuMode.value = 'connect'
    nodeMenuScreenPosition.value = {
      x: point.x + 12,
      y: point.y - 12
    }
    suppressPaneClickUntil.value = Date.now() + 160
    pendingConnectMenuContext.value = {
      ...context,
      flowPosition: getFlowPointFromScreenPoint(point)
    }
    showNodeMenu.value = true
  }

  const openPaneNodeMenu = (point) => {
    nodeMenuMode.value = 'pane'
    nodeMenuScreenPosition.value = {
      x: point.x + 12,
      y: point.y - 12
    }
    pendingPaneCreatePosition.value = getFlowPointFromScreenPoint(point)
    pendingConnectMenuContext.value = null
    suppressPaneClickUntil.value = Date.now() + 160
    clearGroupSelection()
    clearNodeSelection()
    showNodeMenu.value = true
  }

  const increaseNodeCount = () => {
    nodeCreateCount.value = Math.min(5, nodeCreateCount.value + 1)
  }

  const decreaseNodeCount = () => {
    nodeCreateCount.value = Math.max(1, nodeCreateCount.value - 1)
  }

  return {
    showNodeMenu,
    nodeCreateCount,
    nodeMenuMode,
    nodeMenuScreenPosition,
    pendingPaneCreatePosition,
    pendingConnectMenuContext,
    suppressPaneClickUntil,
    nodeTypeOptions: CANVAS_NODE_TYPE_OPTIONS,
    nodeMenuTitle,
    nodeMenuCopy,
    nodeMenuStyle,
    clearNodeMenuContext,
    toggleToolbarNodeMenu,
    openConnectNodeMenu,
    openPaneNodeMenu,
    increaseNodeCount,
    decreaseNodeCount
  }
}
