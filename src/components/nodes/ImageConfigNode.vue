<template>
  <!-- Image config node wrapper for hover area | 文生图配置节点包裹层，扩展悬浮区域 -->
  <div class="image-config-node-wrapper" @mouseenter="showActions = true" @mouseleave="showActions = false">
    <!-- Image config node | 文生图配置节点 -->
    <div
      class="image-config-node bg-[var(--bg-secondary)] rounded-xl border min-w-[300px] transition-all duration-200"
      :class="data.selected ? 'border-1 border-blue-500 shadow-lg shadow-blue-500/20' : 'border border-[var(--border-color)]'">
      <!-- Header | 头部 -->
      <div class="flex items-center justify-between px-3 py-2 border-b border-[var(--border-color)]">
        <span class="text-sm font-medium text-[var(--text-secondary)]">{{ data.label }}</span>
        <div class="flex items-center gap-1">
          <button @click="handleDelete" class="p-1 hover:bg-[var(--bg-tertiary)] rounded transition-colors">
            <n-icon :size="14">
              <TrashOutline />
            </n-icon>
          </button>
          <n-dropdown :options="modelOptions" @select="handleModelSelect">
            <button class="p-1 hover:bg-[var(--bg-tertiary)] rounded transition-colors">
              <n-icon :size="14">
                <ChevronDownOutline />
              </n-icon>
            </button>
          </n-dropdown>
        </div>
      </div>

      <!-- Config options | 配置选项 -->
      <div class="p-3 space-y-3">
        <!-- Model selector | 模型选择 -->
        <div class="flex items-center justify-between">
          <span class="text-xs text-[var(--text-secondary)]">模型</span>
          <n-dropdown :options="modelOptions" @select="handleModelSelect">
            <button class="flex items-center gap-1 text-sm text-[var(--text-primary)] hover:text-[var(--accent-color)]">
              {{ displayModelName }}
              <n-icon :size="12"><ChevronDownOutline /></n-icon>
            </button>
          </n-dropdown>
        </div>

        <!-- Size selector | 尺寸选择 -->
        <div v-if="hasSizeOptions" class="flex items-center justify-between">
          <span class="text-xs text-[var(--text-secondary)]">尺寸</span>
          <div class="flex items-center gap-2">
            <n-dropdown :options="sizeOptions" @select="handleSizeSelect">
              <button
                class="flex items-center gap-1 text-sm text-[var(--text-primary)] hover:text-[var(--accent-color)]">
                {{ displaySize }}
                <n-icon :size="12">
                  <ChevronForwardOutline />
                </n-icon>
              </button>
            </n-dropdown>
            <!-- <input v-model="localSize" @blur="updateSize" @mousedown.stop placeholder="自定义尺寸"
              class="w-24 px-2 py-1 text-xs bg-[var(--bg-tertiary)] border border-[var(--border-color)] rounded outline-none focus:border-[var(--accent-color)] text-[var(--text-primary)]" /> -->
          </div>
        </div>

        <!-- Model tips | 模型提示 -->
        <div v-if="currentModelConfig?.tips" class="text-xs text-[var(--text-tertiary)] bg-[var(--bg-tertiary)] rounded px-2 py-1">
          💡 {{ currentModelConfig.tips }}
        </div>

        <!-- Connected inputs indicator | 连接输入指示 -->
        <div
          class="flex items-center gap-2 text-xs text-[var(--text-secondary)] py-1 border-t border-[var(--border-color)]">
          <span class="px-2 py-0.5 rounded-full"
            :class="connectedPrompt ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-gray-100 text-gray-500 dark:bg-gray-800'">
            提示词 {{ connectedPrompt ? '✓' : '○' }}
          </span>
          <span class="px-2 py-0.5 rounded-full"
            :class="connectedRefImages.length > 0 ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' : 'bg-gray-100 text-gray-500 dark:bg-gray-800'">
            参考图 {{ connectedRefImages.length > 0 ? `${connectedRefImages.length}张` : '○' }}
          </span>
        </div>

        <!-- Generate button | 生成按钮 -->
        <button @click="handleGenerate" :disabled="loading || !isConfigured"
          class="w-full flex items-center justify-center gap-2 py-2 px-4 rounded-lg bg-[var(--accent-color)] hover:bg-[var(--accent-hover)] text-white text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
          <n-spin v-if="loading" :size="14" />
          <template v-else>
            <span
              class="text-[var(--accent-color)] bg-white rounded-full w-4 h-4 flex items-center justify-center text-xs">◆</span>
            立即生成
          </template>
        </button>

        <!-- Error message | 错误信息 -->
        <div v-if="error" class="text-xs text-red-500 mt-2">
          {{ error.message || '生成失败' }}
        </div>

        <!-- Generated images preview | 生成图片预览 -->
        <!-- <div v-if="generatedImages.length > 0" class="mt-3 space-y-2">
        <div class="text-xs text-[var(--text-secondary)]">生成结果:</div>
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
      <Handle type="target" :position="Position.Left" id="left" class="!bg-[var(--accent-color)]" />
      <Handle type="source" :position="Position.Right" id="right" class="!bg-[var(--accent-color)]" />
    </div>

    <!-- Hover action buttons | 悬浮操作按钮 -->
    <!-- Top right - Copy button | 右上角 - 复制按钮 -->
    <div v-show="showActions" class="absolute -top-5 right-0 z-[1000]">
      <button @click="handleDuplicate"
        class="action-btn group p-2 bg-white rounded-lg transition-all border border-gray-200 flex items-center gap-0 hover:gap-1.5">
        <n-icon :size="16" class="text-gray-600">
          <CopyOutline />
        </n-icon>
        <span
          class="text-xs text-gray-600 max-w-0 overflow-hidden group-hover:max-w-[60px] transition-all duration-200 whitespace-nowrap">复制</span>
      </button>
    </div>
  </div>
</template>

<script setup>
/**
 * Image config node component | 文生图配置节点组件
 * Configuration panel for text-to-image generation with API integration
 */
import { ref, computed, watch, onMounted } from 'vue'
import { Handle, Position, useVueFlow } from '@vue-flow/core'
import { NIcon, NDropdown, NSpin } from 'naive-ui'
import { ChevronDownOutline, ChevronForwardOutline, CopyOutline, TrashOutline } from '@vicons/ionicons5'
import { useImageGeneration, useApiConfig } from '../../hooks'
import { updateNode, addNode, addEdge, nodes, edges, duplicateNode, removeNode } from '../../stores/canvas'
import { imageModelOptions, getModelSizeOptions, getModelConfig, DEFAULT_IMAGE_MODEL } from '../../stores/models'

const props = defineProps({
  id: String,
  data: Object
})

// Vue Flow instance | Vue Flow 实例
const { updateNodeInternals } = useVueFlow()

// API config hook | API 配置 hook
const { isConfigured } = useApiConfig()

// Image generation hook | 图片生成 hook
const { loading, error, images: generatedImages, generate } = useImageGeneration()

// Hover state | 悬浮状态
const showActions = ref(false)

// Local state | 本地状态
const localModel = ref(props.data?.model || DEFAULT_IMAGE_MODEL)
const localSize = ref(props.data?.size || '1024x1024')

// Get current model config | 获取当前模型配置
const currentModelConfig = computed(() => getModelConfig(localModel.value))

// Model options from store | 从 store 获取模型选项
const modelOptions = imageModelOptions

// Display model name | 显示模型名称
const displayModelName = computed(() => {
  const model = modelOptions.value.find(m => m.key === localModel.value)
  return model?.label || localModel.value || '选择模型'
})

// Size options based on model | 基于模型的尺寸选项
const sizeOptions = computed(() => {
  return getModelSizeOptions(localModel.value)
})

// Check if model has size options | 检查模型是否有尺寸选项
const hasSizeOptions = computed(() => {
  const config = getModelConfig(localModel.value)
  return config?.sizes && config.sizes.length > 0
})

// Display size with label | 显示尺寸（带标签）
const displaySize = computed(() => {
  const option = sizeOptions.value.find(o => o.key === localSize.value)
  return option?.label || localSize.value
})

// Initialize on mount | 挂载时初始化
onMounted(() => {
  // Set default model if not set | 如果未设置则设置默认模型
  if (!localModel.value) {
    localModel.value = DEFAULT_IMAGE_MODEL
    updateNode(props.id, { model: localModel.value })
  }
})

// Get connected nodes | 获取连接的节点
const getConnectedInputs = () => {
  const connectedEdges = edges.value.filter(e => e.target === props.id)
  let prompt = ''
  const refImages = []

  for (const edge of connectedEdges) {
    const sourceNode = nodes.value.find(n => n.id === edge.source)
    if (!sourceNode) continue

    if (sourceNode.type === 'text') {
      prompt = sourceNode.data?.content || ''
    } else if (sourceNode.type === 'image') {
      // Prefer base64, fallback to url | 优先使用 base64，回退到 url
      const imageData = sourceNode.data?.base64 || sourceNode.data?.url
      if (imageData) {
        refImages.push(imageData)
      }
    }
  }

  return { prompt, refImages }
}

// Computed connected prompt | 计算连接的提示词
const connectedPrompt = computed(() => {
  return getConnectedInputs().prompt
})

// Computed connected reference images | 计算连接的参考图
const connectedRefImages = computed(() => {
  return getConnectedInputs().refImages
})

// Handle model selection | 处理模型选择
const handleModelSelect = (key) => {
  localModel.value = key
  // Update size to model's default | 更新为模型默认尺寸
  const config = getModelConfig(key)
  if (config?.defaultParams?.size) {
    localSize.value = config.defaultParams.size
    updateNode(props.id, { model: key, size: config.defaultParams.size })
  } else {
    updateNode(props.id, { model: key })
  }
}

// Handle size selection | 处理尺寸选择
const handleSizeSelect = (size) => {
  localSize.value = size
  updateNode(props.id, { size })
}

// Update size from manual input | 更新手动输入的尺寸
const updateSize = () => {
  updateNode(props.id, { size: localSize.value })
}

// Created image node ID | 创建的图片节点 ID
const createdImageNodeId = ref(null)

// Handle generate action | 处理生成操作
const handleGenerate = async () => {
  const { prompt, refImages } = getConnectedInputs()

  if (!prompt && refImages.length === 0) {
    window.$message?.warning('请连接文本节点（提示词）或图片节点（参考图）')
    return
  }

  if (!isConfigured.value) {
    window.$message?.warning('请先配置 API Key')
    return
  }

  // Get current node position | 获取当前节点位置
  const currentNode = nodes.value.find(n => n.id === props.id)
  const nodeX = currentNode?.position?.x || 0
  const nodeY = currentNode?.position?.y || 0

  // Create image node with loading state | 创建带加载状态的图片节点
  const imageNodeId = addNode('image', { x: nodeX + 400, y: nodeY }, {
    url: '',
    loading: true,
    label: '图像生成结果'
  })
  createdImageNodeId.value = imageNodeId

  // Auto-connect imageConfig → image | 自动连接 生图配置 → 图片
  addEdge({
    source: props.id,
    target: imageNodeId,
    sourceHandle: 'right',
    targetHandle: 'left'
  })

  // Force Vue Flow to recalculate node dimensions | 强制 Vue Flow 重新计算节点尺寸
  setTimeout(() => {
    updateNodeInternals(imageNodeId)
  }, 50)

  try {
    // Build request params | 构建请求参数
    const params = {
      model: localModel.value,
      prompt: prompt,
      size: localSize.value,
      n: 1
    }

    // Add reference image if provided | 如果有参考图则添加
    if (refImages.length > 0) {
      params.image = refImages[0]
    }

    const result = await generate(params)

    // Update image node with generated URL | 更新图片节点 URL
    if (result && result.length > 0) {
      updateNode(imageNodeId, {
        url: result[0].url,
        loading: false,
        label: '文生图',
        model: localModel.value,
        updatedAt: Date.now()
      })
      
      // Mark this config node as executed | 标记配置节点已执行
      updateNode(props.id, { executed: true, outputNodeId: imageNodeId })
    }
    window.$message?.success('图片生成成功')
  } catch (err) {
    // Update node to show error | 更新节点显示错误
    updateNode(imageNodeId, {
      loading: false,
      error: err.message || '生成失败',
      updatedAt: Date.now()
    })
    window.$message?.error(err.message || '图片生成失败')
  }
}

// Handle duplicate | 处理复制
const handleDuplicate = () => {
  const newNodeId = duplicateNode(props.id)
  window.$message?.success('节点已复制')
  if (newNodeId) {
    setTimeout(() => {
      updateNodeInternals(newNodeId)
    }, 50)
  }
}

// Handle delete | 处理删除
const handleDelete = () => {
  removeNode(props.id)
  window.$message?.success('节点已删除')
}

// Watch for auto-execute flag | 监听自动执行标志
watch(
  () => props.data?.autoExecute,
  (shouldExecute) => {
    if (shouldExecute && !loading.value) {
      // Clear the flag first to prevent re-triggering | 先清除标志防止重复触发
      updateNode(props.id, { autoExecute: false })
      // Delay to ensure node connections are established | 延迟确保节点连接已建立
      setTimeout(() => {
        debugger
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
