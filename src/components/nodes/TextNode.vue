<template>
  <div class="text-node-wrapper" @mouseenter="showCapsule = true" @mouseleave="showCapsule = false">
    <div class="node-meta-row" @mousedown="handleMetaMouseDown">
      <n-icon :size="16" class="meta-icon"><TextOutline /></n-icon>
      <span class="meta-title">Text</span>
    </div>

    <div v-show="showCapsule || isSelected" class="capsule-menu absolute left-1/2 z-[1200]" :style="capsuleStyle">
      <div class="capsule-inner">
        <div class="capsule-group">
          <n-dropdown :options="chatModelDropdownOptions" @select="setChatModel">
            <button class="capsule-select">{{ displayChatModel }}</button>
          </n-dropdown>
        </div>

        <div class="capsule-divider" />

        <div class="capsule-group">
          <n-dropdown :options="createLinkOptions" @select="createLinkedNode">
            <button class="capsule-icon" title="Create linked module">
              <n-icon :size="14"><AddOutline /></n-icon>
            </button>
          </n-dropdown>
          <button class="capsule-icon" @click="handleDuplicate" title="Duplicate">
            <n-icon :size="14"><CopyOutline /></n-icon>
          </button>
          <button class="capsule-icon" @click="handleDelete" title="Delete">
            <n-icon :size="14"><TrashOutline /></n-icon>
          </button>
        </div>
      </div>
      <div class="capsule-inner capsule-generate">
        <button class="capsule-icon capsule-icon-solid capsule-create" :disabled="isGenerating" @click="handleGenerateText" title="Create">
          <n-spin v-if="isGenerating" :size="12" />
          <template v-else>
            <n-icon :size="14"><SparklesOutline /></n-icon>
            <span class="capsule-create-label">Create</span>
          </template>
        </button>
        <button class="capsule-icon" :disabled="isGenerating" @click="handleRegenerateText" title="Regenerate">
          <n-spin v-if="isGenerating" :size="12" />
          <n-icon v-else :size="14"><RefreshOutline /></n-icon>
        </button>
      </div>
    </div>

    <div
      class="text-node rounded-2xl relative transition-all duration-200 overflow-visible"
      :class="isSelected ? 'node-selected' : 'node-default'"
      :style="moduleStyle"
    >
      <div class="module-stage" :style="stageStyle">
        <div v-if="showProgress" class="module-progress-shell rounded-[14px]">
          <div class="module-progress-track"></div>
          <div class="module-progress-bar" :style="progressBarStyle"></div>
          <div class="module-progress-label">Generating text... {{ progressPercent }}%</div>
        </div>
        <div
          v-else-if="data.error"
          class="w-full h-full bg-[#231a1d] flex flex-col items-center justify-center gap-2 rounded-[14px]"
        >
          <n-icon :size="28" class="text-red-500"><CloseCircleOutline /></n-icon>
          <span class="text-sm text-red-400 text-center px-3">{{ data.error }}</span>
        </div>
        <div v-else class="text-area-wrap">
          <textarea
            v-model="content"
            @blur="updateContent"
            @wheel.stop
            @mousedown.stop
            class="w-full bg-transparent resize-none outline-none text-sm text-[#d9dce3] placeholder:text-[#7b818c] min-h-[180px]"
            placeholder="Enter text..."
          />
        </div>
      </div>

      <Handle type="source" :position="Position.Right" id="right" :class="['node-handle-plus', 'node-handle-plus-right', { 'node-handle-plus-visible': showHandles }]" />
      <Handle type="target" :position="Position.Left" id="left" :class="['node-handle-plus', 'node-handle-plus-left', { 'node-handle-plus-visible': showHandles }]" />
    </div>
  </div>
</template>

<script setup>
import { computed, onUnmounted, ref, watch } from 'vue'
import { Handle, Position, useVueFlow } from '@vue-flow/core'
import { NDropdown, NIcon, NSpin } from 'naive-ui'
import { AddOutline, CloseCircleOutline, CopyOutline, RefreshOutline, SparklesOutline, TextOutline, TrashOutline } from '../../icons/coolicons'
import { addEdge, addNode, duplicateNode, nodes, removeNode, updateNode } from '../../stores/canvas'
import { useChat } from '../../hooks'
import { chatModelOptions, DEFAULT_CHAT_MODEL } from '../../stores/models'

const props = defineProps({
  id: String,
  data: Object,
  selected: Boolean
})

const { updateNodeInternals, viewport } = useVueFlow()

const showCapsule = ref(false)
const isGenerating = ref(false)
const content = ref(props.data?.content || '')
const localChatModel = ref(props.data?.model || 'gemini-2.5-flash')
const progressValue = ref(0)
const showProgress = ref(false)
const progressTimer = ref(null)
const progressFinishTimer = ref(null)
const isSelected = computed(() => !!props.selected || !!props.data?.selected)
const showHandles = computed(() => showCapsule.value || isSelected.value)
const createLinkOptions = [
  { label: 'Link Text Module', key: 'text' },
  { label: 'Link Image Module', key: 'image' },
  { label: 'Link Video Module', key: 'video' }
]

const { send: sendChat } = useChat({
  systemPrompt: 'You are an expert writing assistant. Improve clarity, structure, and expression while keeping meaning accurate. Return only the rewritten text.',
  model: () => localChatModel.value || DEFAULT_CHAT_MODEL
})
const chatModelDropdownOptions = computed(() => chatModelOptions.value.map((m) => ({ key: m.key, label: m.label })))
const displayChatModel = computed(() => chatModelOptions.value.find((m) => m.key === localChatModel.value)?.label || localChatModel.value)

watch(() => props.data?.content, (newVal) => {
  if (newVal !== content.value) content.value = newVal || ''
})
watch(() => props.data?.model, (newVal) => {
  if (newVal && newVal !== localChatModel.value) localChatModel.value = newVal
})

const stageStyle = computed(() => ({ width: '360px', height: '240px' }))
const moduleStyle = computed(() => ({ width: '362px' }))
const progressPercent = computed(() => Math.round(progressValue.value))
const progressBarStyle = computed(() => ({ width: `${Math.max(0, Math.min(100, progressValue.value))}%` }))
const capsuleStyle = computed(() => {
  const zoom = viewport.value?.zoom || 1
  const inverse = 1 / zoom
  const safeScale = Math.min(1.06, Math.max(0.82, inverse))
  return { transform: `translateX(-50%) scale(${safeScale})`, transformOrigin: 'top center' }
})

const clearProgressTimers = () => {
  if (progressTimer.value) {
    clearInterval(progressTimer.value)
    progressTimer.value = null
  }
  if (progressFinishTimer.value) {
    clearTimeout(progressFinishTimer.value)
    progressFinishTimer.value = null
  }
}

const startProgress = () => {
  clearProgressTimers()
  progressValue.value = 0
  showProgress.value = true
  progressTimer.value = setInterval(() => {
    if (progressValue.value < 70) progressValue.value += 3
    else if (progressValue.value < 90) progressValue.value += 1.2
    else if (progressValue.value < 98) progressValue.value += 0.35
    progressValue.value = Math.min(progressValue.value, 98)
  }, 120)
}

const finishProgress = () => {
  clearProgressTimers()
  progressTimer.value = setInterval(() => {
    progressValue.value = Math.min(100, progressValue.value + 4.5)
    if (progressValue.value >= 100) {
      clearProgressTimers()
      progressFinishTimer.value = setTimeout(() => {
        showProgress.value = false
        progressValue.value = 0
      }, 120)
    }
  }, 16)
}

watch(
  () => props.data?.loading,
  (loadingNow) => {
    if (loadingNow) {
      startProgress()
      return
    }
    if (props.data?.error) {
      clearProgressTimers()
      showProgress.value = false
      progressValue.value = 0
      return
    }
    if (showProgress.value) finishProgress()
  },
  { immediate: true }
)

onUnmounted(() => clearProgressTimers())

const updateContent = () => {
  updateNode(props.id, { content: content.value })
}

const setChatModel = (key) => {
  localChatModel.value = key
  updateNode(props.id, { model: key })
}

const runTextGeneration = async (isRegenerate = false) => {
  const source = content.value.trim()
  if (!source) {
    window.$message?.warning('Please enter text before optimization')
    return
  }

  isGenerating.value = true
  updateNode(props.id, { loading: true, error: '' })
  const prompt = isRegenerate
    ? `Regenerate the following text with a different writing style while preserving the original meaning:\n\n${source}`
    : `Optimize the following text for clarity, flow, and readability while preserving the original meaning:\n\n${source}`
  try {
    const result = await sendChat(prompt, true)
    const optimized = String(result || '').trim()
    if (optimized) {
      content.value = optimized
      updateNode(props.id, { content: optimized, model: localChatModel.value, loading: false, error: '' })
      window.$message?.success(isRegenerate ? 'Text regenerated' : 'Text generated')
    }
  } catch (err) {
    updateNode(props.id, { loading: false, error: err?.message || 'Text generation failed' })
    window.$message?.error(err?.message || 'Text generation failed')
  } finally {
    updateNode(props.id, { loading: false })
    isGenerating.value = false
  }
}
const handleGenerateText = () => runTextGeneration(false)
const handleRegenerateText = () => runTextGeneration(true)

const handleDelete = () => {
  removeNode(props.id)
}

const handleDuplicate = () => {
  const newNodeId = duplicateNode(props.id)
  if (!newNodeId) return
  setTimeout(() => updateNodeInternals(newNodeId), 50)
}

const selectNode = () => {
  nodes.value = nodes.value.map((node) => ({
    ...node,
    selected: node.id === props.id,
    data: { ...(node.data || {}), selected: node.id === props.id }
  }))
}

const handleMetaMouseDown = () => {
  selectNode()
}

const createLinkedNode = (type) => {
  const side = 'right'
  const currentNode = nodes.value.find((n) => n.id === props.id)
  if (!currentNode) return

  const moduleWidth = 362
  const gapX = 172
  const nextPosition = {
    x: side === 'right' ? currentNode.position.x + moduleWidth + gapX : currentNode.position.x - gapX - moduleWidth,
    y: currentNode.position.y
  }

  const newNodeId = addNode(type, nextPosition)
  if (!newNodeId) return

  if (side === 'right') addEdge({ source: props.id, target: newNodeId, sourceHandle: 'right', targetHandle: 'left' })
  else addEdge({ source: newNodeId, target: props.id, sourceHandle: 'right', targetHandle: 'left' })

  nodes.value = nodes.value.map((node) => ({
    ...node,
    selected: node.id === newNodeId,
    data: { ...(node.data || {}), selected: node.id === newNodeId }
  }))

  setTimeout(() => {
    updateNodeInternals(props.id)
    updateNodeInternals(newNodeId)
  }, 60)
}
</script>

<style scoped>
.text-node-wrapper {
  position: relative;
  padding-top: 88px;
}

.text-node {
  cursor: default;
  position: relative;
  background: #0f0f0f;
}

.node-meta-row {
  position: absolute;
  top: 58px;
  left: 0;
  z-index: 10;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  color: #9ca3af;
  font-size: 14px;
  line-height: 1;
  padding: 0;
  border-radius: 10px;
  cursor: grab;
}

.meta-icon { color: #c9ccd2; }
.meta-title { color: #d7dbe3; font-size: 14px; letter-spacing: 0.01em; }

.module-stage { margin: 0 auto; overflow: hidden; border-radius: inherit; }
.text-area-wrap { width: 100%; height: 100%; padding: 14px; border-radius: 14px; background: #0f0f0f; border: 0; }
.module-progress-shell {
  width: 100%;
  height: 100%;
  position: relative;
  overflow: hidden;
  background: #101010;
}
.module-progress-track {
  position: absolute;
  inset: 0;
  background: transparent;
}
.module-progress-bar {
  position: absolute;
  inset: 0 auto 0 0;
  width: 0%;
  background: #2d2d2d;
  transition: width 0.12s linear;
}
.module-progress-label {
  position: absolute;
  left: 12px;
  bottom: 10px;
  color: rgba(247, 249, 252, 0.9);
  font-size: 12px;
  line-height: 1;
}

.capsule-menu { pointer-events: auto; top: 6px; display: inline-flex; align-items: center; gap: 8px; }
.capsule-inner { display: inline-flex; align-items: center; gap: 6px; padding: 7px 9px; border-radius: 999px; border: 1px solid rgba(143, 143, 143, 0.45); background: #1d1d1d; backdrop-filter: blur(10px); }
.capsule-generate { padding: 7px; }
.capsule-group { display: inline-flex; align-items: center; gap: 6px; }
.capsule-divider { width: 1px; height: 18px; background: rgba(255, 255, 255, 0.12); }

.capsule-select { border: 1px solid rgba(255, 255, 255, 0.1); background: rgba(255, 255, 255, 0.02); color: #e7e8eb; border-radius: 999px; font-size: 12px; line-height: 1; padding: 7px 9px; max-width: 148px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.capsule-select:disabled { opacity: 0.45; cursor: not-allowed; }
.capsule-icon { display: inline-flex; align-items: center; justify-content: center; width: 28px; height: 28px; border-radius: 999px; border: 1px solid rgba(255, 255, 255, 0.1); color: #b8bcc5; background: rgba(255, 255, 255, 0.02); }
.capsule-icon-solid { background: #1d1d1d; color: #f6f8fc; border-color: rgba(143, 143, 143, 0.65); }
.capsule-create { width: auto; min-width: 86px; padding: 0 11px; gap: 6px; }
.capsule-create-label { font-size: 12px; line-height: 1; font-weight: 500; }

.node-default { border-width: 0; border-color: transparent; box-shadow: none; }
.node-selected { border-width: 0; border-color: transparent; box-shadow: none; }

:deep(.node-handle-plus) {
  width: 28px !important;
  height: 28px !important;
  display: grid !important;
  place-items: center !important;
  border-radius: 999px !important;
  border: 1px solid rgba(214, 216, 222, 0.82) !important;
  background: rgba(11, 13, 17, 0.96) !important;
  color: #d6d8de !important;
  box-shadow: 0 0 0 2px rgba(0, 0, 0, 0.72);
  z-index: 60 !important;
  transition: none !important;
  opacity: 0;
  pointer-events: none;
}

:deep(.node-handle-plus::before) {
  content: "+";
  font-size: 16px;
  font-weight: 500;
  line-height: 1;
  display: block;
  margin: -1px 0 0 0;
}

:deep(.node-handle-plus-left) { left: -25px !important; }
:deep(.node-handle-plus-right) { right: -25px !important; }

:deep(.node-handle-plus-visible) {
  opacity: 1 !important;
  pointer-events: auto !important;
}
</style>
