/**
 * Workflow Orchestrator Hook | 工作流编排 Hook
 * 使用回调串行结构编排节点执行
 * 
 * 依赖关系：
 * - imageConfig 执行后产生 image 节点
 * - videoConfig 依赖 image 节点作为输入
 * - 串行执行：等待上一步完成后再执行下一步
 */

import { ref } from 'vue'
import { streamChatCompletions } from '@/api'
import { 
  nodes, 
  addNode, 
  addEdge, 
  updateNode 
} from '@/stores/canvas'
import { edgeStrategy } from '@/services/edgeStrategy'

// Workflow types | 工作流类型
const WORKFLOW_TYPES = {
  TEXT_TO_IMAGE: 'text_to_image',
  TEXT_TO_IMAGE_TO_VIDEO: 'text_to_image_to_video',
  STORYBOARD: 'storyboard', // 分镜工作流
  MULTI_ANGLE_STORYBOARD: 'multi_angle_storyboard', // 多角度分镜工作流
}

// Multi-angle prompts | 多角度提示词模板
const MULTI_ANGLE_PROMPTS = {
  front: {
    label: '正视',
    english: 'Front View',
    prompt: (character) => `使用提供的图片，生成四宫格分镜，每张四宫格包括人物正面对着镜头的4个景别（远景、中景、近景、和局部特写），保持场景、产品、人物特征的一致性，宫格里的每一张照片保持和提供图片相同的比例。并在图片下方用英文标注这个景别

角色参考: ${character}`
  },
  side: {
    label: '侧视',
    english: 'Side View', 
    prompt: (character) => `使用提供的图片，分别生成四宫格分镜，每张四宫格包括人物侧面角度的4个景别（远景、中景、近景、和局部特写），保持场景、产品、人物特征的一致性，宫格里的每一张照片保持和提供图片相同的比例。并在图片下方用英文标注这个景别

角色参考: ${character}`
  },
  back: {
    label: '后视',
    english: 'Back View',
    prompt: (character) => `使用提供的图片，分别生成四宫格分镜，每张四宫格包括人物背影角度的4个景别（远景、中景、近景、和局部特写），保持场景、产品、人物特征的一致性，宫格里的每一张照片保持和提供图片相同的比例。并在图片下方用英文标注这个景别

角色参考: ${character}`
  },
  top: {
    label: '俯视',
    english: 'Top/Bird\'s Eye View',
    prompt: (character) => `使用提供的图片，分别生成四宫格分镜，每张四宫格包括俯视角度的4个景别（远景、中景、近景、和局部特写），保持场景、产品、人物特征的一致性，宫格里的每一张照片保持和提供图片相同的比例。并在图片下方用英文标注这个景别

角色参考: ${character}`
  }
}

// System prompt for intent analysis | 意图分析系统提示词
const INTENT_ANALYSIS_PROMPT = `你是一个工作流分析助手。根据用户输入判断需要的工作流类型，并生成对应的提示词。

工作流类型：
1. text_to_image - 用户想要生成单张图片（默认）
2. text_to_image_to_video - 用户想要生成图片并转成视频（包含"视频"、"动画"、"动起来"等关键词）
3. storyboard - 用户想要生成分镜/多场景图片（包含"分镜"、"场景一"、"镜头"等关键词，或描述多个连续场景）
4. multi_angle_storyboard - 用户想要生成多角度分镜（包含"多角度"、"正视"、"侧视"、"后视"、"俯视"、"四宫格"、"景别"等关键词）

返回 JSON：
{
  "workflow_type": "text_to_image | text_to_image_to_video | storyboard | multi_angle_storyboard",
  "description": "简短描述",
  
  // text_to_image 和 text_to_image_to_video 使用:
  "image_prompt": "优化后的图片生成提示词",
  "video_prompt": "视频生成提示词（仅 text_to_image_to_video）",
  
  // storyboard 分镜工作流使用:
  "character": {
    "name": "角色名称",
    "description": "角色外观描述，用于生成参考图"
  },
  "shots": [
    {
      "title": "分镜标题",
      "prompt": "该分镜的详细画面描述，包含角色动作、场景、光影等"
    }
  ],
  
  // multi_angle_storyboard 多角度分镜工作流使用:
  "multi_angle": {
    "character_description": "角色的详细外观描述，包括服装、发型、体型、特征等"
  }
}

提示词优化要求：
- image_prompt: 基于用户输入扩展，添加画面细节、艺术风格、光影效果等
- video_prompt: 描述画面如何动起来，如镜头移动、主体动作、氛围变化等
- character.description: 详细描述角色外观特征，便于后续分镜保持一致性
- shots[].prompt: 每个分镜的完整画面描述，需包含角色名以保持一致性
- multi_angle.character_description: 详细描述角色外观，用于生成多角度四宫格分镜

示例1 - 分镜工作流:
输入: "蜡笔小新去上学。分镜一：清晨的战争；分镜二：出发的风姿"
输出:
{
  "workflow_type": "storyboard",
  "description": "蜡笔小新上学分镜",
  "character": {
    "name": "蜡笔小新",
    "description": "5岁男孩，黑色蘑菇头发型，粗眉毛，穿红色T恤和黄色短裤，卡通动漫风格"
  },
  "shots": [
    {"title": "清晨的战争", "prompt": "蜡笔小新在卧室赖床，妈妈美伢在旁边生气催促..."},
    {"title": "出发的风姿", "prompt": "蜡笔小新背着黄色书包，在阳光下昂首阔步走出家门..."}
  ]
}

示例2 - 多角度分镜工作流:
输入: "生成一个穿红裙子的女孩的多角度分镜"
输出:
{
  "workflow_type": "multi_angle_storyboard",
  "description": "红裙女孩多角度分镜",
  "multi_angle": {
    "character_description": "年轻女孩，长发飘逸，穿着优雅的红色连衣裙，白皙皮肤，精致五官，现代时尚风格"
  }
}

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
  const workflowState = ref('idle') // idle | running | completed | failed | cancelled
  const taskQueue = ref([])
  const activeTaskId = ref('')
  let taskCounter = 0

  const TASK_STATES = {
    PENDING: 'pending',
    RUNNING: 'running',
    COMPLETED: 'completed',
    FAILED: 'failed',
    CANCELLED: 'cancelled'
  }
  
  /**
   * Add log entry | 添加日志
   */
  const addLog = (type, message) => {
    executionLog.value.push({ type, message, timestamp: Date.now() })
    if (import.meta.env.DEV) {
      console.debug(`[Workflow ${type}] ${message}`)
    }
  }

  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

  const updateWorkflowState = (state) => {
    workflowState.value = state
  }

  const enqueueTask = (taskName, run, meta = {}) => {
    const task = {
      id: `wf_task_${++taskCounter}`,
      name: taskName,
      state: TASK_STATES.PENDING,
      meta,
      error: '',
      result: null,
      run
    }
    taskQueue.value.push(task)
    return task.id
  }

  const setTaskState = (taskId, nextState, patch = {}) => {
    const idx = taskQueue.value.findIndex((t) => t.id === taskId)
    if (idx === -1) return
    taskQueue.value[idx] = {
      ...taskQueue.value[idx],
      state: nextState,
      ...patch
    }
  }

  const runTaskQueue = async (context = {}) => {
    const queue = taskQueue.value
    totalSteps.value = queue.length
    currentStep.value = 0

    for (let i = 0; i < queue.length; i++) {
      const task = queue[i]
      currentStep.value = i + 1
      activeTaskId.value = task.id
      setTaskState(task.id, TASK_STATES.RUNNING)
      addLog('info', `执行任务 ${i + 1}/${queue.length}: ${task.name}`)

      try {
        const result = await task.run(context)
        setTaskState(task.id, TASK_STATES.COMPLETED, { result })
      } catch (err) {
        const message = err?.message || 'Task execution failed'
        setTaskState(task.id, TASK_STATES.FAILED, { error: message })
        throw err
      } finally {
        activeTaskId.value = ''
      }
    }
  }

  const waitForNode = async (nodeId, matcher, {
    timeoutMs = 5 * 60 * 1000,
    intervalMs = 250,
    timeoutMessage = '等待节点超时'
  } = {}) => {
    const start = Date.now()
    while (Date.now() - start < timeoutMs) {
      const node = nodes.value.find((n) => n.id === nodeId)
      const result = matcher(node)
      if (result?.done) {
        return result.value
      }
      await sleep(intervalMs)
    }
    throw new Error(timeoutMessage)
  }

  /**
   * Wait for config node to complete and return output node ID
   * 等待配置节点完成并返回输出节点 ID
   */
  const waitForConfigComplete = async (configNodeId) => {
    const outputNodeId = await waitForNode(
      configNodeId,
      (node) => {
        if (!node) {
          return { done: false }
        }
        if (node.data?.error) {
          throw new Error(node.data.error)
        }
        if ((node.data?.status === 'completed' || node.data?.executed) && node.data?.outputNodeId) {
          return { done: true, value: node.data.outputNodeId }
        }
        if (node.data?.status === 'failed') {
          throw new Error(node.data?.error || '节点执行失败')
        }
        return { done: false }
      },
      { timeoutMessage: `节点 ${configNodeId} 执行超时` }
    )
    addLog('success', `节点 ${configNodeId} 完成，输出节点: ${outputNodeId}`)
    return outputNodeId
  }

  /**
   * Wait for output node (image/video) to be ready
   * 等待输出节点准备好
   */
  const waitForOutputReady = async (outputNodeId) => {
    const node = await waitForNode(
      outputNodeId,
      (target) => {
        if (!target) return { done: false }
        if (target.data?.error) {
          throw new Error(target.data.error)
        }
        if (target.data?.url && !target.data?.loading) {
          return { done: true, value: target }
        }
        return { done: false }
      },
      { timeoutMessage: `输出节点 ${outputNodeId} 超时` }
    )
    addLog('success', `输出节点 ${outputNodeId} 已就绪`)
    return node
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
    addLog('info', '开始执行文生图工作流')
    const context = { nodes: {} }
    taskQueue.value = []

    enqueueTask('create_image_prompt_node', async (ctx) => {
      ctx.nodes.textNodeId = addNode('text', { x: position.x, y: position.y }, {
        content: imagePrompt,
        label: '图片提示词'
      })
      addLog('info', `创建图片提示词节点: ${ctx.nodes.textNodeId}`)
      return ctx.nodes.textNodeId
    })

    enqueueTask('create_image_config_node', async (ctx) => {
      const x = position.x + nodeSpacing
      ctx.nodes.imageConfigId = addNode('imageConfig', { x, y: position.y }, {
        label: '文生图',
        autoExecute: true
      })
      addLog('info', `创建图片配置节点: ${ctx.nodes.imageConfigId}`)
      addEdge(edgeStrategy.resolve({
        source: ctx.nodes.textNodeId,
        target: ctx.nodes.imageConfigId,
        sourceHandle: 'right',
        targetHandle: 'left'
      }))
      return ctx.nodes.imageConfigId
    })

    await runTaskQueue(context)
    addLog('success', '文生图工作流已启动')
    return {
      textNodeId: context.nodes.textNodeId,
      imageConfigId: context.nodes.imageConfigId
    }
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

    addLog('info', '开始执行文生图生视频工作流')
    const context = { nodes: {} }
    taskQueue.value = []

    enqueueTask('create_image_prompt_node', async (ctx) => {
      ctx.nodes.imageTextNodeId = addNode('text', { x: position.x, y: position.y }, {
        content: imagePrompt,
        label: '图片提示词'
      })
      addLog('info', `创建图片提示词节点: ${ctx.nodes.imageTextNodeId}`)
      return ctx.nodes.imageTextNodeId
    })

    enqueueTask('create_video_prompt_node', async (ctx) => {
      ctx.nodes.videoTextNodeId = addNode('text', { x: position.x, y: position.y + rowSpacing }, {
        content: videoPrompt,
        label: '视频提示词'
      })
      addLog('info', `创建视频提示词节点: ${ctx.nodes.videoTextNodeId}`)
      return ctx.nodes.videoTextNodeId
    })

    enqueueTask('create_image_config_node', async (ctx) => {
      const x = position.x + nodeSpacing
      ctx.nodes.imageConfigId = addNode('imageConfig', { x, y: position.y }, {
        label: '文生图',
        autoExecute: true
      })
      addLog('info', `创建图片配置节点: ${ctx.nodes.imageConfigId}`)
      addEdge(edgeStrategy.resolve({
        source: ctx.nodes.imageTextNodeId,
        target: ctx.nodes.imageConfigId,
        sourceHandle: 'right',
        targetHandle: 'left'
      }))
      return ctx.nodes.imageConfigId
    })

    enqueueTask('wait_image_ready', async (ctx) => {
      addLog('info', '等待图片生成完成...')
      ctx.nodes.imageNodeId = await waitForConfigComplete(ctx.nodes.imageConfigId)
      await waitForOutputReady(ctx.nodes.imageNodeId)
      return ctx.nodes.imageNodeId
    })

    enqueueTask('create_video_config_node', async (ctx) => {
      const imageNode = nodes.value.find((n) => n.id === ctx.nodes.imageNodeId)
      const x = (imageNode?.position?.x || (position.x + nodeSpacing)) + nodeSpacing
      ctx.nodes.videoConfigId = addNode('videoConfig', { x, y: position.y + rowSpacing }, {
        label: '图生视频',
        autoExecute: true
      })
      addLog('info', `创建视频配置节点: ${ctx.nodes.videoConfigId}`)
      addEdge(edgeStrategy.resolve({
        source: ctx.nodes.videoTextNodeId,
        target: ctx.nodes.videoConfigId,
        sourceHandle: 'right',
        targetHandle: 'left'
      }))
      addEdge(edgeStrategy.resolve({
        source: ctx.nodes.imageNodeId,
        target: ctx.nodes.videoConfigId,
        sourceHandle: 'right',
        targetHandle: 'left'
      }))
      return ctx.nodes.videoConfigId
    })

    try {
      await runTaskQueue(context)
      addLog('success', '文生图生视频工作流已启动')
      return {
        imageTextNodeId: context.nodes.imageTextNodeId,
        videoTextNodeId: context.nodes.videoTextNodeId,
        imageConfigId: context.nodes.imageConfigId,
        imageNodeId: context.nodes.imageNodeId,
        videoConfigId: context.nodes.videoConfigId
      }
    } catch (err) {
      addLog('error', `工作流执行失败: ${err.message}`)
      throw err
    }
  }
  
  /**
   * Execute storyboard workflow | 执行分镜工作流
   * 
   * 布局结构:
   * [角色描述] → [imageConfig] → [角色参考图]
   *                                    ↓
   * [分镜1文本] → [imageConfig] → [分镜1图片]
   * [分镜2文本] → [imageConfig] → [分镜2图片]
   * ...
   */
  const executeStoryboard = async (character, shots, position) => {
    const nodeSpacing = 400
    const rowSpacing = 250
    const x = position.x
    const y = position.y

    const shotCount = shots?.length || 0
    addLog('info', `开始执行分镜工作流: ${character?.name || '未知角色'}, ${shotCount} 个分镜`)
    const context = {
      nodes: {
        characterTextId: null,
        characterConfigId: null,
        characterImageId: null,
        shots: []
      }
    }
    taskQueue.value = []

    try {
      enqueueTask('create_character_text_node', async (ctx) => {
        const characterDesc = `${character?.name || '角色'}: ${character?.description || ''}`
        ctx.nodes.characterTextId = addNode('text', { x, y }, {
          content: characterDesc,
          label: `角色: ${character?.name || '参考'}`
        })
        addLog('info', `创建角色描述节点: ${ctx.nodes.characterTextId}`)
        return ctx.nodes.characterTextId
      })

      enqueueTask('create_character_config_node', async (ctx) => {
        ctx.nodes.characterConfigId = addNode('imageConfig', { x: x + nodeSpacing, y }, {
          label: '角色参考图',
          autoExecute: true
        })
        addLog('info', `创建角色配置节点: ${ctx.nodes.characterConfigId}`)
        addEdge({
          source: ctx.nodes.characterTextId,
          target: ctx.nodes.characterConfigId,
          sourceHandle: 'right',
          targetHandle: 'left'
        })
        return ctx.nodes.characterConfigId
      })

      enqueueTask('wait_character_image_ready', async (ctx) => {
        addLog('info', '等待角色参考图生成...')
        ctx.nodes.characterImageId = await waitForConfigComplete(ctx.nodes.characterConfigId)
        await waitForOutputReady(ctx.nodes.characterImageId)
        addLog('success', '角色参考图已生成')
        return ctx.nodes.characterImageId
      })

      for (let i = 0; i < shotCount; i++) {
        const shot = shots[i] || {}
        enqueueTask(`create_shot_${i + 1}_nodes`, async (ctx) => {
          const shotY = y + (i + 1) * rowSpacing
          const shotTextId = addNode('text', { x: position.x, y: shotY }, {
            content: shot.prompt || '',
            label: `分镜${i + 1}: ${shot.title || 'Untitled'}`
          })
          addLog('info', `创建分镜${i + 1}文本节点: ${shotTextId}`)

          const shotConfigId = addNode('imageConfig', { x: position.x + nodeSpacing, y: shotY }, {
            label: `分镜${i + 1}`,
            autoExecute: true
          })
          addLog('info', `创建分镜${i + 1}配置节点: ${shotConfigId}`)

        addEdge(edgeStrategy.resolve({
          source: shotTextId,
          target: shotConfigId,
          sourceHandle: 'right',
          targetHandle: 'left'
        }))
        addEdge(edgeStrategy.resolve({
          source: ctx.nodes.characterImageId,
          target: shotConfigId,
          sourceHandle: 'right',
          targetHandle: 'left'
        }))

          ctx.nodes.shots[i] = {
            textId: shotTextId,
            configId: shotConfigId,
            imageId: null,
            title: shot.title || `分镜${i + 1}`
          }
          return ctx.nodes.shots[i]
        })

        enqueueTask(`wait_shot_${i + 1}_image_ready`, async (ctx) => {
          addLog('info', `等待分镜${i + 1}生成...`)
          const shotInfo = ctx.nodes.shots[i]
          const shotImageId = await waitForConfigComplete(shotInfo.configId)
          await waitForOutputReady(shotImageId)
          shotInfo.imageId = shotImageId
          addLog('success', `分镜${i + 1}已生成`)
          return shotImageId
        })
      }

      await runTaskQueue(context)
      addLog('success', `分镜工作流完成，共生成 ${shotCount} 个分镜`)
      return {
        characterTextId: context.nodes.characterTextId,
        characterConfigId: context.nodes.characterConfigId,
        characterImageId: context.nodes.characterImageId,
        shots: context.nodes.shots
      }
    } catch (err) {
      addLog('error', `分镜工作流执行失败: ${err.message}`)
      throw err
    }
  }
  
  /**
   * Execute multi-angle storyboard workflow | 执行多角度分镜工作流
   * 
   * 布局结构:
   * [主角色图] ──┬──> [正视提示词] → [imageConfig] → [正视四宫格]
   *              ├──> [侧视提示词] → [imageConfig] → [侧视四宫格]
   *              ├──> [后视提示词] → [imageConfig] → [后视四宫格]
   *              └──> [俯视提示词] → [imageConfig] → [俯视四宫格]
   * 
   * @param {object} multiAngle - 多角度参数 { character_description }
   * @param {object} position - 起始位置
   */
  const executeMultiAngleStoryboard = async (multiAngle, position) => {
    const nodeSpacing = 400
    const rowSpacing = 300
    const x = position.x
    const y = position.y
    
    const characterDesc = multiAngle?.character_description || ''
    const angles = ['front', 'side', 'back', 'top']
    
    addLog('info', `开始执行多角度分镜工作流: ${characterDesc.slice(0, 30)}...`)
    currentStep.value = 1
    totalSteps.value = 2 + angles.length * 2 // 角色图 + 每个角度(提示词+生成)
    
    const createdNodes = {
      characterImageId: null,
      angles: []
    }
    
    try {
      // Step 1: Create character image node (user uploads or existing)
      // 创建角色图节点（用户上传或已有）
      const characterImageId = addNode('image', { x, y }, {
        url: '',
        label: '主角色图（请上传）',
        isCharacterRef: true
      })
      createdNodes.characterImageId = characterImageId
      addLog('info', `创建主角色图节点: ${characterImageId}`)
      
      // Step 2: Create 4 angle nodes in parallel layout
      // 创建4个角度的节点（并行布局）
      const angleX = x + nodeSpacing + 100
      
      for (let i = 0; i < angles.length; i++) {
        const angleKey = angles[i]
        const angleConfig = MULTI_ANGLE_PROMPTS[angleKey]
        const angleY = y + i * rowSpacing
        let currentX = angleX
        
        currentStep.value = 2 + i * 2
        
        // Create angle prompt text node | 创建角度提示词节点
        const promptContent = angleConfig.prompt(characterDesc)
        const textNodeId = addNode('text', { x: currentX, y: angleY }, {
          content: promptContent,
          label: `${angleConfig.label}提示词`
        })
        addLog('info', `创建${angleConfig.label}提示词节点: ${textNodeId}`)
        currentX += nodeSpacing
        
        // Create imageConfig node | 创建图片配置节点
        currentStep.value = 3 + i * 2
        const configNodeId = addNode('imageConfig', { x: currentX, y: angleY }, {
          label: `${angleConfig.label} (${angleConfig.english})`,
          autoExecute: false // 不自动执行，等待用户上传角色图
        })
        addLog('info', `创建${angleConfig.label}配置节点: ${configNodeId}`)
        
        // Connect text → imageConfig
        addEdge(edgeStrategy.resolve({
          source: textNodeId,
          target: configNodeId,
          sourceHandle: 'right',
          targetHandle: 'left'
        }))
        
        // Connect character image → imageConfig (as reference)
        addEdge(edgeStrategy.resolve({
          source: characterImageId,
          target: configNodeId,
          sourceHandle: 'right',
          targetHandle: 'left'
        }))
        
        createdNodes.angles.push({
          key: angleKey,
          label: angleConfig.label,
          english: angleConfig.english,
          textId: textNodeId,
          configId: configNodeId,
          imageId: null
        })
      }
      
      addLog('success', `多角度分镜工作流已创建，请上传主角色图后点击各节点的"立即生成"按钮`)
      window.$message?.info('请先上传主角色图，然后点击各角度节点的"立即生成"按钮')
      
      return createdNodes
    } catch (err) {
      addLog('error', `多角度分镜工作流执行失败: ${err.message}`)
      throw err
    }
  }
  
  /**
   * Main execute function based on workflow type
   * 根据工作流类型执行
   * @param {object} params - 工作流参数
   * @param {object} position - 起始位置
   */
  const executeWorkflow = async (params, position) => {
    isExecuting.value = true
    updateWorkflowState('running')
    executionLog.value = []
    taskQueue.value = []
    activeTaskId.value = ''
    taskCounter = 0
    
    const { workflow_type, image_prompt, video_prompt, character, shots, multi_angle } = params
    
    try {
      const result = await (async () => {
        switch (workflow_type) {
        case WORKFLOW_TYPES.MULTI_ANGLE_STORYBOARD:
          return await executeMultiAngleStoryboard(multi_angle, position)
        case WORKFLOW_TYPES.STORYBOARD:
          return await executeStoryboard(character, shots, position)
        case WORKFLOW_TYPES.TEXT_TO_IMAGE_TO_VIDEO:
          return await executeTextToImageToVideo(image_prompt, video_prompt, position)
        case WORKFLOW_TYPES.TEXT_TO_IMAGE:
        default:
          return await executeTextToImage(image_prompt, position)
        }
      })()
      updateWorkflowState('completed')
      return result
    } catch (err) {
      updateWorkflowState('failed')
      throw err
    } finally {
      isExecuting.value = false
      activeTaskId.value = ''
    }
  }

  /**
   * Cancel current queue execution marker
   * (ongoing API requests still rely on node-level hooks to stop themselves)
   */
  const cancel = () => {
    updateWorkflowState('cancelled')
    taskQueue.value = taskQueue.value.map((task) => {
      if (task.state === TASK_STATES.PENDING || task.state === TASK_STATES.RUNNING) {
        return { ...task, state: TASK_STATES.CANCELLED }
      }
      return task
    })
  }
  
  /**
   * Convenience method for simple text-to-image | 简便方法
   */
  const createTextToImageWorkflow = (imagePrompt, position) => {
    return executeWorkflow({ 
      workflow_type: WORKFLOW_TYPES.TEXT_TO_IMAGE, 
      image_prompt: imagePrompt 
    }, position)
  }
  
  /**
   * Convenience method for multi-angle storyboard | 多角度分镜简便方法
   */
  const createMultiAngleStoryboard = (characterDescription, position) => {
    return executeWorkflow({
      workflow_type: WORKFLOW_TYPES.MULTI_ANGLE_STORYBOARD,
      multi_angle: { character_description: characterDescription }
    }, position)
  }
  
  /**
   * Reset state | 重置状态
   */
  const reset = () => {
    isAnalyzing.value = false
    isExecuting.value = false
    currentStep.value = 0
    totalSteps.value = 0
    workflowState.value = 'idle'
    taskQueue.value = []
    activeTaskId.value = ''
    executionLog.value = []
  }
  
  return {
    // State
    isAnalyzing,
    isExecuting,
    currentStep,
    totalSteps,
    executionLog,
    workflowState,
    taskQueue,
    activeTaskId,
    
    // Methods
    analyzeIntent,
    executeWorkflow,
    createTextToImageWorkflow,
    createMultiAngleStoryboard,
    cancel,
    reset,
    
    // Constants
    WORKFLOW_TYPES,
    MULTI_ANGLE_PROMPTS,
    TASK_STATES
  }
}

export default useWorkflowOrchestrator
