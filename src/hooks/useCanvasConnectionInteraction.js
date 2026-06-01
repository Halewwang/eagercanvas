import { nextTick, ref } from 'vue'

export const useCanvasConnectionInteraction = ({
  addEdge = () => {},
  edgeStrategy = { resolve: (params) => params },
  isConnectionValid = () => true,
  manualSaveHistory = () => {},
  notify = {},
  refreshCanvasCollectionRefs = () => {},
  openConnectNodeMenu = () => {},
  openPaneNodeMenu = () => {}
} = {}) => {
  const pendingConnect = ref(null)
  const connectSucceeded = ref(false)

  const shouldIgnoreCanvasContextMenuTarget = (target) => {
    if (!target || typeof target.closest !== 'function') return false
    return Boolean(target.closest([
      '.canvas-group-title',
      '.canvas-group-edge',
      '.group-capsule-menu',
      '.vue-flow__node',
      '.vue-flow__edge',
      '.vue-flow__handle',
      'aside',
      'button',
      'input',
      'textarea',
      'select',
      '[contenteditable="true"]'
    ].join(',')))
  }

  const readPointer = (eventLike) => {
    if (!eventLike) return null
    const rawEvent = eventLike?.event || eventLike
    if (rawEvent.touches?.length) {
      return { x: rawEvent.touches[0].clientX, y: rawEvent.touches[0].clientY }
    }
    if (rawEvent.changedTouches?.length) {
      return { x: rawEvent.changedTouches[0].clientX, y: rawEvent.changedTouches[0].clientY }
    }
    const x = rawEvent.clientX ?? rawEvent.x ?? rawEvent.pageX
    const y = rawEvent.clientY ?? rawEvent.y ?? rawEvent.pageY
    if (typeof x === 'number' && typeof y === 'number') return { x, y }
    return null
  }

  const onConnect = (params) => {
    if (pendingConnect.value) {
      connectSucceeded.value = true
    }
    if (!isConnectionValid(params)) {
      notify.warning?.('This connection is not supported for the selected modules')
      return
    }
    const edge = edgeStrategy.resolve(params)
    addEdge(edge)
  }

  const onConnectStart = (params) => {
    const nodeId = params?.nodeId
    const handleId = params?.handleId
    const handleType = params?.handleType
    if (!nodeId || !handleId || !handleType) {
      pendingConnect.value = null
      return
    }
    pendingConnect.value = {
      nodeId,
      handleId,
      handleType,
      startPoint: readPointer(params?.event)
    }
    connectSucceeded.value = false
  }

  const onConnectEnd = (event) => {
    const current = pendingConnect.value
    if (!current) return

    const releasePoint = readPointer(event)
    const shouldOpenMenu = !connectSucceeded.value && releasePoint

    pendingConnect.value = null
    connectSucceeded.value = false

    if (shouldOpenMenu) {
      openConnectNodeMenu(releasePoint, current)
    }
  }

  const onEdgesChange = (changes = []) => {
    if (Array.isArray(changes) && changes.length) {
      refreshCanvasCollectionRefs({ edges: true })
    }

    const hasRemoval = Array.isArray(changes) && changes.some((change) => change?.type === 'remove')

    if (hasRemoval) {
      nextTick(() => {
        manualSaveHistory()
      })
    }
  }

  const onPaneContextMenu = (event) => {
    event?.preventDefault?.()
    event?.stopPropagation?.()

    const point = readPointer(event)
    if (!point) return

    openPaneNodeMenu(point)
  }

  const handleCanvasContextMenu = (event) => {
    if (shouldIgnoreCanvasContextMenuTarget(event?.target)) return
    event?.preventDefault?.()
    event?.stopPropagation?.()

    const point = readPointer(event)
    if (!point) return

    openPaneNodeMenu(point)
  }

  return {
    handleCanvasContextMenu,
    onConnect,
    onConnectEnd,
    onConnectStart,
    onEdgesChange,
    onPaneContextMenu
  }
}

export default useCanvasConnectionInteraction
