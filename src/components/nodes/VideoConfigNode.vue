<template>
  <!-- Video config node wrapper | 视频配置节点包裹层 -->
  <div class="video-config-node-wrapper relative" @mouseenter="showActions = true" @mouseleave="showActions = false">
    <!-- Video config node | 视频配置节点 -->
    <div class="video-config-node bg-[#0f0f0f] rounded-2xl border min-w-[300px] transition-all duration-200"
      :class="data.selected ? 'border-[#8f8f8f]' : 'border-transparent'">
      <!-- Header | 头部 -->
      <div class="flex items-center justify-between px-3 py-2 border-b border-[rgba(143,143,143,0.28)]">
        <span class="text-sm font-medium text-[#d7dbe3]">{{ data.label || 'Video Gen' }}</span>
        <div class="flex items-center gap-1">
          <button @click="handleDelete" class="p-1 hover:bg-[rgba(255,255,255,0.04)] rounded transition-colors">
            <n-icon :size="14">
              <TrashOutline />
            </n-icon>
          </button>
        </div>
      </div>

      <!-- Config options | 配置选项 -->
      <div class="p-3 space-y-3">
        <!-- Model selector | Model选择 -->
        <div class="flex items-center justify-between">
          <span class="text-xs text-[#8f939e]">Model</span>
          <BaseDropdown :options="modelOptions" compact @select="handleModelSelect">
            <button class="flex items-center gap-1 text-sm text-[#eceff2] hover:text-[#f2f3f5]">
              {{ displayModelName }}
              <n-icon :size="12"><ChevronDownOutline /></n-icon>
            </button>
          </BaseDropdown>
        </div>

        <!-- Aspect ratio selector | 宽高比选择 -->
        <div class="flex items-center justify-between">
          <span class="text-xs text-[#8f939e]">Ratio</span>
          <BaseDropdown :options="ratioOptions" compact @select="handleRatioSelect">
            <button class="flex items-center gap-1 text-sm text-[#eceff2] hover:text-[#f2f3f5]">
              {{ localRatio }}
              <n-icon :size="12">
                <ChevronForwardOutline />
              </n-icon>
            </button>
          </BaseDropdown>
        </div>

        <div v-if="sizeOptions.length > 0" class="flex items-center justify-between">
          <span class="text-xs text-[#8f939e]">Size</span>
          <BaseDropdown :options="sizeOptions" compact @select="handleSizeSelect">
            <button class="flex items-center gap-1 text-sm text-[#eceff2] hover:text-[#f2f3f5]">
              {{ displaySize }}
              <n-icon :size="12">
                <ChevronForwardOutline />
              </n-icon>
            </button>
          </BaseDropdown>
        </div>

        <div v-if="resolutionOptions.length > 0" class="flex items-center justify-between">
          <span class="text-xs text-[#8f939e]">Resolution</span>
          <BaseDropdown :options="resolutionOptions" compact @select="handleResolutionSelect">
            <button class="flex items-center gap-1 text-sm text-[#eceff2] hover:text-[#f2f3f5]">
              {{ displayResolution }}
              <n-icon :size="12">
                <ChevronForwardOutline />
              </n-icon>
            </button>
          </BaseDropdown>
        </div>

        <div v-if="modeOptions.length > 0" class="flex items-center justify-between">
          <span class="text-xs text-[#8f939e]">Mode</span>
          <BaseDropdown :options="modeOptions" compact @select="handleModeSelect">
            <button class="flex items-center gap-1 text-sm text-[#eceff2] hover:text-[#f2f3f5]">
              {{ displayMode }}
              <n-icon :size="12">
                <ChevronForwardOutline />
              </n-icon>
            </button>
          </BaseDropdown>
        </div>

        <div v-if="typeOptions.length > 0" class="flex items-center justify-between">
          <span class="text-xs text-[#8f939e]">Type</span>
          <BaseDropdown :options="typeOptions" compact @select="handleTypeSelect">
            <button class="flex items-center gap-1 text-sm text-[#eceff2] hover:text-[#f2f3f5]">
              {{ displayType }}
              <n-icon :size="12">
                <ChevronForwardOutline />
              </n-icon>
            </button>
          </BaseDropdown>
        </div>

        <div v-if="supportsAudioToggle" class="flex items-center justify-between">
          <span class="text-xs text-[#8f939e]">Audio</span>
          <BaseDropdown :options="audioOptions" compact @select="handleAudioSelect">
            <button class="flex items-center gap-1 text-sm text-[#eceff2] hover:text-[#f2f3f5]">
              {{ displayAudio }}
              <n-icon :size="12">
                <ChevronForwardOutline />
              </n-icon>
            </button>
          </BaseDropdown>
        </div>

        <!-- Duration selector | Duration选择 -->
        <div class="flex items-center justify-between">
          <span class="text-xs text-[#8f939e]">Duration</span>
          <BaseDropdown :options="durationOptions" compact @select="handleDurationSelect">
            <button class="flex items-center gap-1 text-sm text-[#eceff2] hover:text-[#f2f3f5]">
              {{ localDuration }}s
              <n-icon :size="12">
                <ChevronForwardOutline />
              </n-icon>
            </button>
          </BaseDropdown>
        </div>

        <!-- Connected inputs indicator | 连接输入指示 -->
        <div
          class="flex flex-wrap items-center gap-2 text-xs text-[#8f939e] py-1 border-t border-[rgba(143,143,143,0.28)]">
          <span class="px-3 py-1 rounded-full"
            :class="connectedPrompt ? 'bg-[#2a2a2a] text-[#f2f3f5] border border-[rgba(255,255,255,0.62)]' : 'bg-[#1a1a1a] text-[#818793] border border-[rgba(143,143,143,0.36)]'">
            Prompt {{ connectedPrompt ? '✓' : '○' }}
          </span>
          <span class="px-3 py-1 rounded-full"
            :class="imagesByRole.firstFrame ? 'bg-[#2a2a2a] text-[#f2f3f5] border border-[rgba(255,255,255,0.62)]' : 'bg-[#1a1a1a] text-[#818793] border border-[rgba(143,143,143,0.36)]'">
            First Frame {{ imagesByRole.firstFrame ? '✓' : '○' }}
          </span>
          <span class="px-3 py-1 rounded-full"
            :class="imagesByRole.lastFrame ? 'bg-[#2a2a2a] text-[#f2f3f5] border border-[rgba(255,255,255,0.62)]' : 'bg-[#1a1a1a] text-[#818793] border border-[rgba(143,143,143,0.36)]'">
            Last Frame {{ imagesByRole.lastFrame ? '✓' : '○' }}
          </span>
          <span class="px-3 py-1 rounded-full"
            :class="imagesByRole.referenceImages.length > 0 ? 'bg-[#2a2a2a] text-[#f2f3f5] border border-[rgba(255,255,255,0.62)]' : 'bg-[#1a1a1a] text-[#818793] border border-[rgba(143,143,143,0.36)]'">
            Reference {{ imagesByRole.referenceImages.length > 0 ? `✓ ${imagesByRole.referenceImages.length}` : '○' }}
          </span>
        </div>
        <!-- Progress bar | 进度条 -->
        <!-- <div v-if="status === 'polling'" class="space-y-1">
        <div class="flex justify-between text-xs text-[var(--text-secondary)]">
          <span>Generating...</span>
          <span>{{ progress.percentage }}%</span>
        </div>
        <n-progress type="line" :percentage="progress.percentage" :show-indicator="false" :height="4" />
      </div> -->

        <!-- Generate button | 生成按钮 -->
        <button @click="handleGenerate" :disabled="loading || !isConfigured"
          class="flora-button-primary w-full flex items-center justify-center gap-2 py-2 px-4 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
          <n-spin v-if="loading" :size="14" />
          <template v-else>
            <n-icon :size="16">
              <VideocamOutline />
            </n-icon>
            Generate Video
          </template>
        </button>

        <!-- Error message | 错误信息 -->
        <div v-if="error" class="text-xs text-red-500 mt-2">
          {{ error.message || 'Generation failed' }}
        </div>

        <!-- Generated video preview | Generate VideoPreview -->
        <!-- <div v-if="generatedVideo?.url" class="mt-3 space-y-2">
        <div class="text-xs text-[var(--text-secondary)]">Result:</div>
        <div class="aspect-video rounded-lg overflow-hidden bg-black">
          <video :src="generatedVideo.url" controls class="w-full h-full object-contain" />
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
        class="action-btn group p-2 rounded-lg transition-all border border-[rgba(143,143,143,0.32)] flex items-center gap-0 hover:gap-1.5 w-max">
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
 * Video config node component | 视频配置节点组件
 * Configuration panel for video generation with API integration
 */
import { ref, computed, watch, onMounted } from 'vue'
import { Handle, Position, useVueFlow } from '@vue-flow/core'
import { NIcon, NSpin } from 'naive-ui'
import { BaseDropdown } from '@/components/ui'
import { ChevronForwardOutline, ChevronDownOutline, TrashOutline, VideocamOutline, CopyOutline } from '../../icons/coolicons'
import { useVideoGeneration, useApiConfig } from '../../hooks'
import { updateNode, removeNode, duplicateNode, addNode, addEdge, nodes, edges, saveProject, currentProjectId } from '../../stores/canvas'
import { videoModelOptions, getModelRatioOptions, getModelDurationOptions, getModelConfig, getModelVideoModeOptions, getModelVideoResolutionOptions, getModelVideoSizeOptions, getModelVideoTypeOptions, DEFAULT_VIDEO_MODEL, DEFAULT_VIDEO_DURATION, resolveVideoModelKey } from '../../stores/models'
import { persistMediaUrl } from '@/utils/media'
import { edgeStrategy, resolveNodeInputs } from '../../services/edgeStrategy'

const props = defineProps({
  id: String,
  data: Object
})

// Vue Flow instance | Vue Flow 实例
const { updateNodeInternals } = useVueFlow()

// API config hook | API 配置 hook
const { isConfigured } = useApiConfig()

// Video generation hook | Video Gen hook
const { loading, error, status, video: generatedVideo, progress, generate } = useVideoGeneration()

// Hover state | 悬浮状态
const showActions = ref(false)

// Local state | 本地状态
const localModel = ref(resolveVideoModelKey(props.data?.model || DEFAULT_VIDEO_MODEL))
const localRatio = ref(props.data?.ratio || '16:9')
const localSize = ref(props.data?.size || '')
const localResolution = ref(props.data?.resolution || getModelConfig(resolveVideoModelKey(props.data?.model || DEFAULT_VIDEO_MODEL))?.defaultParams?.resolution || '')
const localO1Type = ref('')
const localMode = ref('')
const localGenerateAudio = ref(Boolean(props.data?.generate_audio ?? props.data?.enable_audio ?? getModelConfig(resolveVideoModelKey(props.data?.model || DEFAULT_VIDEO_MODEL))?.defaultParams?.generate_audio ?? getModelConfig(resolveVideoModelKey(props.data?.model || DEFAULT_VIDEO_MODEL))?.defaultParams?.enable_audio ?? false))
const getDurationFromData = (data) => {
  const raw = data?.duration ?? data?.dur
  const parsed = Number(raw)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_VIDEO_DURATION
}
const localDuration = ref(getDurationFromData(props.data))
const getDefaultMode = (modelKey, data = props.data) => {
  const config = getModelConfig(modelKey)
  const options = getModelVideoModeOptions(modelKey)
  return String(data?.mode || config?.defaultParams?.mode || options[0]?.key || '').trim()
}
const getDefaultType = (modelKey, data = props.data) => {
  const config = getModelConfig(modelKey)
  const options = getModelVideoTypeOptions(modelKey)
  return String(data?.o1_type || config?.defaultParams?.o1_type || options[0]?.key || '').trim()
}
localMode.value = getDefaultMode(localModel.value)
localO1Type.value = getDefaultType(localModel.value)

// Get connected images with roles | 获取连接的图片及其角色
const connectedImages = computed(() => {
  const connectedEdges = edges.value.filter(e => e.target === props.id)
  const images = []

  for (const edge of connectedEdges) {
    const sourceNode = nodes.value.find(n => n.id === edge.source)
    if (sourceNode?.type === 'image' && sourceNode.data?.url) {
      images.push({
        nodeId: sourceNode.id,
        edgeId: edge.id,
        url: sourceNode.data.url,
        base64: sourceNode.data.base64,
        role: edge.data?.imageRole || 'first_frame_image' // Default to first frame | 默认First Frame
      })
    }
  }

  return images
})

// Get images by role | 按角色获取图片
const imagesByRole = computed(() => {
  const firstFrame = connectedImages.value.find(img => img.role === 'first_frame_image')
  const lastFrame = connectedImages.value.find(img => img.role === 'last_frame_image')
  const referenceImages = connectedImages.value.filter(img => img.role === 'input_reference')

  return {
    firstFrame,
    lastFrame,
    referenceImages
  }
})

// Get current model config | 获取当前Model配置
const currentModelConfig = computed(() => getModelConfig(localModel.value))
const ratioFromSize = (size) => {
  const [w, h] = String(size || '').split('x').map(Number)
  if (!w || !h) return '16:9'
  const gcd = (a, b) => (b ? gcd(b, a % b) : a)
  const d = gcd(w, h)
  return `${Math.round(w / d)}:${Math.round(h / d)}`
}
const audioOptions = [
  { key: 'off', label: 'Audio Off' },
  { key: 'on', label: 'Audio On' }
]

// Model options from store | 从 store 获取Model选项
const modelOptions = videoModelOptions

// Display model name | 显示Model名称
const displayModelName = computed(() => {
  const model = modelOptions.value.find(m => m.key === localModel.value)
  return model?.label || localModel.value || 'Select model'
})

// Ratio options based on model | 基于Model的Ratio选项
const ratioOptions = computed(() => {
  return getModelRatioOptions(localModel.value)
})
const modeOptions = computed(() => getModelVideoModeOptions(localModel.value))
const typeOptions = computed(() => getModelVideoTypeOptions(localModel.value))
const sizeOptions = computed(() => getModelVideoSizeOptions(localModel.value, localRatio.value))
const resolutionOptions = computed(() => getModelVideoResolutionOptions(localModel.value))
const supportsAudioToggle = computed(() => Boolean(currentModelConfig.value?.supportAudioToggle))
const displaySize = computed(() => String(localSize.value || '').trim() || 'Select size')
const displayResolution = computed(() => String(localResolution.value || '').trim() || 'Select resolution')
const displayType = computed(() => typeOptions.value.find(m => m.key === localO1Type.value)?.label || localO1Type.value || 'Select type')
const displayMode = computed(() => modeOptions.value.find(m => m.key === localMode.value)?.label || localMode.value || 'Select mode')
const displayAudio = computed(() => (localGenerateAudio.value ? 'Audio On' : 'Audio Off'))

// Duration options based on model | 基于Model的Duration选项
const durationOptions = computed(() => {
  return getModelDurationOptions(localModel.value)
})

// Handle model selection | 处理Model选择
const handleModelSelect = (key) => {
  localModel.value = key
  // Update ratio and duration to model's default | 更新为Model默认Ratio和Duration
  const config = getModelConfig(key)
  const updates = { model: key }
  if (config?.defaultParams?.ratio) {
    localRatio.value = config.defaultParams.ratio
    updates.ratio = config.defaultParams.ratio
  }
  localSize.value = config?.defaultParams?.size || ''
  localResolution.value = config?.defaultParams?.resolution || ''
  localO1Type.value = String(config?.defaultParams?.o1_type || typeOptions.value[0]?.key || '').trim()
  localMode.value = String(config?.defaultParams?.mode || modeOptions.value[0]?.key || '').trim()
  localGenerateAudio.value = Boolean(config?.defaultParams?.generate_audio ?? config?.defaultParams?.enable_audio ?? false)
  updates.size = localSize.value
  updates.resolution = localResolution.value
  updates.generate_audio = localGenerateAudio.value
  updates.enable_audio = localGenerateAudio.value
  updates.o1_type = localO1Type.value
  updates.mode = localMode.value
  if (config?.defaultParams?.duration) {
    const modelDurationOptions = getModelDurationOptions(key)
    const defaultDuration = Number(config.defaultParams.duration)
    const optionKeys = modelDurationOptions.map((item) => Number(item.key)).filter((v) => Number.isFinite(v))
    localDuration.value = optionKeys.includes(defaultDuration) ? defaultDuration : (optionKeys[0] || defaultDuration)
    updates.duration = localDuration.value
    updates.dur = localDuration.value
  }
  updateNode(props.id, updates)
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

// Handle ratio selection | 处理Ratio选择
const handleRatioSelect = (key) => {
  localRatio.value = key
  const option = sizeOptions.value.find((item) => item.ratio === key)
  if (option?.key) {
    localSize.value = option.key
  } else {
    localSize.value = ''
  }
  updateNode(props.id, { ratio: key, size: localSize.value })
}

const handleSizeSelect = (key) => {
  localSize.value = String(key || '')
  localRatio.value = ratioFromSize(localSize.value)
  updateNode(props.id, { size: localSize.value, ratio: localRatio.value })
}

const handleResolutionSelect = (key) => {
  localResolution.value = String(key || '')
  updateNode(props.id, { resolution: localResolution.value })
}

const handleModeSelect = (key) => {
  localMode.value = String(key || '')
  updateNode(props.id, { mode: localMode.value })
}

const handleTypeSelect = (key) => {
  localO1Type.value = String(key || '')
  updateNode(props.id, { o1_type: localO1Type.value })
}

const handleAudioSelect = (key) => {
  localGenerateAudio.value = key === 'on'
  updateNode(props.id, { generate_audio: localGenerateAudio.value, enable_audio: localGenerateAudio.value })
}

// Handle duration selection | 处理Duration选择
const handleDurationSelect = (key) => {
  const parsed = Number(key)
  if (!Number.isFinite(parsed) || parsed <= 0) return
  localDuration.value = parsed
  updateNode(props.id, { duration: parsed, dur: parsed })
}

// Get connected inputs by role | 根据角色获取连接的输入
const getConnectedInputs = () => {
  const resolved = resolveNodeInputs(props.id)
  return {
    prompt: resolved.prompt,
    first_frame_image: resolved.first_frame_image,
    last_frame_image: resolved.last_frame_image,
    images: resolved.images
  }
}

// Computed connected prompt | 计算连接的Prompt
const connectedPrompt = computed(() => {
  return getConnectedInputs().prompt
})

// Created video node ID | 创建的视频节点 ID
const createdVideoNodeId = ref(null)

// Handle generate action | 处理生成操作
const handleGenerate = async () => {
  const { prompt, first_frame_image, last_frame_image, images } = getConnectedInputs()

  const hasInput = prompt || first_frame_image || last_frame_image || images.length > 0
  if (!hasInput) {
    window.$message?.warning('Connect a text or image node first')
    return
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

  // Get current node position | 获取当前节点位置
  const currentNode = nodes.value.find(n => n.id === props.id)
  const nodeX = currentNode?.position?.x || 0
  const nodeY = currentNode?.position?.y || 0

  // Create video node with loading state | 创建带加载状态的视频节点
  const videoNodeId = addNode('video', { x: nodeX + 350, y: nodeY }, {
    url: '',
    loading: true,
    label: 'Generating video...'
  })
  createdVideoNodeId.value = videoNodeId

  // Auto-connect videoConfig → video | 自动连接 视频配置 → 视频
  addEdge(edgeStrategy.resolve({
    source: props.id,
    target: videoNodeId,
    sourceHandle: 'right',
    targetHandle: 'left'
  }))

  // Force Vue Flow to recalculate node dimensions | 强制 Vue Flow 重新计算节点Size
  setTimeout(() => {
    updateNodeInternals(videoNodeId)
  }, 50)

  try {
    // Build request params (raw form data) | 构建请求参数（原始表单数据）
    // These will be transformed by inputTransform | 这些会被 inputTransform 转换
    const params = {
      model: localModel.value
    }

    // Add prompt if provided | 如果有Prompt则添加
    if (prompt) {
      params.prompt = prompt
    }

    // Add first frame image | 添加First Frame图片
    if (first_frame_image) {
      params.first_frame_image = first_frame_image
    }

    // Add last frame image | 添加Last Frame图片
    if (last_frame_image) {
      params.last_frame_image = last_frame_image
    }

    // Add reference images (input_reference) | 添加Reference
    if (images.length > 0) {
      params.images = images
    }

    if (localO1Type.value) {
      params.o1_type = localO1Type.value
    }

    if (localMode.value) {
      params.mode = localMode.value
    }

    // Add ratio/size | 添加Ratio参数
    if (localRatio.value) {
      params.ratio = localRatio.value
    }

    if (localSize.value) {
      params.size = localSize.value
    }

    if (localResolution.value) {
      params.resolution = localResolution.value
    }

    if (supportsAudioToggle.value) {
      params.generate_audio = localGenerateAudio.value
      params.enable_audio = localGenerateAudio.value
    }

    // Add duration | 添加Duration
    if (localDuration.value) {
      params.duration = localDuration.value
    }

    const result = await generate(params)

    // Update video node with generated URL | 更新视频节点 URL
    if (result && result.url) {
      const rawUrl = String(result.url || '')
      if (!rawUrl) {
        throw new Error('No video output')
      }

      updateNode(videoNodeId, {
        url: rawUrl,
        loading: false,
        label: 'Video Gen',
        model: localModel.value,
        ratio: localRatio.value,
        o1_type: localO1Type.value,
        mode: localMode.value,
        size: localSize.value,
        resolution: localResolution.value,
        generate_audio: localGenerateAudio.value,
        enable_audio: localGenerateAudio.value,
        duration: localDuration.value,
        dur: localDuration.value,
        persistStatus: 'saving',
        persistError: '',
        updatedAt: Date.now()
      })
      
      // Mark this config node as executed | 标记配置节点已执行
      updateNode(props.id, { status: 'completed', executed: true, outputNodeId: videoNodeId, error: '' })
      const savedOk = await saveProject()
      updateNode(videoNodeId, {
        persistStatus: savedOk ? 'saved' : 'error',
        persistError: savedOk ? '' : 'Project save failed. Refresh may lose this video.',
        updatedAt: Date.now()
      })

      void persistMediaUrl(rawUrl, `generated-${Date.now()}.mp4`, {
        projectId: currentProjectId.value,
        source: 'video_generation',
        sourceNodeId: videoNodeId
      }).then(async (stableUrl) => {
        const finalUrl = String(stableUrl || '').trim()
        if (!finalUrl || finalUrl === rawUrl) return
        updateNode(videoNodeId, {
          url: finalUrl,
          persistStatus: 'saving',
          persistError: '',
          updatedAt: Date.now()
        })
        const persistedOk = await saveProject()
        updateNode(videoNodeId, {
          persistStatus: persistedOk ? 'saved' : 'error',
          persistError: persistedOk ? '' : 'Project save failed. Refresh may lose this video.',
          updatedAt: Date.now()
        })
      }).catch((persistError) => {
        console.warn('Video persistence skipped after preview became available:', persistError)
      })
    }
    window.$message?.success('Video generated')
  } catch (err) {
    updateNode(props.id, { status: 'failed', error: err.message || 'Generation failed' })
    // Update node to show error | 更新节点显示错误
    updateNode(videoNodeId, {
      loading: false,
      error: err.message || 'Generation failed',
      label: 'Generation failed',
      updatedAt: Date.now()
    })
    window.$message?.error(err.message || 'Video generation failed')
  }
}

// Handle delete | 处理删除
const handleDelete = () => {
  removeNode(props.id)
}

// Initialize on mount | 挂载时初始化
onMounted(() => {
  const resolvedModel = resolveVideoModelKey(localModel.value || DEFAULT_VIDEO_MODEL)
  if (resolvedModel !== localModel.value) {
    localModel.value = resolvedModel
    updateNode(props.id, { model: localModel.value })
  }
  localMode.value = getDefaultMode(localModel.value)
  localO1Type.value = getDefaultType(localModel.value)
})

// Watch for model changes from props | 监听 props 中Model变化
watch(() => props.data?.model, (newModel) => {
  const resolvedModel = resolveVideoModelKey(newModel || DEFAULT_VIDEO_MODEL)
  if (resolvedModel !== localModel.value) {
    localModel.value = resolvedModel
  }
  if (newModel && resolvedModel !== newModel) {
    updateNode(props.id, { model: resolvedModel })
  }
})

watch(() => props.data, (val) => {
  if (!val) return
  const resolvedModel = resolveVideoModelKey(val.model || DEFAULT_VIDEO_MODEL)
  if (resolvedModel !== localModel.value) localModel.value = resolvedModel
  if (val.ratio && val.ratio !== localRatio.value) localRatio.value = val.ratio
  if ((val.size || '') !== localSize.value) localSize.value = val.size || ''
  if ((val.resolution || '') !== localResolution.value) localResolution.value = val.resolution || ''
  if ((val.o1_type || '') !== localO1Type.value) localO1Type.value = val.o1_type || ''
  if ((val.mode || '') !== localMode.value) localMode.value = val.mode || ''
  if (typeof val.generate_audio === 'boolean' && val.generate_audio !== localGenerateAudio.value) {
    localGenerateAudio.value = val.generate_audio
  }
  if (typeof val.enable_audio === 'boolean' && val.enable_audio !== localGenerateAudio.value) {
    localGenerateAudio.value = val.enable_audio
  }
  const nextDuration = Number(val.duration ?? val.dur)
  if (Number.isFinite(nextDuration) && nextDuration > 0 && nextDuration !== localDuration.value) {
    localDuration.value = nextDuration
  }
}, { deep: true })

watch(
  typeOptions,
  () => {
    if (!typeOptions.value.length) {
      localO1Type.value = ''
      return
    }
    const current = String(localO1Type.value || '').trim()
    if (current && typeOptions.value.some((item) => item.key === current)) return
    localO1Type.value = getDefaultType(localModel.value)
  },
  { immediate: true }
)

watch(
  modeOptions,
  () => {
    if (!modeOptions.value.length) {
      localMode.value = ''
      return
    }
    const current = String(localMode.value || '').trim()
    if (current && modeOptions.value.some((item) => item.key === current)) return
    localMode.value = getDefaultMode(localModel.value)
  },
  { immediate: true }
)

watch(
  sizeOptions,
  () => {
    if (!sizeOptions.value.length) {
      localSize.value = ''
    }
  },
  { immediate: true }
)

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
.video-config-node-wrapper {
  position: relative;
  padding-top: 20px;
}

.video-config-node {
  cursor: default;
  position: relative;
}
</style>
