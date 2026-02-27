/**
 * Edge Strategy Service | 边策略服务
 * Handles edge connection logic based on node types
 */
import { nodes, edges } from '../stores/canvas'

export const edgeStrategy = {
  /**
   * Determine edge properties based on connection params
   * 根据连接参数确定边属性
   * @param {object} params - Connection params from Vue Flow (source, target, handles)
   * @returns {object} Edge object ready to be added
   */
  resolve: (params) => {
    const sourceNode = nodes.value.find(n => n.id === params.source)
    const targetNode = nodes.value.find(n => n.id === params.target)
    
    // Case 1: Image -> VideoConfig (imageRole)
    if (sourceNode?.type === 'image' && targetNode?.type === 'videoConfig') {
      return {
        ...params,
        type: 'imageRole',
        data: { imageRole: 'first_frame_image' } // Default to first frame | 默认首帧
      }
    } 
    
    // Case 2: Text -> ImageConfig (promptOrder)
    else if (sourceNode?.type === 'text' && targetNode?.type === 'imageConfig') {
      // Calculate next order number | 计算下一个顺序号
      const existingTextEdges = edges.value.filter(e => 
        e.target === params.target && e.type === 'promptOrder'
      )
      const nextOrder = existingTextEdges.length + 1
      
      return {
        ...params,
        type: 'promptOrder',
        data: { promptOrder: nextOrder }
      }
    } 
    
    // Case 3: Image -> ImageConfig (imageOrder)
    else if (sourceNode?.type === 'image' && targetNode?.type === 'imageConfig') {
      // Calculate next order number | 计算下一个顺序号
      const existingImageEdges = edges.value.filter(e => 
        e.target === params.target && e.type === 'imageOrder'
      )
      const nextOrder = existingImageEdges.length + 1
      
      return {
        ...params,
        type: 'imageOrder',
        data: { imageOrder: nextOrder }
      }
    } 
    
    // Default: Standard connection
    else {
      return params
    }
  }
}

export default edgeStrategy
