<template>
  <!-- Video config node wrapper | 视频配置节点包裹层 -->
  <div class="video-config-node-wrapper relative" @mouseenter="showActions = true" @mouseleave="showActions = false">
    <!-- Video config node | 视频配置节点 -->
    <ConfigNodeShell :selected="data.selected" class="video-config-node min-w-[300px]">
      <!-- Header | 头部 -->
      <ConfigNodeHeader :label="data.label || 'Video Gen'" @delete="handleDelete" />

      <!-- Config options | 配置选项 -->
      <ConfigNodeContent>
        <!-- Model selector | Model选择 -->
        <ConfigNodeDropdownRow label="Model" :options="modelOptions" icon="down" @select="handleModelSelect">
          {{ displayModelName }}
        </ConfigNodeDropdownRow>

        <!-- Aspect ratio selector | 宽高比选择 -->
        <ConfigNodeDropdownRow v-if="inputProfile.allowRatio" label="Ratio" :options="ratioOptions" @select="handleRatioSelect">
          {{ localRatio }}
        </ConfigNodeDropdownRow>

        <ConfigNodeDropdownRow v-if="inputProfile.allowSize && sizeOptions.length > 0" label="Size" :options="sizeOptions" @select="handleSizeSelect">
          {{ displaySize }}
        </ConfigNodeDropdownRow>

        <ConfigNodeDropdownRow v-if="inputProfile.allowResolution && resolutionOptions.length > 0" label="Resolution" :options="resolutionOptions" @select="handleResolutionSelect">
          {{ displayResolution }}
        </ConfigNodeDropdownRow>

        <ConfigNodeDropdownRow v-if="inputProfile.allowMode && modeOptions.length > 0" label="Mode" :options="modeOptions" @select="handleModeSelect">
          {{ displayMode }}
        </ConfigNodeDropdownRow>

        <ConfigNodeDropdownRow v-if="inputProfile.allowType && typeOptions.length > 0" label="Type" :options="typeOptions" @select="handleTypeSelect">
          {{ displayType }}
        </ConfigNodeDropdownRow>

        <ConfigNodeDropdownRow v-if="inputProfile.allowAudioToggle && supportsAudioToggle" label="Audio" :options="audioOptions" @select="handleAudioSelect">
          {{ displayAudio }}
        </ConfigNodeDropdownRow>

        <!-- Duration selector | Duration选择 -->
        <ConfigNodeDropdownRow v-if="inputProfile.allowDuration" label="Duration" :options="durationOptions" @select="handleDurationSelect">
          {{ localDuration }}s
        </ConfigNodeDropdownRow>

        <!-- Connected inputs indicator | 连接输入指示 -->
        <ConfigNodeConnectionStatus :items="connectionStatusItems" :wrap="true" />
        <!-- Generate button | 生成按钮 -->
        <ConfigNodePrimaryActionButton @click="handleGenerate" :disabled="loading || !isConfigured" emphasized>
          <n-spin v-if="loading" :size="14" />
          <template v-else>
            <n-icon :size="16">
              <VideocamOutline />
            </n-icon>
            Generate Video
          </template>
        </ConfigNodePrimaryActionButton>

        <!-- Error message | 错误信息 -->
        <ConfigNodeErrorMessage :error="error" />

      </ConfigNodeContent>

      <!-- Handles | 连接点 -->
      <ConfigNodeHandles />
    </ConfigNodeShell>

    <!-- Hover action buttons | 悬浮操作按钮 -->
    <ConfigNodeHoverActions :visible="showActions" wide @duplicate="handleDuplicate" />
  </div>
</template>

<script setup>
/**
 * Video config node component | 视频配置节点组件
 * Configuration panel for video generation with API integration
 */
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { useVueFlow } from '@vue-flow/core'
import { NIcon, NSpin } from 'naive-ui'
import { storeToRefs } from 'pinia'
import { VideocamOutline } from '@/icons/coolicons'
import { useVideoGeneration } from '@/hooks/api/useVideoApi.js'
import { useApiConfig } from '@/hooks/useApiConfig'
import { useCanvasStore } from '@/stores/canvas'
import { pinia } from '@/stores/pinia'
import { videoModelOptions, getModelRatioOptions, getModelDurationOptions, getModelConfig, getModelVideoModeOptions, getModelVideoResolutionOptions, getModelVideoSizeOptions, getModelVideoTypeOptions, getVideoGenerationProfile, resolveSeedanceGenerationType, DEFAULT_VIDEO_MODEL, DEFAULT_VIDEO_DURATION, resolveVideoModelKey } from '@/stores/models'
import { persistMediaUrl } from '@/utils/media'
import { getVisibleVideoConnectionStatusItems } from '@/utils/videoPreview'
import { edgeStrategy, resolveNodeInputs } from '@/services/edgeStrategy'
import ConfigNodeConnectionStatus from './config/ConfigNodeConnectionStatus.vue'
import ConfigNodeContent from './config/ConfigNodeContent.vue'
import ConfigNodeDropdownRow from './config/ConfigNodeDropdownRow.vue'
import ConfigNodeErrorMessage from './config/ConfigNodeErrorMessage.vue'
import ConfigNodeHandles from './config/ConfigNodeHandles.vue'
import ConfigNodeHeader from './config/ConfigNodeHeader.vue'
import ConfigNodeHoverActions from './config/ConfigNodeHoverActions.vue'
import ConfigNodePrimaryActionButton from './config/ConfigNodePrimaryActionButton.vue'
import ConfigNodeShell from './config/ConfigNodeShell.vue'

const props = defineProps({
  id: String,
  data: Object
})

// Vue Flow instance | Vue Flow 实例
const { updateNodeInternals } = useVueFlow()
const canvasStore = useCanvasStore(pinia)
const { currentProjectId, edges, nodes } = storeToRefs(canvasStore)
const { updateNode, removeNode, duplicateNode, addNode, addEdge, getAutoPlacementPosition, saveProject } = canvasStore

// API config hook | API 配置 hook
const { isConfigured } = useApiConfig()

// Video generation hook | Video Gen hook
const { loading, error, status, video: generatedVideo, progress, generate, stop } = useVideoGeneration()

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
  const referenceVideos = edges.value
    .filter(edge => edge.target === props.id)
    .map((edge) => {
      const sourceNode = nodes.value.find(node => node.id === edge.source)
      if (sourceNode?.type !== 'video' || !sourceNode.data?.url) return null
      return {
        nodeId: sourceNode.id,
        edgeId: edge.id,
        url: sourceNode.data.url,
        role: edge.data?.slot || 'video_reference'
      }
    })
    .filter(Boolean)

  return {
    firstFrame,
    lastFrame,
    referenceImages,
    referenceVideos
  }
})

// Get current model config | 获取当前Model配置
const currentModelConfig = computed(() => getModelConfig(localModel.value))
const effectiveGenerationType = computed(() => {
  if (localModel.value !== 'seedance-2.0') return localO1Type.value
  return resolveSeedanceGenerationType({
    firstFrameImage: imagesByRole.value.firstFrame?.url,
    lastFrameImage: imagesByRole.value.lastFrame?.url,
    referenceImages: imagesByRole.value.referenceImages.map((item) => item.url),
    referenceVideos: imagesByRole.value.referenceVideos.map((item) => item.url)
  })
})
const inputProfile = computed(() => getVideoGenerationProfile(localModel.value, effectiveGenerationType.value))
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
const generationTypeLabels = {
  text_to_video: 'Text to Video',
  first_last_frames: 'First + Last Frame',
  omni_reference: 'Omni Reference'
}

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
const displayType = computed(() => generationTypeLabels[effectiveGenerationType.value] || typeOptions.value.find(m => m.key === effectiveGenerationType.value)?.label || effectiveGenerationType.value || 'Select type')
const displayMode = computed(() => modeOptions.value.find(m => m.key === localMode.value)?.label || localMode.value || 'Select mode')
const displayAudio = computed(() => (localGenerateAudio.value ? 'Audio On' : 'Audio Off'))
const connectionStatusItems = computed(() => {
  return getVisibleVideoConnectionStatusItems({
    model: localModel.value,
    generationType: effectiveGenerationType.value,
    inputProfile: inputProfile.value,
    connected: {
      prompt: Boolean(connectedPrompt.value),
      firstFrame: Boolean(imagesByRole.value.firstFrame),
      lastFrame: Boolean(imagesByRole.value.lastFrame),
      referenceImageCount: imagesByRole.value.referenceImages.length,
      referenceVideoCount: imagesByRole.value.referenceVideos.length
    }
  })
})

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
    images: resolved.images,
    videos: resolved.videos
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
  const { prompt, first_frame_image, last_frame_image, images, videos } = getConnectedInputs()

  const hasInput = prompt || first_frame_image || last_frame_image || images.length > 0 || videos.length > 0
  if (!hasInput) {
    window.$message?.warning(inputProfile.value.allowVideoReference ? 'Connect a text, image, or video node first' : 'Connect a text or image node first')
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

  const videoNodeData = {
    url: '',
    previewUrl: '',
    loading: true,
    label: 'Generating video...',
    sourceConfigId: props.id
  }
  const videoNodePosition = getAutoPlacementPosition('video', { x: nodeX + 350, y: nodeY }, videoNodeData)
  const videoNodeId = addNode('video', videoNodePosition, videoNodeData)
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
      model: localModel.value,
      sourceNodeId: videoNodeId
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

    if (videos.length > 0) {
      params.videos = videos
    }

    params.o1_type = effectiveGenerationType.value || localO1Type.value || undefined

    if (inputProfile.value.allowMode && localMode.value) {
      params.mode = localMode.value
    }

    // Add ratio/size | 添加Ratio参数
    if (inputProfile.value.allowRatio && localRatio.value) {
      params.ratio = localRatio.value
    }

    if (inputProfile.value.allowSize && localSize.value) {
      params.size = localSize.value
    }

    if (inputProfile.value.allowResolution && localResolution.value) {
      params.resolution = localResolution.value
    }

    if (inputProfile.value.allowAudioToggle && supportsAudioToggle.value) {
      params.generate_audio = localGenerateAudio.value
      params.enable_audio = localGenerateAudio.value
    }

    // Add duration | 添加Duration
    if (inputProfile.value.allowDuration && localDuration.value) {
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
        url: '',
        previewUrl: rawUrl,
        loading: false,
        label: 'Video Gen',
        model: localModel.value,
        ratio: localRatio.value,
        o1_type: effectiveGenerationType.value,
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
      
      const stableUrl = await persistMediaUrl(rawUrl, `generated-${Date.now()}.mp4`, {
        projectId: currentProjectId.value,
        source: 'video_generation',
        sourceNodeId: videoNodeId
      })
      const finalUrl = String(stableUrl || rawUrl).trim()
      if (!finalUrl) {
        throw new Error('Video persistence failed')
      }
      updateNode(videoNodeId, {
        url: finalUrl,
        previewUrl: '',
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

onUnmounted(() => stop())

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
