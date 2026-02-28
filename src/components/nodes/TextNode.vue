<template>
  <!-- Text node wrapper for hover area | 文本节点包裹层，扩展悬浮区域 -->
  <div class="text-node-wrapper" @mouseenter="showActions = true" @mouseleave="showActions = false">
    <!-- Text node | 文本节点 -->
    <div
      class="text-node bg-[var(--bg-secondary)] rounded-xl border min-w-[280px] max-w-[350px] relative transition-all duration-200"
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
          <button class="p-1 hover:bg-[var(--bg-tertiary)] rounded transition-colors">
            <n-icon :size="14">
              <ExpandOutline />
            </n-icon>
          </button>
        </div>
      </div>

      <!-- Content | 内容 -->
      <div class="p-3">
        <textarea v-model="content" @blur="updateContent" @wheel.stop @mousedown.stop
          class="w-full bg-transparent resize-none outline-none text-sm text-[var(--text-primary)] placeholder:text-[var(--text-secondary)] min-h-[80px]"
          placeholder="Enter text..." />
        <!-- Polish button | 润色按钮 -->
        <button 
          @click="handlePolish"
          :disabled="isPolishing || !content.trim()"
          class="mt-2 px-4 py-1.5 text-xs rounded-lg bg-[var(--bg-tertiary)] hover:bg-[var(--accent-color)] hover:text-white border border-[var(--border-color)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5 group"
        >
          <n-spin v-if="isPolishing" :size="12" />
          <n-icon v-else :size="14" class="text-[var(--accent-color)] group-hover:text-white transition-colors">
            <svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 24 24"><path d="M19.07 4.93L17.22 3.07a3.046 3.046 0 0 0-4.31 0l-1.4 1.4l5.69 5.69l1.4-1.4c1.19-1.2 1.19-3.13.47-3.83zm-7.12 3.08L6.26 13.7a3.042 3.042 0 0 0-.88 2.16V19h3.14c.8 0 1.57-.32 2.16-.9l5.69-5.69l-4.42-4.4z" fill="currentColor"></path><path d="M20 24h-4v-2h4v-4h2v4h4v2h-4v4h-2z" fill="currentColor"></path></svg>
          </n-icon>
          Polish
        </button>
      </div>

      <!-- Handles | 连接点 -->
      <Handle type="source" :position="Position.Right" id="right" class="!bg-[var(--accent-color)]" />
      <Handle type="target" :position="Position.Left" id="left" class="!bg-[var(--accent-color)]" />

    </div>

    <!-- Hover action buttons | 悬浮操作按钮 -->
    <!-- Top right - Copy button | 右上角 - Copy按钮 -->
    <div v-show="showActions" class="absolute -top-5 right-12 z-[1000]">
      <button @click="handleDuplicate"
        class="action-btn group p-2 bg-white rounded-lg transition-all border border-gray-200 flex items-center gap-0 hover:gap-1.5 w-max">
        <n-icon :size="16" class="text-gray-600">
          <CopyOutline />
        </n-icon>
        <span
          class="text-xs text-gray-600 max-w-0 overflow-hidden group-hover:max-w-[60px] transition-all duration-200 whitespace-nowrap">Copy</span>
      </button>
    </div>

    <!-- Right side - Action buttons | 右侧 - 操作按钮 -->
    <div v-show="showActions"
      class="absolute right-10 top-1/2 -translate-y-1/2 translate-x-full flex flex-col gap-2 z-[1000]">
      <!-- Image generation button | Image Gen按钮 -->
      <button @click="handleImageGen"
        class="action-btn group p-2 bg-white rounded-lg transition-all border border-gray-200 flex items-center gap-0 hover:gap-1.5 w-max">
        <n-icon :size="16" class="text-gray-600">
          <ImageOutline />
        </n-icon>
        <span
          class="text-xs text-gray-600 max-w-0 overflow-hidden group-hover:max-w-[80px] transition-all duration-200 whitespace-nowrap">Image Gen</span>
      </button>
      <!-- Video generation button | Video Gen按钮 -->
      <button @click="handleVideoGen"
        class="action-btn group p-2 bg-white rounded-lg transition-all border border-gray-200 flex items-center gap-0 hover:gap-1.5 w-max">
        <n-icon :size="16" class="text-gray-600">
          <VideocamOutline />
        </n-icon>
        <span
          class="text-xs text-gray-600 max-w-0 overflow-hidden group-hover:max-w-[80px] transition-all duration-200 whitespace-nowrap">Video Gen</span>
      </button>
    </div>
  </div>
</template>

<script setup>
/**
 * Text node component | 文本节点组件
 * Allows user to input and edit text content
 */
import { ref, watch, nextTick } from 'vue'
import { Handle, Position, useVueFlow } from '@vue-flow/core'
import { NIcon, NSpin } from 'naive-ui'
import { TrashOutline, ExpandOutline, CopyOutline, ImageOutline, VideocamOutline } from '../../icons/coolicons'
import { updateNode, removeNode, duplicateNode, addNode, addEdge, nodes } from '../../stores/canvas'
import { useChat, useApiConfig } from '../../hooks'
import { useModelConfig } from '../../hooks/useModelConfig'
import { DEFAULT_CHAT_MODEL, DEFAULT_IMAGE_MODEL, DEFAULT_IMAGE_SIZE } from '../../stores/models'

const props = defineProps({
  id: String,
  data: Object
})

// Vue Flow instance | Vue Flow 实例
const { updateNodeInternals } = useVueFlow()

// API config hook | API 配置 hook
const { isConfigured: isApiConfigured } = useApiConfig()
const { selectedChatModel } = useModelConfig()

// Chat hook for polish | 润色用的 Chat hook
const { send: sendChat } = useChat({
  systemPrompt: 'You are an expert prompt writer for image generation. Rewrite user input into a high-quality visual prompt with style, lighting, composition, and details. Return only the prompt.',
  model: selectedChatModel.value || DEFAULT_CHAT_MODEL
})

// Local content state | 本地内容状态
const content = ref(props.data?.content || '')

// Hover state | 悬浮状态
const showActions = ref(false)

// Polish loading state | 润色加载状态
const isPolishing = ref(false)

// Watch for external data changes | 监听外部数据变化
watch(() => props.data?.content, (newVal) => {
  if (newVal !== content.value) {
    content.value = newVal
  }
})

// Update content in store | 更新存储中的内容
const updateContent = () => {
  updateNode(props.id, { content: content.value })
}

// Handle AI polish | 处理 Polish
const handlePolish = async () => {
  const input = content.value.trim()
  if (!input) return
  
  // Check API configuration | 检查 API 配置
  if (!isApiConfigured.value) {
    window.$message?.warning('Please configure API Key first')
    return
  }

  isPolishing.value = true
  const originalContent = content.value

  try {
    // Call chat API to polish the prompt | 调用 PolishPrompt
    const result = await sendChat(input, true)
    
    if (result) {
      content.value = result
      updateNode(props.id, { content: result })
      window.$message?.success('Prompt polished')
    }
  } catch (err) {
    content.value = originalContent
    window.$message?.error(err.message || 'Polish failed')
  } finally {
    isPolishing.value = false
  }
}

// Handle delete | 处理删除
const handleDelete = () => {
  removeNode(props.id)
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

// Handle image generation | 处理Image Gen
const handleImageGen = () => {
  const currentNode = nodes.value.find(n => n.id === props.id)
  const nodeX = currentNode?.position?.x || 0
  const nodeY = currentNode?.position?.y || 0

  // Create imageConfig node | 创建text生图配置节点
  const configNodeId = addNode('imageConfig', { x: nodeX + 400, y: nodeY }, {
    model: DEFAULT_IMAGE_MODEL,
    size: DEFAULT_IMAGE_SIZE,
    label: 'Text to Image'
  })

  // Auto connect | 自动连接
  addEdge({
    source: props.id,
    target: configNodeId,
    sourceHandle: 'right',
    targetHandle: 'left'
  })

  // Force Vue Flow to recalculate node dimensions | 强制 Vue Flow 重新计算节点Size
  setTimeout(() => {
    updateNodeInternals(configNodeId)
  }, 50)
}

// Handle video generation | 处理Video Gen
const handleVideoGen = () => {
  const currentNode = nodes.value.find(n => n.id === props.id)
  const nodeX = currentNode?.position?.x || 0
  const nodeY = currentNode?.position?.y || 0

  // Create videoConfig node | 创建视频配置节点
  const configNodeId = addNode('videoConfig', { x: nodeX + 400, y: nodeY }, {
    label: 'Video Gen'
  })

  // Auto connect | 自动连接
  addEdge({
    source: props.id,
    target: configNodeId,
    sourceHandle: 'right',
    targetHandle: 'left'
  })

  // Force Vue Flow to recalculate node dimensions | 强制 Vue Flow 重新计算节点Size
  setTimeout(() => {
    updateNodeInternals(configNodeId)
  }, 50)
}
</script>

<style scoped>
.text-node-wrapper {
  padding-right: 50px;
  padding-top: 20px;
  position: relative;
}

.text-node {
  cursor: default;
  position: relative;
}

.text-node textarea {
  cursor: text;
}
</style>
