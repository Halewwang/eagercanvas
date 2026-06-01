<template>
  <!-- LLM Config node wrapper | LLM配置节点包裹层 -->
  <div class="llm-node-wrapper" @mouseenter="showActions = true" @mouseleave="showActions = false">
    <!-- LLM Config node | LLM配置节点 -->
    <ConfigNodeShell :selected="data.selected" class="llm-node min-w-[320px] max-w-[400px] relative">
      <!-- Header | 头部 -->
      <ConfigNodeHeader :label="data.label || 'LLM Text Generation'" @delete="handleDelete">
        <template #icon>
          <n-icon :size="16" class="text-[#c9ccd2]">
            <ChatbubbleOutline />
          </n-icon>
        </template>
      </ConfigNodeHeader>

      <!-- Config content | 配置内容 -->
      <ConfigNodeContent>
        <!-- System prompt | System Prompt -->
        <ConfigNodeField label="System Prompt">
          <ConfigNodeTextarea v-model="systemPrompt" @blur="updateConfig" placeholder="Set the AI role and behavior..." />
        </ConfigNodeField>

        <!-- Model selection | Model选择 -->
        <ConfigNodeField label="Model">
          <ConfigNodeSelect :model-value="model" :options="modelOptions" @update:modelValue="handleModelUpdate" />
        </ConfigNodeField>

        <!-- Generate button | 生成按钮 -->
        <ConfigNodePrimaryActionButton
          @click="handleGenerate"
          :disabled="isGenerating"
        >
          <n-spin v-if="isGenerating" :size="14" />
          <n-icon v-else :size="14"><SparklesOutline /></n-icon>
          {{ isGenerating ? 'Generating...' : 'Run' }}
        </ConfigNodePrimaryActionButton>

        <!-- Output preview | 输出Preview -->
        <ConfigNodeField v-if="outputContent" label="Result" root-class="mt-2">
          <template #actions>
            <ConfigNodeInlineActionButton @click="handleCopyOutput">
              <n-icon :size="12"><CopyOutline /></n-icon>
              Copy
            </ConfigNodeInlineActionButton>
          </template>
          <ConfigNodeOutputPreview :content="outputContent" />
        </ConfigNodeField>
      </ConfigNodeContent>

      <!-- Handles | 连接点 -->
      <ConfigNodeHandles />
    </ConfigNodeShell>

    <!-- Hover action buttons | 悬浮操作按钮 -->
    <ConfigNodeHoverActions :visible="showActions" position-class="right-12" wide @duplicate="handleDuplicate" />
  </div>
</template>

<script setup>
/**
 * LLM Config node component | LLM配置节点组件
 * For text generation tasks like story segmentation
 */
import { ref, watch } from 'vue'
import { useVueFlow } from '@vue-flow/core'
import { NIcon, NSpin } from 'naive-ui'
import { storeToRefs } from 'pinia'
import { CopyOutline, ChatbubbleOutline, SparklesOutline } from '@/icons/coolicons'
import { useCanvasStore } from '@/stores/canvas'
import { pinia } from '@/stores/pinia'
import { useChat } from '@/hooks/api/useChatApi.js'
import { useApiConfig } from '@/hooks/useApiConfig'
import { chatModelSelectOptions, DEFAULT_CHAT_MODEL } from '@/stores/models'
import ConfigNodeContent from './config/ConfigNodeContent.vue'
import ConfigNodeField from './config/ConfigNodeField.vue'
import ConfigNodeHandles from './config/ConfigNodeHandles.vue'
import ConfigNodeHeader from './config/ConfigNodeHeader.vue'
import ConfigNodeHoverActions from './config/ConfigNodeHoverActions.vue'
import ConfigNodeInlineActionButton from './config/ConfigNodeInlineActionButton.vue'
import ConfigNodeOutputPreview from './config/ConfigNodeOutputPreview.vue'
import ConfigNodePrimaryActionButton from './config/ConfigNodePrimaryActionButton.vue'
import ConfigNodeSelect from './config/ConfigNodeSelect.vue'
import ConfigNodeShell from './config/ConfigNodeShell.vue'
import ConfigNodeTextarea from './config/ConfigNodeTextarea.vue'

const props = defineProps({
  id: String,
  data: Object
})

// Vue Flow instance | Vue Flow 实例
const { updateNodeInternals } = useVueFlow()
const canvasStore = useCanvasStore(pinia)
const { nodes, edges } = storeToRefs(canvasStore)
const { updateNode, removeNode, duplicateNode } = canvasStore

// API config hook | API 配置 hook
const { isConfigured: isApiConfigured } = useApiConfig()

// Local state | 本地状态
const systemPrompt = ref(props.data?.systemPrompt || '')
const model = ref(props.data?.model || DEFAULT_CHAT_MODEL)
const outputContent = ref(props.data?.outputContent || '')
const isGenerating = ref(false)
const showActions = ref(false)

// Model options | Model选项
const modelOptions = chatModelSelectOptions

// Watch for external data changes | 监听外部数据变化
watch(() => props.data, (newData) => {
  if (newData?.systemPrompt !== undefined) systemPrompt.value = newData.systemPrompt
  if (newData?.model !== undefined) model.value = newData.model
  if (newData?.outputContent !== undefined) outputContent.value = newData.outputContent
}, { deep: true })

// Update config in store | 更新存储中的配置
const updateConfig = () => {
  updateNode(props.id, { 
    systemPrompt: systemPrompt.value,
    model: model.value,
    outputContent: outputContent.value
  })
}

const handleModelUpdate = (value) => {
  model.value = value
  updateConfig()
}

// Get input from connected nodes | 获取连接节点的输入
const getInputFromConnections = () => {
  const incomingEdges = edges.value.filter(e => e.target === props.id)
  const inputs = []
  
  for (const edge of incomingEdges) {
    const sourceNode = nodes.value.find(n => n.id === edge.source)
    if (sourceNode) {
      if (sourceNode.type === 'text' && sourceNode.data?.content) {
        inputs.push(sourceNode.data.content)
      } else if (sourceNode.type === 'llmConfig' && sourceNode.data?.outputContent) {
        inputs.push(sourceNode.data.outputContent)
      }
    }
  }
  
  return inputs.join('\n\n')
}

// Handle generate | 处理生成
const handleGenerate = async () => {
  if (!isApiConfigured.value) {
    window.$message?.warning('Please sign in first')
    return
  }

  const input = getInputFromConnections()
  if (!input && !systemPrompt.value) {
    window.$message?.warning('Connect input nodes or set a system prompt')
    return
  }

  isGenerating.value = true

  try {
    const { send } = useChat({
      systemPrompt: systemPrompt.value,
      model: model.value
    })

    const result = await send(input || 'Generate content from the system prompt', true)
    
    if (result) {
      outputContent.value = result
      updateNode(props.id, { outputContent: result })
      window.$message?.success('Generation completed')
      // Force refresh view layer | 强制刷新视图层
      setTimeout(() => {
        const textarea = document.querySelector('.llm-node pre')
        if (textarea) {
          textarea.style.display = 'none'
          textarea.offsetHeight // trigger reflow
          textarea.style.display = 'block'
        }
      }, 0)
    }
  } catch (err) {
    window.$message?.error(err.message || 'Generation failed')
  } finally {
    isGenerating.value = false
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

// Handle copy output | 处理Copy输出
const handleCopyOutput = async () => {
  if (!outputContent.value) return
  try {
    await navigator.clipboard.writeText(outputContent.value)
    window.$message?.success('Copied to clipboard')
  } catch (err) {
    window.$message?.error('Copy failed')
  }
}
</script>

<style scoped>
.llm-node-wrapper {
  padding-right: 50px;
  padding-top: 20px;
  position: relative;
}

.llm-node {
  cursor: default;
  position: relative;
}

</style>
