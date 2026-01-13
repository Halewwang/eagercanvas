/**
 * Workflow Orchestrator Hook | 工作流编排 Hook
 * 使用回调串行结构编排节点执行
 * 
 * 依赖关系：
 * - imageConfig 执行后产生 image 节点
 * - videoConfig 依赖 image 节点作为输入
 * - 串行执行：等待上一步完成后再执行下一步
 */

import { ref, watch } from 'vue'
import { streamChatCompletions } from '@/api'
import { 
  nodes, 
  addNode, 
  addEdge, 
  updateNode 
} from '@/stores/canvas'

// Workflow types | 工作流类型
const WORKFLOW_TYPES = {
  TEXT_TO_IMAGE: 'text_to_image',
  TEXT_TO_IMAGE_TO_VIDEO: 'text_to_image_to_video',
}

// System prompt for intent analysis | 意图分析系统提示词
const INTENT_ANALYSIS_PROMPT = `你是一个工作流分析助手。根据用户输入判断需要的工作流类型，并生成对应的提示词。

工作流类型：
1. text_to_image - 用户想要生成图片（默认）
2. text_to_image_to_video - 用户想要生成图片并转成视频（包含"视频"、"动画"、"动起来"等关键词）

返回 JSON：
{
  "workflow_type": "text_to_image 或 text_to_image_to_video",
  "description": "简短描述",
  "image_prompt": "优化后的图片生成提示词，详细描述画面内容、风格、光影等",
  "video_prompt": "视频生成提示词，描述动作、运镜、节奏等（仅 text_to_image_to_video 需要）"
}

提示词优化要求：
- image_prompt: 基于用户输入扩展，添加画面细节、艺术风格、光影效果等
- video_prompt: 描述画面如何动起来，如镜头移动、主体动作、氛围变化等

返回纯 JSON，不要其他内容。`

/**
 * Workflow Orchestrator Composable
 */
export const useWorkflowOrchestrator = () => {
  // State | 状态
  const isAnalyzing = ref(false)
  const isExecuting = ref(false)
  const currentStep = ref(0)
  const totalSteps = ref(0)
  const executionLog = ref([])
  
  // Active watchers | 活跃的监听器
  const activeWatchers = []
  
  /**
   * Add log entry | 添加日志
   */
  const addLog = (type, message) => {
    executionLog.value.push({ type, message, timestamp: Date.now() })
    console.log(`[Workflow ${type}] ${message}`)
  }
  
  /**
   * Clear all watchers | 清除所有监听器
   */
  const clearWatchers = () => {
    activeWatchers.forEach(stop => stop())
    activeWatchers.length = 0
  }
  
  /**
   * Wait for config node to complete and return output node ID
   * 等待配置节点完成并返回输出节点 ID
   */
  const waitForConfigComplete = (configNodeId) => {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('执行超时'))
      }, 5 * 60 * 1000)
      
      let stopWatcher = null
      
      const checkNode = (node) => {
        if (!node) return false
        
        // Check for error | 检查错误
        if (node.data?.error) {
          clearTimeout(timeout)
          if (stopWatcher) stopWatcher()
          reject(new Error(node.data.error))
          return true
        }
        
        // Config node completed with output node ID | 配置节点完成并返回输出节点 ID
        if (node.data?.executed && node.data?.outputNodeId) {
          clearTimeout(timeout)
          if (stopWatcher) stopWatcher()
          addLog('success', `节点 ${configNodeId} 完成，输出节点: ${node.data.outputNodeId}`)
          resolve(node.data.outputNodeId)
          return true
        }
        return false
      }
      
      // Check immediately first | 先立即检查一次
      const node = nodes.value.find(n => n.id === configNodeId)
      if (checkNode(node)) return
      
      // Then watch for changes | 然后监听变化
      stopWatcher = watch(
        () => nodes.value.find(n => n.id === configNodeId),
        (node) => checkNode(node),
        { deep: true }
      )
      
      activeWatchers.push(stopWatcher)
    })
  }
  
  /**
   * Wait for output node (image/video) to be ready
   * 等待输出节点准备好
   */
  const waitForOutputReady = (outputNodeId) => {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('输出节点超时'))
      }, 5 * 60 * 1000)
      
      let stopWatcher = null
      
      const checkNode = (node) => {
        if (!node) return false
        
        if (node.data?.error) {
          clearTimeout(timeout)
          if (stopWatcher) stopWatcher()
          reject(new Error(node.data.error))
          return true
        }
        
        // Output node ready when has URL and not loading
        if (node.data?.url && !node.data?.loading) {
          clearTimeout(timeout)
          if (stopWatcher) stopWatcher()
          addLog('success', `输出节点 ${outputNodeId} 已就绪`)
          resolve(node)
          return true
        }
        return false
      }
      
      // Check immediately first | 先立即检查一次
      const node = nodes.value.find(n => n.id === outputNodeId)
      if (checkNode(node)) return
      
      // Then watch for changes | 然后监听变化
      stopWatcher = watch(
        () => nodes.value.find(n => n.id === outputNodeId),
        (node) => checkNode(node),
        { deep: true }
      )
      
      activeWatchers.push(stopWatcher)
    })
  }
  
  /**
   * Analyze user intent | 分析用户意图
   */
  const analyzeIntent = async (userInput) => {
    isAnalyzing.value = true
    
    try {
      let response = ''
      for await (const chunk of streamChatCompletions({
        model: 'gpt-4o',
        messages: [
          { role: 'system', content: INTENT_ANALYSIS_PROMPT },
          { role: 'user', content: userInput }
        ]
      })) {
        response += chunk
      }
      
      const jsonMatch = response.match(/\{[\s\S]*\}/)
      if (!jsonMatch) {
        return { workflow_type: WORKFLOW_TYPES.TEXT_TO_IMAGE }
      }
      
      return JSON.parse(jsonMatch[0])
    } catch (err) {
      addLog('error', `分析失败: ${err.message}`)
      return { workflow_type: WORKFLOW_TYPES.TEXT_TO_IMAGE }
    } finally {
      isAnalyzing.value = false
    }
  }
  
  /**
   * Execute text-to-image workflow | 执行文生图工作流
   * text → imageConfig (autoExecute) → image
   */
  const executeTextToImage = async (imagePrompt, position) => {
    const nodeSpacing = 400
    let x = position.x
    
    addLog('info', '开始执行文生图工作流')
    currentStep.value = 1
    totalSteps.value = 2
    
    // Step 1: Create text node for image | 创建图片提示词节点
    const textNodeId = addNode('text', { x, y: position.y }, {
      content: imagePrompt,
      label: '图片提示词'
    })
    addLog('info', `创建图片提示词节点: ${textNodeId}`)
    x += nodeSpacing
    
    // Step 2: Create imageConfig with autoExecute | 创建图片配置节点并自动执行
    currentStep.value = 2
    const imageConfigId = addNode('imageConfig', { x, y: position.y }, {
      label: '文生图',
      autoExecute: true
    })
    addLog('info', `创建图片配置节点: ${imageConfigId}`)
    
    // Connect text → imageConfig
    addEdge({
      source: textNodeId,
      target: imageConfigId,
      sourceHandle: 'right',
      targetHandle: 'left'
    })
    
    addLog('success', '文生图工作流已启动')
    return { textNodeId, imageConfigId }
  }
  
  /**
   * Execute text-to-image-to-video workflow | 执行文生图生视频工作流
   * imageText → imageConfig → image
   * videoText → videoConfig → video
   *              image → videoConfig
   */
  const executeTextToImageToVideo = async (imagePrompt, videoPrompt, position) => {
    const nodeSpacing = 400
    const rowSpacing = 200
    let x = position.x
    
    addLog('info', '开始执行文生图生视频工作流')
    currentStep.value = 1
    totalSteps.value = 5
    
    // Step 1: Create image prompt text node | 创建图片提示词节点
    const imageTextNodeId = addNode('text', { x, y: position.y }, {
      content: imagePrompt,
      label: '图片提示词'
    })
    addLog('info', `创建图片提示词节点: ${imageTextNodeId}`)
    
    // Step 2: Create video prompt text node (below image prompt) | 创建视频提示词节点
    currentStep.value = 2
    const videoTextNodeId = addNode('text', { x, y: position.y + rowSpacing }, {
      content: videoPrompt,
      label: '视频提示词'
    })
    addLog('info', `创建视频提示词节点: ${videoTextNodeId}`)
    x += nodeSpacing
    
    // Step 3: Create imageConfig with autoExecute | 创建图片配置节点
    currentStep.value = 3
    const imageConfigId = addNode('imageConfig', { x, y: position.y }, {
      label: '文生图',
      autoExecute: true
    })
    addLog('info', `创建图片配置节点: ${imageConfigId}`)
    
    // Connect imageText → imageConfig
    addEdge({
      source: imageTextNodeId,
      target: imageConfigId,
      sourceHandle: 'right',
      targetHandle: 'left'
    })
    
    // Step 3: Wait for imageConfig to complete and get image node ID
    // 等待图片配置完成并获取图片节点 ID
    currentStep.value = 3
    addLog('info', '等待图片生成完成...')
    
    try {
      const imageNodeId = await waitForConfigComplete(imageConfigId)
      
      // Wait for image to be ready | 等待图片准备好
      await waitForOutputReady(imageNodeId)
      
      // Get image node position | 获取图片节点位置
      const imageNode = nodes.value.find(n => n.id === imageNodeId)
      x = (imageNode?.position?.x || x) + nodeSpacing
      
      // Step 4: Create videoConfig connected to videoText and image nodes
      // 创建视频配置节点，连接视频提示词和图片节点
      currentStep.value = 4
      const videoConfigId = addNode('videoConfig', { x, y: position.y + rowSpacing }, {
        label: '图生视频',
        autoExecute: true
      })
      addLog('info', `创建视频配置节点: ${videoConfigId}`)
      
      // Connect videoText → videoConfig (for video prompt)
      addEdge({
        source: videoTextNodeId,
        target: videoConfigId,
        sourceHandle: 'right',
        targetHandle: 'left'
      })
      
      // Connect image → videoConfig (for image input)
      addEdge({
        source: imageNodeId,
        target: videoConfigId,
        sourceHandle: 'right',
        targetHandle: 'left'
      })
      
      addLog('success', '文生图生视频工作流已启动')
      return { imageTextNodeId, videoTextNodeId, imageConfigId, imageNodeId, videoConfigId }
    } catch (err) {
      addLog('error', `工作流执行失败: ${err.message}`)
      throw err
    }
  }
  
  /**
   * Main execute function based on workflow type
   * 根据工作流类型执行
   * @param {string} workflowType - 工作流类型
   * @param {string} imagePrompt - 图片提示词
   * @param {string} videoPrompt - 视频提示词（可选）
   * @param {object} position - 起始位置
   */
  const executeWorkflow = async (workflowType, imagePrompt, videoPrompt, position) => {
    isExecuting.value = true
    clearWatchers()
    executionLog.value = []
    
    try {
      switch (workflowType) {
        case WORKFLOW_TYPES.TEXT_TO_IMAGE_TO_VIDEO:
          return await executeTextToImageToVideo(imagePrompt, videoPrompt, position)
        case WORKFLOW_TYPES.TEXT_TO_IMAGE:
        default:
          return await executeTextToImage(imagePrompt, position)
      }
    } finally {
      isExecuting.value = false
      clearWatchers()
    }
  }
  
  /**
   * Convenience method for simple text-to-image | 简便方法
   */
  const createTextToImageWorkflow = (imagePrompt, position) => {
    return executeWorkflow(WORKFLOW_TYPES.TEXT_TO_IMAGE, imagePrompt, null, position)
  }
  
  /**
   * Reset state | 重置状态
   */
  const reset = () => {
    isAnalyzing.value = false
    isExecuting.value = false
    currentStep.value = 0
    totalSteps.value = 0
    executionLog.value = []
    clearWatchers()
  }
  
  return {
    // State
    isAnalyzing,
    isExecuting,
    currentStep,
    totalSteps,
    executionLog,
    
    // Methods
    analyzeIntent,
    executeWorkflow,
    createTextToImageWorkflow,
    reset,
    
    // Constants
    WORKFLOW_TYPES
  }
}

export default useWorkflowOrchestrator
