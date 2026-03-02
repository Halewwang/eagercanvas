<template>
  <!-- Image config node wrapper for hover area | Text to Image配置节点包裹层，扩展悬浮区域 -->
  <div class="image-config-node-wrapper" @mouseenter="showActions = true" @mouseleave="showActions = false">
    <!-- Image config node | Text to Image配置节点 -->
    <div
      class="image-config-node bg-[#0f0f0f] rounded-2xl border min-w-[300px] transition-all duration-200"
      :class="data.selected ? 'border-[#8f8f8f]' : 'border-transparent'">
      <!-- Header | 头部 -->
      <div class="flex items-center justify-between px-3 py-2 border-b border-[rgba(143,143,143,0.28)]">
        <span class="text-sm font-medium text-[#d7dbe3]">{{ data.label }}</span>
        <div class="flex items-center gap-1">
          <button @click="handleDelete" class="p-1 hover:bg-[rgba(255,255,255,0.04)] rounded transition-colors">
            <n-icon :size="14">
              <TrashOutline />
            </n-icon>
          </button>
          <n-dropdown :options="modelOptions" @select="handleModelSelect">
            <button class="p-1 hover:bg-[rgba(255,255,255,0.04)] rounded transition-colors">
              <n-icon :size="14">
                <ChevronDownOutline />
              </n-icon>
            </button>
          </n-dropdown>
        </div>
      </div>

      <!-- Config options | 配置选项 -->
      <div class="p-3 space-y-3">
        <!-- Model selector | Model选择 -->
        <div class="flex items-center justify-between">
          <span class="text-xs text-[#8f939e]">Model</span>
          <n-dropdown :options="modelOptions" @select="handleModelSelect">
            <button class="flex items-center gap-1 text-sm text-[#eceff2] hover:text-[#f2f3f5]">
              {{ displayModelName }}
              <n-icon :size="12"><ChevronDownOutline /></n-icon>
            </button>
          </n-dropdown>
        </div>

        <!-- Quality selector | Quality选择 -->
        <div v-if="hasQualityOptions" class="flex items-center justify-between">
          <span class="text-xs text-[#8f939e]">Quality</span>
          <n-dropdown :options="qualityOptions" @select="handleQualitySelect">
            <button class="flex items-center gap-1 text-sm text-[#eceff2] hover:text-[#f2f3f5]">
              {{ displayQuality }}
              <n-icon :size="12"><ChevronForwardOutline /></n-icon>
            </button>
          </n-dropdown>
        </div>

        <!-- Size selector | Size选择 -->
        <div v-if="hasSizeOptions" class="flex items-center justify-between">
          <span class="text-xs text-[#8f939e]">Size</span>
          <div class="flex items-center gap-2">
            <n-dropdown :options="sizeOptions" @select="handleSizeSelect">
              <button
                class="flex items-center gap-1 text-sm text-[#eceff2] hover:text-[#f2f3f5]">
                {{ displaySize }}
                <n-icon :size="12">
                  <ChevronForwardOutline />
                </n-icon>
              </button>
            </n-dropdown>
          </div>
        </div>

        <!-- Model tips | Model提示 -->
        <div v-if="currentModelConfig?.tips" class="text-xs text-[#8f939e] bg-[#14161a] rounded px-2 py-1">
          💡 {{ currentModelConfig.tips }}
        </div>

        <!-- Connected inputs indicator | 连接输入指示 -->
        <div
          class="flex items-center gap-2 text-xs text-[#8f939e] py-1 border-t border-[rgba(143,143,143,0.28)]">
          <span class="px-3 py-1 rounded-full"
            :class="connectedPrompts.length > 0 ? 'bg-[#2a2a2a] text-[#f2f3f5] border border-[rgba(255,255,255,0.62)]' : 'bg-[#1a1a1a] text-[#818793] border border-[rgba(143,143,143,0.36)]'">
            Prompt {{ connectedPrompts.length > 0 ? `${connectedPrompts.length} items` : '○' }}
          </span>
          <span v-if="currentModelConfig?.supportImageReference" class="px-3 py-1 rounded-full"
            :class="connectedRefImages.length > 0 ? 'bg-[#2a2a2a] text-[#f2f3f5] border border-[rgba(255,255,255,0.62)]' : 'bg-[#1a1a1a] text-[#818793] border border-[rgba(143,143,143,0.36)]'">
            Reference {{ connectedRefImages.length > 0 ? `${connectedRefImages.length} images` : '○' }}
          </span>
        </div>

        <!-- Generate button | 生成按钮 -->
        <div v-if="hasConnectedImageWithContent" class="flex gap-2">
          <!-- Create new (primary) | 新建节点（主按钮） -->
          <button @click="handleGenerate('new')" :disabled="loading || !isConfigured"
            class="flora-button-primary flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
            <n-spin v-if="loading" :size="14" />
            <template v-else>
              <n-icon :size="14"><AddOutline /></n-icon>
              Generate New
            </template>
          </button>
          <!-- Replace existing (secondary) | Replace现有（次按钮） -->
          <button @click="handleGenerate('replace')" :disabled="loading || !isConfigured"
            class="flex-shrink-0 flex items-center justify-center gap-1 py-2 px-2.5 rounded-lg border border-[rgba(143,143,143,0.32)] text-[#8f939e] hover:border-[rgba(226,229,235,0.72)] hover:text-[#f2f3f5] text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
            <n-spin v-if="loading" :size="14" />
            <template v-else>
              <n-icon :size="14"><RefreshOutline /></n-icon>
              Replace
            </template>
          </button>
        </div>
        <button v-else @click="handleGenerate('auto')" :disabled="loading || !isConfigured"
          class="flora-button-primary w-full flex items-center justify-center gap-2 py-2 px-4 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
          <n-spin v-if="loading" :size="14" />
          <template v-else>
            <span class="text-[#090b0d] bg-white/70 rounded-full w-4 h-4 flex items-center justify-center text-xs">◆</span>
            Generate Now
          </template>
        </button>

        <!-- Error message | 错误信息 -->
        <div v-if="error" class="text-xs text-red-500 mt-2">
          {{ error.message || 'Generation failed' }}
        </div>

        <!-- Generated images preview | 生成图片Preview -->
        <!-- <div v-if="generatedImages.length > 0" class="mt-3 space-y-2">
        <div class="text-xs text-[var(--text-secondary)]">Result:</div>
        <div class="grid grid-cols-2 gap-2 max-w-[240px]">
          <div 
            v-for="(img, idx) in generatedImages" 
            :key="idx"
            class="aspect-square rounded-lg overflow-hidden bg-[var(--bg-tertiary)] max-w-[110px]"
          >
            <img :src="img.url" class="w-full h-full object-cover" />
          </div>
        </div>
      </div> -->
      </div>

      <!-- Handles | 连接点 -->
      <Handle type="target" :position="Position.Left" id="left" class="!bg-[#d6d8de] !border-2 !border-[#0f0f0f]" />
      <Handle type="source" :position="Position.Right" id="right" class="!bg-[#d6d8de] !border-2 !border-[#0f0f0f]" />
    </div>

    <!-- Hover action buttons | 悬浮操作按钮 -->
    <!-- Top right - Copy button | 右上角 - Copy按钮 -->
    <div v-show="showActions" class="absolute -top-5 right-0 z-[1000]">
      <button @click="handleDuplicate"
        class="action-btn group p-2 rounded-lg transition-all border border-[rgba(143,143,143,0.32)] flex items-center gap-0 hover:gap-1.5">
        <n-icon :size="16" class="text-[#c9ccd2]">
          <CopyOutline />
        </n-icon>
        <span
          class="text-xs text-[#c9ccd2] max-w-0 overflow-hidden group-hover:max-w-[60px] transition-all duration-200 whitespace-nowrap">Copy</span>
      </button>
    </div>
  </div>
</template>

<script setup>
/**
 * Image config node component | Text to Image配置节点组件
 * Configuration panel for text-to-image generation with API integration
 */
import { ref, computed, watch, onMounted } from 'vue'
import { Handle, Position, useVueFlow } from '@vue-flow/core'
import { NIcon, NDropdown, NSpin } from 'naive-ui'
import { ChevronDownOutline, ChevronForwardOutline, CopyOutline, TrashOutline, RefreshOutline, AddOutline } from '../../icons/coolicons'
import { useImageGeneration, useApiConfig } from '../../hooks'
import { updateNode, addNode, addEdge, nodes, edges, duplicateNode, removeNode, saveProject } from '../../stores/canvas'
import { imageModelOptions, getModelSizeOptions, getModelQualityOptions, getModelConfig, DEFAULT_IMAGE_MODEL } from '../../stores/models'

const props = defineProps({
  id: String,
  data: Object
})

// Vue Flow instance | Vue Flow 实例
const { updateNodeInternals } = useVueFlow()

// API config hook | API 配置 hook
const { isConfigured } = useApiConfig()

// Image generation hook | Image Gen hook
const { loading, error, images: generatedImages, generate } = useImageGeneration()

// Hover state | 悬浮状态
const showActions = ref(false)

// Local state | 本地状态
const localModel = ref(props.data?.model || DEFAULT_IMAGE_MODEL)
const localSize = ref(props.data?.size || '2048x2048')
const localQuality = ref(props.data?.quality || 'standard')

// Get current model config | 获取当前Model配置
const currentModelConfig = computed(() => getModelConfig(localModel.value))

// Model options from store | 从 store 获取Model选项
const modelOptions = imageModelOptions

// Display model name | 显示Model名称
const displayModelName = computed(() => {
  const model = modelOptions.value.find(m => m.key === localModel.value)
  return model?.label || localModel.value || 'Select model'
})

// Quality options based on model | 基于Model的Quality选项
const qualityOptions = computed(() => {
  return getModelQualityOptions(localModel.value)
})

// Check if model has quality options | 检查Model是否有Quality选项
const hasQualityOptions = computed(() => {
  return qualityOptions.value && qualityOptions.value.length > 0
})

// Display quality | 显示Quality
const displayQuality = computed(() => {
  const option = qualityOptions.value.find(o => o.key === localQuality.value)
  return option?.label || 'Standard'
})

// Size options based on model and quality | 基于Model和Quality的Size选项
const sizeOptions = computed(() => {
  return getModelSizeOptions(localModel.value, localQuality.value)
})

// Check if model has size options | 检查Model是否有Size选项
const hasSizeOptions = computed(() => {
  const config = getModelConfig(localModel.value)
  return config?.sizes && config.sizes.length > 0
})

// Display size with label | 显示Size（带标签）
const displaySize = computed(() => {
  const option = sizeOptions.value.find(o => o.key === localSize.value)
  return option?.label || localSize.value
})

// Initialize on mount | 挂载时初始化
onMounted(() => {
  // Set default model if not set | 如果未设置则设置默认Model
  if (!localModel.value) {
    localModel.value = DEFAULT_IMAGE_MODEL
    updateNode(props.id, { model: localModel.value })
  }
})

// Get connected nodes | 获取连接的节点
const getConnectedInputs = () => {
  const connectedEdges = edges.value.filter(e => e.target === props.id)
  const prompts = [] // Array of { order, content } | Prompt数组
  const refImages = [] // Array of { order, imageData, nodeId } | Reference数组

  for (const edge of connectedEdges) {
    const sourceNode = nodes.value.find(n => n.id === edge.source)
    if (!sourceNode) continue

    if (sourceNode.type === 'text') {
      const content = sourceNode.data?.content || ''
      if (content) {
        // Get order from edge data, default to 1 | 从边数据获取顺序，默认为1
        const order = edge.data?.promptOrder || 1
        prompts.push({ order, content, nodeId: sourceNode.id })
      }
    } else if (sourceNode.type === 'image') {
      // Prefer base64, fallback to url | 优先使用 base64，回退到 url
      const imageData = sourceNode.data?.base64 || sourceNode.data?.url
      if (imageData) {
        // Get order from edge data, default to 1 | 从边数据获取顺序，默认为1
        const order = edge.data?.imageOrder || 1
        refImages.push({ order, imageData, nodeId: sourceNode.id })
      }
    }
  }

  // Sort prompts by order and concatenate | 按顺序排序并拼接
  prompts.sort((a, b) => a.order - b.order)
  const combinedPrompt = prompts.map(p => p.content).join('\n\n')

  // Sort refImages by order | 按顺序排序Reference
  refImages.sort((a, b) => a.order - b.order)
  const sortedRefImages = refImages.map(r => r.imageData)

  return { prompt: combinedPrompt, prompts, refImages: sortedRefImages, refImagesWithOrder: refImages }
}

// Computed connected prompts (sorted by order) | 计算连接的Prompt（按顺序排列）
const connectedPrompts = computed(() => {
  return getConnectedInputs().prompts
})

// Computed connected reference images | 计算连接的Reference
const connectedRefImages = computed(() => {
  return getConnectedInputs().refImages
})

// Handle model selection | 处理Model选择
const handleModelSelect = (key) => {
  localModel.value = key
  const config = getModelConfig(key)
  const updates = { model: key }
  if (config?.defaultParams?.size) {
    localSize.value = config.defaultParams.size
    updates.size = config.defaultParams.size
  }
  if (config?.defaultParams?.quality) {
    localQuality.value = config.defaultParams.quality
    updates.quality = config.defaultParams.quality
  }
  updateNode(props.id, updates)
}

// Handle quality selection | 处理Quality选择
const handleQualitySelect = (quality) => {
  localQuality.value = quality
  // Update size to first option of new quality | 更新Size为新Quality的第一 items选项
  const newSizeOptions = getModelSizeOptions(localModel.value, quality)
  if (newSizeOptions.length > 0) {
    const defaultSize = quality === '4k' ? newSizeOptions.find(o => o.key.includes('4096'))?.key || newSizeOptions[4]?.key : newSizeOptions[4]?.key
    localSize.value = defaultSize || newSizeOptions[0].key
    updateNode(props.id, { quality, size: localSize.value })
  } else {
    updateNode(props.id, { quality })
  }
}

// Handle size selection | 处理Size选择
const handleSizeSelect = (size) => {
  localSize.value = size
  updateNode(props.id, { size })
}

// Update size from manual input | 更新手动输入的Size
const updateSize = () => {
  updateNode(props.id, { size: localSize.value })
}

// Created image node ID | 创建的图片节点 ID
const createdImageNodeId = ref(null)

// Find connected output image node | 查找已连接的输出图片节点
const findConnectedOutputImageNode = (onlyEmpty = true) => {
  // Find edges where this node is the source | 查找以当前节点为源的边
  const outputEdges = edges.value.filter(e => e.source === props.id)
  
  for (const edge of outputEdges) {
    const targetNode = nodes.value.find(n => n.id === edge.target)
    if (targetNode?.type === 'image') {
      if (onlyEmpty) {
        // Check if target is an image node with empty or no url | 检查目标是否为空白图片节点
        if (!targetNode.data?.url || targetNode.data?.url === '') {
          return targetNode.id
        }
      } else {
        // Return any connected image node | 返回任意连接的图片节点
        return targetNode.id
      }
    }
  }
  return null
}

// Check if there's a connected image node with content | 检查是否有已连接且有内容的图片节点
const hasConnectedImageWithContent = computed(() => {
  const outputEdges = edges.value.filter(e => e.source === props.id)
  
  for (const edge of outputEdges) {
    const targetNode = nodes.value.find(n => n.id === edge.target)
    if (targetNode?.type === 'image' && targetNode.data?.url && targetNode.data.url !== '') {
      return true
    }
  }
  return false
})

// Handle generate action | 处理生成操作
// mode: 'auto' = 自动判断, 'replace' = Replace现有, 'new' = 新建节点
const handleGenerate = async (mode = 'auto') => {
  const { prompt, prompts, refImages, refImagesWithOrder } = getConnectedInputs()

  if (!prompt && refImages.length === 0) {
    window.$message?.warning('Connect a text prompt or reference image first')
    return
  }
  
  // Log prompt order for debugging | 记录Prompt顺序用于调试
  if (prompts.length > 1) {
    console.log('[ImageConfigNode] 拼接Prompt顺序:', prompts.map(p => `${p.order}: ${p.content.substring(0, 20)}...`))
  }
  
  // Log image order for debugging | 记录图片顺序用于调试
  if (refImagesWithOrder && refImagesWithOrder.length > 1) {
    console.log('[ImageConfigNode] Reference顺序:', refImagesWithOrder.map(r => `${r.order}: ${r.nodeId}`))
  }

  if (!isConfigured.value) {
    window.$message?.warning('Please sign in first')
    return
  }

  updateNode(props.id, {
    status: 'running',
    executed: false,
    outputNodeId: null,
    error: ''
  })

  let imageNodeId = null
  
  if (mode === 'replace') {
    // Replace mode: find any connected image node | Replace模式：查找任意连接的图片节点
    imageNodeId = findConnectedOutputImageNode(false)
    if (imageNodeId) {
      updateNode(imageNodeId, { loading: true, url: '' })
    }
  } else if (mode === 'new') {
    // New mode: always create new node | 新建模式：始终创建新节点
    imageNodeId = null
  } else {
    // Auto mode: check for empty connected node first | 自动模式：先检查空白连接节点
    imageNodeId = findConnectedOutputImageNode(true)
    if (imageNodeId) {
      updateNode(imageNodeId, { loading: true })
    }
  }
  
  if (!imageNodeId) {
    // Get current node position | 获取当前节点位置
    const currentNode = nodes.value.find(n => n.id === props.id)
    const nodeX = currentNode?.position?.x || 0
    const nodeY = currentNode?.position?.y || 0
    
    // Calculate Y offset if creating new node alongside existing | 如果是新建节点，计算Y偏移
    let yOffset = 0
    if (mode === 'new') {
      const outputEdges = edges.value.filter(e => e.source === props.id)
      yOffset = outputEdges.length * 280 // Stack below existing outputs | 在现有输出下方堆叠
    }

    // Create image node with loading state | 创建带加载状态的图片节点
    imageNodeId = addNode('image', { x: nodeX + 400, y: nodeY + yOffset }, {
      url: '',
      loading: true,
      label: 'Image Result'
    })

    // Auto-connect imageConfig → image | 自动连接 生图配置 → 图片
    addEdge({
      source: props.id,
      target: imageNodeId,
      sourceHandle: 'right',
      targetHandle: 'left'
    })
  }
  
  createdImageNodeId.value = imageNodeId

  // Force Vue Flow to recalculate node dimensions | 强制 Vue Flow 重新计算节点Size
  setTimeout(() => {
    updateNodeInternals(imageNodeId)
  }, 50)

  try {
    // Build request params | 构建请求参数
    const params = {
      model: localModel.value,
      prompt: prompt,
      n: 1
    }

    if (hasSizeOptions.value && localSize.value) {
      params.size = localSize.value
    }
    if (hasQualityOptions.value && localQuality.value) {
      params.quality = localQuality.value
    }

    // Add reference image if provided | 如果有Reference则添加
    if (refImages.length > 0) {
      params.image = refImages
    }

    const result = await generate(params)

    // Update image node with generated URL | 更新图片节点 URL
    if (result && result.length > 0) {
      updateNode(imageNodeId, {
        url: result[0].url,
        loading: false,
        label: 'Text to Image',
        model: localModel.value,
        updatedAt: Date.now()
      })
      
      // Mark this config node as executed | 标记配置节点已执行
      updateNode(props.id, { status: 'completed', executed: true, outputNodeId: imageNodeId, error: '' })
      await saveProject()
    }
    window.$message?.success('Image generated')
  } catch (err) {
    updateNode(props.id, { status: 'failed', error: err.message || 'Generation failed' })
    // Update node to show error | 更新节点显示错误
    updateNode(imageNodeId, {
      loading: false,
      error: err.message || 'Generation failed',
      updatedAt: Date.now()
    })
    window.$message?.error(err.message || 'Image generation failed')
  }
}

// Handle duplicate | 处理Copy
const handleDuplicate = () => {
  const newNodeId = duplicateNode(props.id)
  window.$message?.success('Node duplicated')
  if (newNodeId) {
    setTimeout(() => {
      updateNodeInternals(newNodeId)
    }, 50)
  }
}

// Handle delete | 处理删除
const handleDelete = () => {
  removeNode(props.id)
  window.$message?.success('Node deleted')
}

// Watch for auto-execute flag | 监听自动执行标志
watch(
  () => props.data?.autoExecute,
  (shouldExecute) => {
    if (shouldExecute && !loading.value) {
      // Clear the flag first to prevent re-triggering | 先Clear标志防止重复触发
      updateNode(props.id, { autoExecute: false })
      // Delay to ensure node connections are established | 延迟确保节点连接已建立
      setTimeout(() => {
        handleGenerate()
      }, 100)
    }
  },
  { immediate: true }
)
</script>

<style scoped>
.image-config-node-wrapper {
  position: relative;
  padding-top: 20px;
}

.image-config-node {
  cursor: default;
  position: relative;
}
</style>
