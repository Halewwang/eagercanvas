/**
 * Canvas store | 画布状态管理
 * Manages nodes, edges and canvas state
 */
import { ref, watch } from 'vue'
import { updateProjectCanvas, getProjectCanvas } from './projects'
import { IMAGE_MODELS, VIDEO_MODELS, CHAT_MODELS, DEFAULT_IMAGE_MODEL, DEFAULT_VIDEO_MODEL, DEFAULT_CHAT_MODEL } from '../config/models'

// Node ID counter | 节点ID计数器
let nodeId = 0
const getNodeId = () => `node_${nodeId++}`

// Current project ID | 当前项目ID
export const currentProjectId = ref(null)

// Nodes and edges | 节点和边
export const nodes = ref([])
export const edges = ref([])
export const groups = ref([])

// Group ID counter | 编组ID计数器
let groupId = 0
const getGroupId = () => `group_${groupId++}`

// Viewport state | 视口状态
export const canvasViewport = ref({ x: 100, y: 50, zoom: 0.8 })

// Selected node | 选中的节点
export const selectedNode = ref(null)

// Auto-save flag | 自动保存标志
let autoSaveEnabled = false
let saveTimeout = null
let saveInFlight = null
let saveInFlightSnapshotKey = ''
let saveQueued = false
let queuedSnapshotKey = ''
let lastPersistedSnapshotKey = ''
const AUTO_SAVE_DELAY_MS = 1200
const VIEWPORT_POSITION_THRESHOLD = 24
const VIEWPORT_ZOOM_THRESHOLD = 0.02

// History for undo/redo | 撤销/重做历史
const history = ref([])
const historyIndex = ref(-1)
const MAX_HISTORY = 50
let isRestoring = false

const roundViewport = (viewport = {}) => ({
  x: Math.round(Number(viewport.x || 0)),
  y: Math.round(Number(viewport.y || 0)),
  zoom: Number(Number(viewport.zoom || 1).toFixed(3))
})

const buildCanvasSnapshot = () => ({
  nodes: JSON.parse(JSON.stringify(nodes.value)),
  edges: JSON.parse(JSON.stringify(edges.value)),
  groups: JSON.parse(JSON.stringify(groups.value)),
  viewport: roundViewport(canvasViewport.value)
})

const getSnapshotKey = (snapshot) => JSON.stringify(snapshot)

const shouldPersistViewport = (current, next) => {
  const currentViewport = roundViewport(current)
  const nextViewport = roundViewport(next)
  const dx = Math.abs(nextViewport.x - currentViewport.x)
  const dy = Math.abs(nextViewport.y - currentViewport.y)
  const dz = Math.abs(nextViewport.zoom - currentViewport.zoom)
  return dx >= VIEWPORT_POSITION_THRESHOLD || dy >= VIEWPORT_POSITION_THRESHOLD || dz >= VIEWPORT_ZOOM_THRESHOLD
}

/**
 * Save current state to history | 保存当前状态到历史
 */
const saveToHistory = () => {
  if (isRestoring) return
  
  const state = {
    nodes: JSON.parse(JSON.stringify(nodes.value)),
    edges: JSON.parse(JSON.stringify(edges.value)),
    groups: JSON.parse(JSON.stringify(groups.value))
  }
  
  // Remove future history if we're not at the end | 如果不在末尾，删除未来历史
  if (historyIndex.value < history.value.length - 1) {
    history.value = history.value.slice(0, historyIndex.value + 1)
  }
  
  // Add new state | 添加新状态
  history.value.push(state)
  
  // Limit history size | 限制历史大小
  if (history.value.length > MAX_HISTORY) {
    history.value.shift()
  } else {
    historyIndex.value++
  }
}

// Add a new node | 添加新节点
export const addNode = (type, position = { x: 100, y: 100 }, data = {}) => {
  const id = getNodeId()
  const now = Date.now()
  const newNode = {
    id,
    type,
    position,
    data: {
      ...getDefaultNodeData(type),
      ...data,
      createdAt: data.createdAt || now,
      updatedAt: data.updatedAt || now
    }
  }
  nodes.value = [...nodes.value, newNode]
  saveToHistory() // Save after adding node | 添加节点后保存
  return id
}

const cloneNodes = (items) => JSON.parse(JSON.stringify(items))
const cloneEdges = (items) => JSON.parse(JSON.stringify(items))

const getNextGroupName = () => {
  const indices = groups.value
    .map((group) => {
      const match = String(group.name || '').match(/^Field\s+(\d+)$/i)
      return match ? Number(match[1]) : 0
    })
    .filter(Boolean)
  const nextIndex = indices.length ? Math.max(...indices) + 1 : 1
  return `Field ${nextIndex}`
}

const normalizeGroups = (inputGroups = groups.value, inputNodes = nodes.value) => {
  const nodeIds = new Set(inputNodes.map((node) => node.id))
  const seenNodeIds = new Set()
  const nextGroups = []

  inputGroups.forEach((group) => {
    const memberIds = Array.from(
      new Set((group.nodeIds || []).filter((nodeId) => nodeIds.has(nodeId) && !seenNodeIds.has(nodeId)))
    )

    if (memberIds.length < 2) return

    memberIds.forEach((nodeId) => seenNodeIds.add(nodeId))
    nextGroups.push({
      ...group,
      nodeIds: memberIds,
      name: group.name || getNextGroupName()
    })
  })

  return nextGroups
}

const commitGroups = (nextGroups, shouldSaveHistory = true) => {
  groups.value = normalizeGroups(nextGroups, nodes.value)
  if (shouldSaveHistory) saveToHistory()
}

export const createGroup = (nodeIds, name = '') => {
  const uniqueNodeIds = Array.from(new Set(nodeIds)).filter((nodeId) => nodes.value.some((node) => node.id === nodeId))
  if (uniqueNodeIds.length < 2) return null

  const nextGroups = normalizeGroups(
    groups.value.map((group) => ({
      ...group,
      nodeIds: (group.nodeIds || []).filter((nodeId) => !uniqueNodeIds.includes(nodeId))
    })),
    nodes.value
  )

  const newGroup = {
    id: getGroupId(),
    name: name || getNextGroupName(),
    nodeIds: uniqueNodeIds,
    createdAt: Date.now(),
    updatedAt: Date.now()
  }

  commitGroups([...nextGroups, newGroup], true)
  return newGroup.id
}

export const renameGroup = (groupIdToRename, name) => {
  const nextName = String(name || '').trim()
  if (!nextName) return false

  let changed = false
  commitGroups(
    groups.value.map((group) => {
      if (group.id !== groupIdToRename) return group
      changed = true
      return {
        ...group,
        name: nextName,
        updatedAt: Date.now()
      }
    }),
    changed
  )
  return changed
}

export const ungroup = (groupIdToRemove) => {
  const nextGroups = groups.value.filter((group) => group.id !== groupIdToRemove)
  if (nextGroups.length === groups.value.length) return false
  commitGroups(nextGroups, true)
  return true
}

const removeNodesFromGroups = (nodeIds) => {
  const nodeIdSet = new Set(nodeIds)
  groups.value = normalizeGroups(
    groups.value.map((group) => ({
      ...group,
      nodeIds: (group.nodeIds || []).filter((nodeId) => !nodeIdSet.has(nodeId))
    })),
    nodes.value
  )
}

export const deleteGroupWithNodes = (groupIdToDelete) => {
  const targetGroup = groups.value.find((group) => group.id === groupIdToDelete)
  if (!targetGroup) return false

  const targetIds = new Set(targetGroup.nodeIds || [])
  nodes.value = nodes.value.filter((node) => !targetIds.has(node.id))
  edges.value = edges.value.filter((edge) => !targetIds.has(edge.source) && !targetIds.has(edge.target))
  groups.value = groups.value.filter((group) => group.id !== groupIdToDelete)
  saveToHistory()
  return true
}

export const translateNodesByIds = (nodeIds, delta, shouldSaveHistory = false) => {
  const nodeIdSet = new Set(nodeIds)
  const dx = Number(delta?.x || 0)
  const dy = Number(delta?.y || 0)
  if (!nodeIdSet.size || (!dx && !dy)) return false

  nodes.value = nodes.value.map((node) => {
    if (!nodeIdSet.has(node.id)) return node
    return {
      ...node,
      position: {
        x: node.position.x + dx,
        y: node.position.y + dy
      }
    }
  })

  if (shouldSaveHistory) saveToHistory()
  return true
}

export const duplicateGroup = (groupIdToDuplicate, offset = { x: 60, y: 60 }) => {
  const sourceGroup = groups.value.find((group) => group.id === groupIdToDuplicate)
  if (!sourceGroup) return null

  const sourceNodeIds = new Set(sourceGroup.nodeIds || [])
  const sourceNodes = nodes.value.filter((node) => sourceNodeIds.has(node.id))
  if (sourceNodes.length < 2) return null

  const idMap = new Map()
  const maxZIndex = Math.max(0, ...nodes.value.map((node) => node.zIndex || 0))
  const nextNodes = cloneNodes(nodes.value)
  const nextEdges = cloneEdges(edges.value)

  sourceNodes.forEach((node, index) => {
    const newNodeId = getNodeId()
    idMap.set(node.id, newNodeId)
    nextNodes.push({
      ...cloneNodes([node])[0],
      id: newNodeId,
      selected: false,
      position: {
        x: node.position.x + Number(offset?.x || 0),
        y: node.position.y + Number(offset?.y || 0)
      },
      zIndex: maxZIndex + index + 1,
      data: {
        ...(node.data || {}),
        selected: false,
        openPortMenu: null
      }
    })
  })

  edges.value.forEach((edge, index) => {
    if (!sourceNodeIds.has(edge.source) || !sourceNodeIds.has(edge.target)) return
    nextEdges.push({
      ...cloneEdges([edge])[0],
      id: `edge_${idMap.get(edge.source)}_${idMap.get(edge.target)}_${Date.now()}_${index}`,
      source: idMap.get(edge.source),
      target: idMap.get(edge.target),
      selected: false
    })
  })

  nodes.value = nextNodes
  edges.value = nextEdges

  const nextGroup = {
    id: getGroupId(),
    name: getNextGroupName(),
    nodeIds: sourceGroup.nodeIds.map((nodeId) => idMap.get(nodeId)).filter(Boolean),
    createdAt: Date.now(),
    updatedAt: Date.now()
  }
  groups.value = normalizeGroups([...groups.value, nextGroup], nodes.value)
  saveToHistory()
  return nextGroup.id
}

// Get default data for node type | 获取节点类型的默认数据
const getDefaultNodeData = (type) => {
  switch (type) {
    case 'text':
      return {
        content: '',
        label: '文本输入'
      }
    case 'imageConfig': {
      const imageModel = IMAGE_MODELS.find(m => m.key === DEFAULT_IMAGE_MODEL) || IMAGE_MODELS[0]
      return {
        prompt: '',
        model: DEFAULT_IMAGE_MODEL,
        size: imageModel?.defaultParams?.size || '1024x1024',
        quality: imageModel?.defaultParams?.quality || 'standard',
        label: '文生图'
      }
    }
    case 'videoConfig': {
      const videoModel = VIDEO_MODELS.find(m => m.key === DEFAULT_VIDEO_MODEL) || VIDEO_MODELS[0]
      return {
        prompt: '',
        ratio: videoModel?.defaultParams?.ratio || '16:9',
        duration: videoModel?.defaultParams?.duration || 5,
        model: DEFAULT_VIDEO_MODEL,
        label: '图生视频'
      }
    }
    case 'video': {
      const defaultVideoModel = VIDEO_MODELS.find(m => m.key === DEFAULT_VIDEO_MODEL) || VIDEO_MODELS[0]
      const defaultVideoRatio = defaultVideoModel?.defaultParams?.ratio || '16:9'
      const defaultVideoDuration = Number(defaultVideoModel?.defaultParams?.duration || 5)
      return {
        url: '',
        model: DEFAULT_VIDEO_MODEL,
        ratio: defaultVideoRatio,
        size: '',
        dur: defaultVideoDuration,
        duration: defaultVideoDuration,
        label: '视频节点'
      }
    }
    case 'image':
      return {
        url: '',
        model: DEFAULT_IMAGE_MODEL,
        size: '1024x1024',
        quality: 'standard',
        label: '图片节点'
      }
    case 'llmConfig':
      return {
        systemPrompt: '',
        model: DEFAULT_CHAT_MODEL,
        outputFormat: 'text',
        outputContent: '',
        label: 'LLM文本生成'
      }
    default:
      return {}
  }
}

// Update node data | 更新节点数据
export const updateNode = (id, data) => {
  nodes.value = nodes.value.map(node => 
    node.id === id ? { ...node, data: { ...node.data, ...data } } : node
  )
}

// Remove node | 删除节点
export const removeNode = (id) => {
  nodes.value = nodes.value.filter(node => node.id !== id)
  edges.value = edges.value.filter(edge => edge.source !== id && edge.target !== id)
  removeNodesFromGroups([id])
  saveToHistory() // Save after removing node | 删除节点后保存
}

export const removeNodesByIds = (nodeIds, shouldSaveHistory = true) => {
  const nodeIdSet = new Set(nodeIds)
  if (!nodeIdSet.size) return false
  nodes.value = nodes.value.filter((node) => !nodeIdSet.has(node.id))
  edges.value = edges.value.filter((edge) => !nodeIdSet.has(edge.source) && !nodeIdSet.has(edge.target))
  removeNodesFromGroups(nodeIds)
  if (shouldSaveHistory) saveToHistory()
  return true
}

// Duplicate node | 复制节点
export const duplicateNode = (id) => {
  const sourceNode = nodes.value.find(node => node.id === id)
  if (!sourceNode) return null
  
  const newId = getNodeId()
  
  // Calculate max z-index | 计算最大层级
  const maxZIndex = Math.max(0, ...nodes.value.map(n => n.zIndex || 0))
  
  const newNode = {
    id: newId,
    type: sourceNode.type,
    position: {
      x: sourceNode.position.x + 50,
      y: sourceNode.position.y + 50
    },
    data: { ...sourceNode.data },
    zIndex: maxZIndex + 1
  }
  nodes.value = [...nodes.value, newNode]
  saveToHistory() // Save after duplicating node | 复制节点后保存
  return newId
}

// Add edge | 添加边
export const addEdge = (params) => {
  const newEdge = {
    id: `edge_${params.source}_${params.target}`,
    ...params
  }
  edges.value = [...edges.value, newEdge]
  saveToHistory() // Save after adding edge | 添加连线后保存
}

// Update edge data | 更新边数据
export const updateEdge = (id, data) => {
  edges.value = edges.value.map(edge => 
    edge.id === id ? { ...edge, data: { ...edge.data, ...data } } : edge
  )
  saveToHistory() // Save after updating edge | 更新连线后保存
}

// Remove edge | 删除边
export const removeEdge = (id) => {
  edges.value = edges.value.filter(edge => edge.id !== id)
  saveToHistory() // Save after removing edge | 删除连线后保存
}

// Clear canvas | 清空画布
export const clearCanvas = () => {
  nodes.value = []
  edges.value = []
  groups.value = []
  nodeId = 0
  groupId = 0
}

// Initialize with sample data | 使用示例数据初始化
export const initSampleData = () => {
  clearCanvas()
  
  // Add text node | 添加文本节点
  addNode('text', { x: 150, y: 150 }, {
    content: '一只金毛寻回犬在草地上奔跑，摇着尾巴，脸上带着快乐的表情。它的毛发在阳光下闪耀，眼神充满了对自由的渴望，全身散发着阳光、友善的气息。',
    label: '文本输入'
  })
  
  // Add image config node | 添加文生图配置节点
  addNode('imageConfig', { x: 450, y: 150 }, {
    prompt: '',
    model: DEFAULT_IMAGE_MODEL,
    size: '1024x1024',
    label: '文生图'
  })
  
  // Add edge between nodes | 添加节点之间的边
  addEdge({
    source: 'node_0',
    target: 'node_1',
    sourceHandle: 'right',
    targetHandle: 'left'
  })
}

// Current project metadata | 当前项目元数据
export const currentProjectVersion = ref(null) // Stores updated_at for optimistic locking

/**
 * Load project data | 加载项目数据
 * @param {string} projectId - Project ID | 项目ID
 */
export const loadProject = (projectId) => {
  autoSaveEnabled = false
  isRestoring = true
  if (saveTimeout) {
    clearTimeout(saveTimeout)
    saveTimeout = null
  }
  saveQueued = false
  saveInFlight = null
  saveInFlightSnapshotKey = ''
  queuedSnapshotKey = ''
  currentProjectId.value = projectId
  
  const canvasData = getProjectCanvas(projectId)
  
  if (canvasData) {
    // Restore project version
    if (canvasData._meta && canvasData._meta.updatedAt) {
      currentProjectVersion.value = canvasData._meta.updatedAt
    } else {
      currentProjectVersion.value = null
    }

    // Restore nodes | 恢复节点
    nodes.value = canvasData.nodes || []
    edges.value = canvasData.edges || []
    groups.value = normalizeGroups(canvasData.groups || [], nodes.value)
    canvasViewport.value = canvasData.viewport || { x: 100, y: 50, zoom: 0.8 }
    
    // Normalize stale runtime state after page refresh.
    // 刷新后清理遗留运行态，避免再次触发生成动画或自动执行。
    nodes.value = nodes.value.map(node => {
      const data = { ...(node.data || {}) }
      const wasLoading = !!data.loading

      if (data.autoExecute) data.autoExecute = false
      if (data.loading) data.loading = false

      // Runtime status should not survive hard refresh as "running".
      if ((node.type === 'imageConfig' || node.type === 'videoConfig' || node.type === 'llmConfig') && data.status === 'running') {
        data.status = 'failed'
        if (!data.error) data.error = 'Task interrupted by page refresh. Please run again.'
      }

      // For output nodes, mark interrupted tasks explicitly when no URL exists.
      if ((node.type === 'image' || node.type === 'video') && wasLoading && !data.url && !data.error) {
        data.error = 'Task interrupted by page refresh. Please regenerate.'
      }

      return { ...node, data }
    })

    // Update node ID counter | 更新节点ID计数器
    const maxId = nodes.value.reduce((max, node) => {
      const match = node.id.match(/node_(\d+)/)
      if (match) {
        return Math.max(max, parseInt(match[1], 10))
      }
      return max
    }, -1)
    nodeId = maxId + 1
    const maxGroupId = groups.value.reduce((max, group) => {
      const match = String(group.id || '').match(/group_(\d+)/)
      if (match) {
        return Math.max(max, parseInt(match[1], 10))
      }
      return max
    }, -1)
    groupId = maxGroupId + 1
  } else {
    // Empty project | 空项目
    clearCanvas()
  }
  
  // Initialize history with current state | 用当前状态初始化历史
  history.value = [{
    nodes: JSON.parse(JSON.stringify(nodes.value)),
    edges: JSON.parse(JSON.stringify(edges.value)),
    groups: JSON.parse(JSON.stringify(groups.value))
  }]
  historyIndex.value = 0
  lastPersistedSnapshotKey = getSnapshotKey(buildCanvasSnapshot())
  
  // Enable auto-save after loading | 加载后启用自动保存
  setTimeout(() => {
    autoSaveEnabled = true
    isRestoring = false
  }, 100)
}

/**
 * Save current project | 保存当前项目
 */
export const saveProject = async () => {
  if (!currentProjectId.value) return

  const snapshot = buildCanvasSnapshot()
  const snapshotKey = getSnapshotKey(snapshot)

  if (snapshotKey === lastPersistedSnapshotKey) {
    return true
  }

  if (saveInFlight) {
    if (snapshotKey === saveInFlightSnapshotKey || snapshotKey === queuedSnapshotKey) {
      return saveInFlight
    }
    saveQueued = true
    queuedSnapshotKey = snapshotKey
    return saveInFlight
  }

  const runSave = async (pendingSnapshot, pendingSnapshotKey) => {
    let saved = true
    if (pendingSnapshotKey === lastPersistedSnapshotKey) {
      return true
    }

    try {
      const updatedProject = await updateProjectCanvas(
        currentProjectId.value,
        pendingSnapshot,
        currentProjectVersion.value
      )

      // Update local version after successful save
      if (updatedProject?.updatedAt) {
        currentProjectVersion.value = updatedProject.updatedAt
      }
      lastPersistedSnapshotKey = pendingSnapshotKey
    } catch (error) {
      saved = false
      if (error.status === 409 || error.code === 'PROJECT_CONFLICT') {
        // Handle conflict: Show dialog to user
        window.$message?.error('Project has been updated elsewhere. Please refresh.')
        // Ideally show a modal to chose: Overwrite or Refresh
      } else {
        console.error('Save failed:', error)
      }
    } finally {
      saveInFlight = null
      saveInFlightSnapshotKey = ''
      if (saveQueued) {
        saveQueued = false
        queuedSnapshotKey = ''
        // Fire next save with latest canvas snapshot.
        await saveProject()
      }
    }
    return saved
  }

  saveInFlightSnapshotKey = snapshotKey
  saveInFlight = runSave(snapshot, snapshotKey)
  return saveInFlight
}

/**
 * Flush pending autosave immediately | 立即刷新待保存内容
 */
export const flushSave = async () => {
  if (saveTimeout) {
    clearTimeout(saveTimeout)
    saveTimeout = null
  }
  return saveProject()
}

/**
 * Debounced auto-save | 防抖动自动保存
 */
const debouncedSave = () => {
  if (!autoSaveEnabled || !currentProjectId.value) return

  const snapshotKey = getSnapshotKey(buildCanvasSnapshot())
  if (
    snapshotKey === lastPersistedSnapshotKey ||
    snapshotKey === saveInFlightSnapshotKey ||
    snapshotKey === queuedSnapshotKey
  ) {
    return
  }
  
  if (saveTimeout) {
    clearTimeout(saveTimeout)
  }
  
  saveTimeout = setTimeout(() => {
    saveTimeout = null
    saveProject()
  }, AUTO_SAVE_DELAY_MS)
}

/**
 * Update viewport and save | 更新视口并保存
 */
export const updateViewport = (viewport) => {
  const currentViewport = canvasViewport.value
  canvasViewport.value = viewport
  if (shouldPersistViewport(currentViewport, viewport)) {
    debouncedSave()
  }
}

/**
 * Undo last action | 撤销上一步操作
 */
export const undo = () => {
  if (historyIndex.value <= 0) {
    window.$message?.info('没有可撤销的操作')
    return false
  }
  
  historyIndex.value--
  restoreState(history.value[historyIndex.value])
  return true
}

/**
 * Redo last undone action | 重做上一步撤销的操作
 */
export const redo = () => {
  if (historyIndex.value >= history.value.length - 1) {
    window.$message?.info('没有可重做的操作')
    return false
  }
  
  historyIndex.value++
  restoreState(history.value[historyIndex.value])
  return true
}

/**
 * Restore state from history | 从历史恢复状态
 */
const restoreState = (state) => {
  isRestoring = true
  nodes.value = JSON.parse(JSON.stringify(state.nodes))
  edges.value = JSON.parse(JSON.stringify(state.edges))
  groups.value = JSON.parse(JSON.stringify(state.groups || []))
  setTimeout(() => {
    isRestoring = false
  }, 100)
}

/**
 * Check if can undo | 检查是否可以撤销
 */
export const canUndo = () => historyIndex.value > 0

/**
 * Check if can redo | 检查是否可以重做
 */
export const canRedo = () => historyIndex.value < history.value.length - 1

/**
 * Manually save current state to history | 手动保存当前状态到历史
 * Used for edge deletions and other operations not covered by automatic saves
 */
export const manualSaveHistory = () => {
  saveToHistory()
}

// Watch for changes and auto-save (only save to project, not history) | 监听变化并自动保存（仅保存项目，不保存历史）
watch([nodes, edges, groups], () => {
  debouncedSave()
}, { deep: true })
