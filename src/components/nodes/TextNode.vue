<template>
  <div class="text-node-wrapper node-shell-wrapper" @mouseenter="showCapsule = true" @mouseleave="showCapsule = false">
    <div class="node-meta-row" @mousedown="handleMetaMouseDown">
      <n-icon :size="16" class="meta-icon"><TextOutline /></n-icon>
      <span class="meta-title">Text</span>
    </div>

    <div v-show="showNodeCapsule" class="capsule-menu absolute left-1/2 z-[1200]" :style="capsuleStyle">
      <div class="capsule-inner" :class="{ 'capsule-inner-selected': isSelected }">
        <div class="capsule-group">
          <BaseDropdown :options="chatModelDropdownOptions" :selected-key="localChatModel" compact @select="setChatModel">
            <button class="capsule-select">{{ displayChatModel }}</button>
          </BaseDropdown>
        </div>

        <div class="capsule-divider" />

        <div class="capsule-group">
          <button class="capsule-icon" @click="handleDuplicate" title="Duplicate">
            <n-icon :size="14"><CopyOutline /></n-icon>
          </button>
          <button class="capsule-icon" @click="handleDelete" title="Delete">
            <n-icon :size="14"><TrashOutline /></n-icon>
          </button>
        </div>
      </div>
      <div class="capsule-inner capsule-generate" :class="{ 'capsule-inner-selected': isSelected }">
        <button v-if="!isGenerating" class="capsule-icon capsule-icon-solid capsule-create" @click="handleGenerateText" title="Create">
          <img :src="createIcon" alt="" class="capsule-create-graphic" />
          <span class="capsule-create-label">Create</span>
        </button>
        <button v-if="!isGenerating" class="capsule-icon" @click="handleRegenerateText" title="Regenerate">
          <n-icon :size="14"><RefreshOutline /></n-icon>
        </button>
        <button v-if="isGenerating" class="capsule-icon capsule-icon-solid capsule-create" @click="handleStopGeneration" title="Stop">
          <n-icon :size="14"><CloseCircleOutline /></n-icon>
          <span class="capsule-create-label">Stop</span>
        </button>
      </div>
    </div>

    <div
      class="text-node rounded-2xl relative transition-all duration-200 overflow-visible"
      :class="[
        isSelected ? 'node-selected' : 'node-default',
        { 'node-glow-active': isSelected }
      ]"
      :style="moduleStyle"
    >
      <div class="module-stage" :style="stageStyle">
        <div v-if="showProgress" class="module-progress-shell rounded-[14px]">
          <div class="module-progress-track"></div>
          <div class="module-progress-bar" :style="progressBarStyle"></div>
          <div class="module-progress-label">Generating text... {{ progressPercent }}%</div>
        </div>
        <div v-else class="text-area-wrap">
          <textarea
            v-model="content"
            @blur="updateContent"
            @wheel.stop
            @mousedown.stop
            class="w-full bg-transparent resize-none outline-none text-sm text-[#d9dce3] placeholder:text-[#7b818c]"
            placeholder="Enter text..."
          />
        </div>
      </div>

      <Handle type="source" :position="Position.Right" id="right" :class="['node-handle-plus', 'node-handle-plus-right', { 'node-handle-plus-visible': showHandles }]" />
      <Handle type="target" :position="Position.Left" id="left" :class="['node-handle-plus', 'node-handle-plus-left', { 'node-handle-plus-visible': showHandles }]" />
    </div>
    <BaseModal
      v-model:show="showErrorModal"
      title="Text Module Error"
      size="sm"
    >
      <p class="ui-body ui-modal-copy whitespace-pre-wrap">{{ data.error }}</p>
      <template #footer>
        <div class="ui-modal-actions">
          <BaseButton @click="closeErrorModal">Close</BaseButton>
        </div>
      </template>
    </BaseModal>
    <div class="binding-status-wrap">
      <div class="binding-status-row">
        <div v-if="connectedTargets.length > 0" class="binding-status-pill binding-status-pill-active">
          Linked to {{ connectedTargets.length }} module{{ connectedTargets.length > 1 ? 's' : '' }}
        </div>
        <div v-else class="binding-status-pill binding-status-pill-idle">
          Not linked
        </div>
        <div
          class="binding-status-pill"
          :class="hasIncomingImage ? 'binding-status-pill-active' : 'binding-status-pill-idle'"
        >
          Image
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, onUnmounted, ref, watch } from 'vue'
import { Handle, Position, useVueFlow } from '@vue-flow/core'
import { NIcon } from 'naive-ui'
import { BaseButton, BaseDropdown, BaseModal } from '@/components/ui'
import { CloseCircleOutline, CopyOutline, RefreshOutline, TextOutline, TrashOutline } from '../../icons/coolicons'
import { duplicateNode, edges, nodes, removeNode, updateNode } from '../../stores/canvas'
import { useChat } from '../../hooks'
import { chatModelOptions, DEFAULT_CHAT_MODEL } from '../../stores/models'
import { getErrorMessage } from '@/utils'
import createIcon from '@/assets/create-icon.svg'

const props = defineProps({
  id: String,
  data: Object,
  selected: Boolean
})

const { updateNodeInternals } = useVueFlow()

const showCapsule = ref(false)
const isGenerating = ref(false)
const showErrorModal = ref(false)
const content = ref(props.data?.content || '')
const localChatModel = ref(props.data?.model || 'gemini-2.5-flash')
const progressValue = ref(0)
const showProgress = ref(false)
const progressTimer = ref(null)
const progressFinishTimer = ref(null)
const isSelected = computed(() => !!props.selected || !!props.data?.selected)
const showNodeCapsule = computed(() => !props.data?.suppressCapsule && (showCapsule.value || isSelected.value))
const showHandles = computed(() => showCapsule.value || isSelected.value)
const connectedTargets = computed(() => {
  return edges.value.filter(edge => edge.source === props.id).map(edge => edge.target)
})
const incomingImageNodes = computed(() =>
  edges.value
    .filter((edge) => edge.target === props.id)
    .map((edge) => nodes.value.find((node) => node.id === edge.source))
    .filter((node) => node?.type === 'image' && String(node?.data?.url || node?.data?.base64 || '').trim())
)
const hasIncomingImage = computed(() => incomingImageNodes.value.length > 0)
const VISION_ANALYSIS_MODEL = 'gemini-2.5-flash'
const IMAGE_JSON_SCHEMA = {
  summary: 'short description of the image',
  scene: 'environment and setting',
  subjects: [
    {
      name: 'subject name',
      description: 'appearance and role'
    }
  ],
  style: 'visual style and medium',
  composition: 'layout and framing',
  lighting: 'lighting description',
  colors: ['primary colors'],
  camera: 'camera angle or shot type',
  text_in_image: ['visible text if any'],
  notable_objects: ['important objects or props']
}

const { send: sendChat, clear: clearChat } = useChat({
  systemPrompt: [
    '你是专业的文案与提示词优化助手。',
    '严格遵守：',
    '1) 输出语言必须与用户输入语言一致，禁止翻译（除非用户明确要求翻译）。',
    '2) 保留原意和关键信息，不得擅自改主题。',
    '3) 仅输出优化后的最终文本，不要解释。'
  ].join('\n'),
  model: () => localChatModel.value || DEFAULT_CHAT_MODEL
})
const { send: sendVisionChat, clear: clearVisionChat } = useChat({
  systemPrompt: [
    'You are an image understanding assistant.',
    'Analyze the provided image carefully.',
    'Return only valid JSON.',
    'Do not wrap JSON in markdown fences.',
    'Do not add explanation before or after the JSON.'
  ].join('\n'),
  model: () => VISION_ANALYSIS_MODEL
})
const chatModelDropdownOptions = computed(() => chatModelOptions.value.map((m) => ({ key: m.key, label: m.label })))
const displayChatModel = computed(() => chatModelOptions.value.find((m) => m.key === localChatModel.value)?.label || localChatModel.value)

watch(() => props.data?.content, (newVal) => {
  if (newVal !== content.value) content.value = newVal || ''
})
watch(() => props.data?.model, (newVal) => {
  if (newVal && newVal !== localChatModel.value) localChatModel.value = newVal
})
watch(() => props.data?.error, (newVal) => {
  showErrorModal.value = !!newVal
})

const stageStyle = computed(() => ({ width: '360px', height: '240px' }))
const moduleStyle = computed(() => ({ width: '362px' }))
const progressPercent = computed(() => Math.round(progressValue.value))
const progressBarStyle = computed(() => ({ width: `${Math.max(0, Math.min(100, progressValue.value))}%` }))
const capsuleStyle = {
  transform: 'translateX(-50%) scale(var(--node-capsule-scale, 1))',
  transformOrigin: 'top center'
}

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

const buildImageAnalysisPrompt = () => [
  'Analyze the provided image and return a structured JSON description.',
  'Requirements:',
  '1. Return valid JSON only.',
  '2. Use concise but specific wording.',
  '3. If a field is unknown, use an empty string or empty array.',
  '4. Keep the JSON keys exactly as requested.',
  `Schema: ${JSON.stringify(IMAGE_JSON_SCHEMA)}`
].join('\n')

const runImageAnalysis = async () => {
  const imageNode = incomingImageNodes.value[0]
  const imageSource = String(imageNode?.data?.url || imageNode?.data?.base64 || '').trim()
  if (!imageSource) {
    window.$message?.warning('Connect an image node first')
    return
  }

  isGenerating.value = true
  updateNode(props.id, { loading: true, error: '' })

  try {
    clearVisionChat()
    const result = await sendVisionChat([
      {
        type: 'text',
        text: buildImageAnalysisPrompt()
      },
      {
        type: 'image_url',
        image_url: imageSource
      }
    ], true)

    const descriptionJson = String(result || '').trim()
    if (!descriptionJson) {
      throw new Error('Model returned empty JSON content')
    }

    content.value = descriptionJson
    updateNode(props.id, {
      content: descriptionJson,
      model: localChatModel.value,
      loading: false,
      error: ''
    })
    window.$message?.success('Image description generated')
  } catch (err) {
    const message = getErrorMessage(err, 'Image analysis failed')
    updateNode(props.id, { loading: false, error: message })
    window.$message?.error(message)
  } finally {
    updateNode(props.id, { loading: false })
    isGenerating.value = false
  }
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
    ? `请在不改变原意的前提下，使用不同表达方式重写以下文本；输出语言必须与原文一致，不得翻译：\n\n${source}`
    : `请优化以下文本，使其更适合用于图像和视频生成（更清晰、可执行、细节充分）；输出语言必须与原文一致，不得翻译：\n\n${source}`
  try {
    // Keep each click isolated to avoid previous rounds affecting language/style.
    clearChat()
    const result = await sendChat(prompt, true)
    const optimized = String(result || '').trim()
    if (optimized) {
      content.value = optimized
      updateNode(props.id, { content: optimized, model: localChatModel.value, loading: false, error: '' })
      window.$message?.success(isRegenerate ? 'Text regenerated' : 'Text generated')
    } else {
      throw new Error('Model returned empty text content')
    }
  } catch (err) {
    const message = getErrorMessage(err, 'Text generation failed')
    updateNode(props.id, { loading: false, error: message })
    window.$message?.error(message)
  } finally {
    updateNode(props.id, { loading: false })
    isGenerating.value = false
  }
}
const handleStopGeneration = () => {
  // Clear timers and reset UI
  clearProgressTimers()
  showProgress.value = false
  progressValue.value = 0
  isGenerating.value = false
  
  // Reset node state
  updateNode(props.id, { loading: false, error: 'Generation stopped' })
  window.$message?.info('Generation stopped')
}

const handleGenerateText = () => {
  if (hasIncomingImage.value) {
    runImageAnalysis()
    return
  }
  runTextGeneration(false)
}
const handleRegenerateText = () => {
  if (hasIncomingImage.value) {
    runImageAnalysis()
    return
  }
  runTextGeneration(true)
}
const closeErrorModal = () => {
  showErrorModal.value = false
  updateNode(props.id, { error: '' })
}

const handleDelete = () => {
  removeNode(props.id)
}

const handleDuplicate = () => {
  const newNodeId = duplicateNode(props.id)
  if (!newNodeId) return
  setTimeout(() => updateNodeInternals(newNodeId), 50)
}

const handleMetaMouseDown = (event) => {
  if (event?.button !== 0) return
}

</script>

<style scoped src="./node-base.css"></style>
<style scoped>
.text-node {
  cursor: default;
  position: relative;
  background: #0f0f0f;
  isolation: isolate;
  --module-radius: 24px;
  --module-inset: 12px;
  border-radius: var(--module-radius);
}

.text-area-wrap {
  width: 100%;
  height: 100%;
  padding: var(--module-inset);
  border-radius: calc(var(--module-radius) - var(--module-inset));
  background: #0f0f0f;
  border: 0;
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.text-area-wrap textarea {
  flex: 1;
  min-height: 92px;
}

.text-node::after {
  content: '';
  position: absolute;
  inset: -16px;
  border-radius: 28px;
  z-index: -1;
  pointer-events: none;
  opacity: 0;
  transition: opacity 0.22s ease;
  background:
    radial-gradient(46% 60% at 24% 80%, rgba(92, 133, 255, 0.4), transparent 70%),
    radial-gradient(58% 52% at 78% 18%, rgba(255, 123, 95, 0.38), transparent 72%),
    radial-gradient(92% 92% at 50% 50%, rgba(115, 138, 255, 0.24), transparent 74%);
  filter: blur(16px);
}

.node-glow-active::after {
  opacity: 1;
}
</style>
