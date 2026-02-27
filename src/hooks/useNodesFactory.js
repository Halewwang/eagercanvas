/**
 * Nodes Factory Hook | 节点工厂 Hook
 * Handles node creation logic from workflows and manual actions
 */
import { nextTick } from 'vue'
import { addNode, addEdge, nodes, updateNode } from '../stores/canvas'
import { translateLabel, WORKFLOW_NAME_MAP } from '../config/labels'
import { notifier } from '../utils/notifier'

export const useNodesFactory = ({ updateNodeInternals, viewport } = {}) => {
  
  /**
   * Calculate viewport center position
   * 计算视口中心位置
   */
  const getViewportCenter = () => {
    if (!viewport?.value) return { x: 0, y: 0 }
    
    const x = -viewport.value.x / viewport.value.zoom + (window.innerWidth / 2) / viewport.value.zoom
    const y = -viewport.value.y / viewport.value.zoom + (window.innerHeight / 2) / viewport.value.zoom
    return { x, y }
  }

  /**
   * Create nodes from workflow template
   * 从工作流模板创建节点
   */
  const createFromWorkflow = async (workflow, options) => {
    const center = getViewportCenter()
    const startPosition = { x: center.x - 300, y: center.y - 200 }
    
    const { nodes: newNodes, edges: newEdges } = workflow.createNodes(startPosition, options)
    
    // Add nodes to canvas | 将节点添加到画布
    newNodes.forEach(node => {
      const nodeData = {
        ...node.data,
        label: translateLabel(node.data?.label || '')
      }
      const nodeId = addNode(node.type, node.position, nodeData)
      
      // Update the node ID in edges | 更新边中的节点ID
      newEdges.forEach(edge => {
        if (edge.source === node.id) edge.source = nodeId
        if (edge.target === node.id) edge.target = nodeId
      })
      node.newId = nodeId
    })
    
    // Add edges to canvas | 将边添加到画布
    // Use nextTick to ensure nodes are rendered before adding edges (if needed)
    // or just add them. The original code used setTimeout 100ms.
    // We will use a small delay or nextTick to match original behavior just in case.
    
    setTimeout(() => {
      newEdges.forEach(edge => {
        addEdge({
          source: edge.source,
          target: edge.target,
          sourceHandle: edge.sourceHandle || 'right',
          targetHandle: edge.targetHandle || 'left',
          type: edge.type,  // Preserve edge type
          data: edge.data   // Preserve edge data
        })
      })
      
      // Update node internals | 更新节点内部
      if (updateNodeInternals) {
        newNodes.forEach(node => {
          if (node.newId) {
            updateNodeInternals(node.newId)
          }
        })
      }
    }, 100)
    
    const workflowName = WORKFLOW_NAME_MAP[workflow.name] || workflow.name
    notifier.success(`Workflow added: ${workflowName}`)
    
    return { nodes: newNodes, edges: newEdges }
  }
  
  /**
   * Create manual prompt chain (Text -> ImageConfig)
   * 创建手动提示词链
   */
  const createPromptChain = async (content, position) => {
    const textNodeId = addNode('text', position, { 
      content: content, 
      label: 'Prompt' 
    })
    
    const imageConfigNodeId = addNode('imageConfig', { x: position.x + 400, y: position.y }, {
      label: 'Text to Image'
    })
    
    addEdge({
      source: textNodeId,
      target: imageConfigNodeId,
      sourceHandle: 'right',
      targetHandle: 'left'
    })
    
    return { textNodeId, imageConfigNodeId }
  }
  
  /**
   * Add a single new node at center
   * 在中心添加单个新节点
   */
  const addNewNode = async (type) => {
    const center = getViewportCenter()
    
    // Add node at viewport center | 在视口中心添加节点
    const nodeId = addNode(type, { x: center.x - 100, y: center.y - 100 })
    
    // Set highest z-index | 设置最高层级
    const maxZIndex = Math.max(0, ...nodes.value.map(n => n.zIndex || 0))
    updateNode(nodeId, { zIndex: maxZIndex + 1 })
    
    // Force Vue Flow to recalculate node dimensions
    if (updateNodeInternals) {
      setTimeout(() => {
        updateNodeInternals(nodeId)
      }, 50)
    }
    
    return nodeId
  }

  return {
    createFromWorkflow,
    createPromptChain,
    addNewNode
  }
}

export default useNodesFactory
