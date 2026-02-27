/**
 * Workflow Executor Hook | 工作流执行器 Hook
 * Orchestrates high-level workflow execution from user input
 */
import { ref } from 'vue'
import { nodes } from '../stores/canvas'
import { useWorkflowOrchestrator } from './useWorkflowOrchestrator'
import { notifier } from '../utils/notifier'

export const useWorkflowExecutor = () => {
  const orchestrator = useWorkflowOrchestrator()
  const { analyzeIntent, executeWorkflow, createTextToImageWorkflow, WORKFLOW_TYPES } = orchestrator
  
  // State for execution processing
  const isProcessing = ref(false)
  
  /**
   * Calculate next available position
   * 计算下一个可用位置
   */
  const getNextPosition = () => {
    let maxY = 0
    if (nodes.value.length > 0) {
      maxY = Math.max(...nodes.value.map(n => n.position.y))
    }
    return { x: 100, y: maxY + 200 }
  }

  /**
   * Execute workflow from user input
   * 从用户输入执行工作流
   * @param {string} content - User input content
   * @param {object} options - Execution options (autoExecute, etc.)
   * @param {object} nodesFactory - Nodes factory instance for manual mode
   */
  const executeFromInput = async (content, { autoExecute = true, nodesFactory }) => {
    if (!content) return
    
    isProcessing.value = true
    const position = getNextPosition()
    
    try {
      if (autoExecute) {
        // Auto-execute mode: analyze intent and execute workflow | 自动执行模式：分析意图并执行工作流
        notifier.info('Analyzing workflow...')
        
        try {
          // Analyze user intent | 分析用户意图
          const result = await analyzeIntent(content)
          
          // Ensure we have valid workflow params | 确保有效的工作流参数
          const workflowParams = {
            workflow_type: result?.workflow_type || WORKFLOW_TYPES.TEXT_TO_IMAGE,
            image_prompt: result?.image_prompt || content,
            video_prompt: result?.video_prompt || content,
            character: result?.character,
            shots: result?.shots,
            multi_angle: result?.multi_angle
          }
          
          notifier.info(`Running workflow: ${result?.description || 'Text to Image'}`)
          
          // Execute the workflow | 执行工作流
          await executeWorkflow(workflowParams, position)
          
          notifier.success('Workflow started')
        } catch (err) {
          console.error('Workflow error:', err)
          // Fallback to simple text-to-image | 回退到文生图
          notifier.warning('Falling back to default text-to-image workflow')
          await createTextToImageWorkflow(content, position)
        }
      } else {
        // Manual mode: just create nodes | 手动模式：仅创建节点
        if (nodesFactory) {
          await nodesFactory.createPromptChain(content, position)
        } else {
          console.warn('Nodes factory not provided for manual mode')
        }
      }
    } catch (err) {
      notifier.error(err.message || 'Creation failed')
    } finally {
      isProcessing.value = false
    }
  }
  
  return {
    ...orchestrator,
    isProcessing,
    executeFromInput
  }
}

export default useWorkflowExecutor
