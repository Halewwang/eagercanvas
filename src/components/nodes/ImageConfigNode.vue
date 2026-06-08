<template>
  <!-- Image config node wrapper for hover area | Text to Image配置节点包裹层，扩展悬浮区域 -->
  <div class="image-config-node-wrapper" @mouseenter="showActions = true" @mouseleave="showActions = false">
    <!-- Image config node | Text to Image配置节点 -->
    <ConfigNodeShell :selected="data.selected" class="image-config-node min-w-[300px]">
      <!-- Header | 头部 -->
      <ConfigNodeHeader :label="data.label" @delete="handleDelete">
        <template #actions>
          <BaseDropdown :options="modelOptions" compact @select="handleModelSelect">
            <ConfigNodeIconButton>
              <ChevronDownOutline />
            </ConfigNodeIconButton>
          </BaseDropdown>
        </template>
      </ConfigNodeHeader>

      <!-- Config options | 配置选项 -->
      <ConfigNodeContent>
        <!-- Model selector | Model选择 -->
        <ConfigNodeDropdownRow label="Model" :options="modelOptions" icon="down" @select="handleModelSelect">
          {{ displayModelName }}
        </ConfigNodeDropdownRow>

        <!-- Quality selector | Quality选择 -->
        <ConfigNodeDropdownRow v-if="hasQualityOptions" label="Quality" :options="qualityOptions" @select="handleQualitySelect">
          {{ displayQuality }}
        </ConfigNodeDropdownRow>

        <ConfigNodeDropdownRow v-if="backgroundOptions.length > 0" label="Background" :options="backgroundOptions" @select="handleBackgroundSelect">
          {{ displayBackground }}
        </ConfigNodeDropdownRow>

        <ConfigNodeDropdownRow v-if="formatOptions.length > 0" label="Format" :options="formatOptions" @select="handleFormatSelect">
          {{ displayFormat }}
        </ConfigNodeDropdownRow>

        <!-- Size selector | Size选择 -->
        <ConfigNodeDropdownRow v-if="hasSizeOptions" label="Size" :options="sizeOptions" @select="handleSizeSelect">
          {{ displaySize }}
        </ConfigNodeDropdownRow>

        <!-- Model tips | Model提示 -->
        <ConfigNodeTipMessage v-if="currentModelConfig?.tips" :message="currentModelConfig.tips" />

        <!-- Connected inputs indicator | 连接输入指示 -->
        <ConfigNodeConnectionStatus :items="connectionStatusItems" />

        <!-- Generate button | 生成按钮 -->
        <ConfigNodeSplitActions
          v-if="hasConnectedImageWithContent"
          :disabled="loading || !isConfigured"
          @primary="handleGenerate('new')"
          @secondary="handleGenerate('replace')"
        >
          <template #primary>
            <n-spin v-if="loading" :size="14" />
            <template v-else>
              <n-icon :size="14"><AddOutline /></n-icon>
              Generate New
            </template>
          </template>
          <template #secondary>
            <n-spin v-if="loading" :size="14" />
            <template v-else>
              <n-icon :size="14"><RefreshOutline /></n-icon>
              Replace
            </template>
          </template>
        </ConfigNodeSplitActions>
        <ConfigNodePrimaryActionButton v-else @click="handleGenerate('auto')" :disabled="loading || !isConfigured" emphasized>
          <n-spin v-if="loading" :size="14" />
          <template v-else>
            <span class="text-[#090b0d] bg-[rgba(232,224,214,0.78)] rounded-full w-4 h-4 flex items-center justify-center text-xs">◆</span>
            Generate Now
          </template>
        </ConfigNodePrimaryActionButton>

        <!-- Error message | 错误信息 -->
        <ConfigNodeErrorMessage :error="error" />

      </ConfigNodeContent>

      <!-- Handles | 连接点 -->
      <ConfigNodeHandles />
    </ConfigNodeShell>

    <!-- Hover action buttons | 悬浮操作按钮 -->
    <ConfigNodeHoverActions :visible="showActions" @duplicate="handleDuplicate" />
  </div>
</template>

<script setup>
/**
 * Image config node component | Text to Image配置节点组件
 * Configuration panel for text-to-image generation with API integration
 */
import { ref, computed, watch, onMounted } from 'vue'
import { useVueFlow } from '@vue-flow/core'
import { NIcon, NSpin } from 'naive-ui'
import { storeToRefs } from 'pinia'
import { BaseDropdown } from '@/components/ui'
import { ChevronDownOutline, RefreshOutline, AddOutline } from '@/icons/coolicons'
import { useImageGeneration } from '@/hooks/api/useImageApi.js'
import { useApiConfig } from '@/hooks/useApiConfig'
import { useCanvasStore } from '@/stores/canvas'
import { pinia } from '@/stores/pinia'
import { imageModelOptions, getModelSizeOptions, getModelQualityOptions, getModelConfig, DEFAULT_IMAGE_MODEL } from '@/stores/models'
import { persistImageUrl } from '@/utils/media'
import { edgeStrategy, resolveNodeInputs } from '@/services/edgeStrategy'
import ConfigNodeConnectionStatus from './config/ConfigNodeConnectionStatus.vue'
import ConfigNodeContent from './config/ConfigNodeContent.vue'
import ConfigNodeDropdownRow from './config/ConfigNodeDropdownRow.vue'
import ConfigNodeErrorMessage from './config/ConfigNodeErrorMessage.vue'
import ConfigNodeHandles from './config/ConfigNodeHandles.vue'
import ConfigNodeHeader from './config/ConfigNodeHeader.vue'
import ConfigNodeHoverActions from './config/ConfigNodeHoverActions.vue'
import ConfigNodeIconButton from './config/ConfigNodeIconButton.vue'
import ConfigNodePrimaryActionButton from './config/ConfigNodePrimaryActionButton.vue'
import ConfigNodeShell from './config/ConfigNodeShell.vue'
import {
  getImageConfigRatioFromSizeKey as ratioFromSizeKey,
  getImageConfigResolutionFromSizeKey as resolutionFromSizeKey,
  resolveImageConfigSizeSelection
} from './config/ImageConfigSizeOptions.js'
import ConfigNodeSplitActions from './config/ConfigNodeSplitActions.vue'
import ConfigNodeTipMessage from './config/ConfigNodeTipMessage.vue'

const props = defineProps({
  id: String,
  data: Object
})

// Vue Flow instance | Vue Flow 实例
const { updateNodeInternals } = useVueFlow()
const canvasStore = useCanvasStore(pinia)
const { currentProjectId, edges, nodes, projectSaveState } = storeToRefs(canvasStore)
const { updateNode, addNode, addEdge, duplicateNode, getAutoPlacementPosition, removeNode, saveProject } = canvasStore

// API config hook | API 配置 hook
const { isConfigured } = useApiConfig()

// Image generation hook | Image Gen hook
const { loading, error, images: generatedImages, generate } = useImageGeneration()

// Hover state | 悬浮状态
const showActions = ref(false)

// Local state | 本地状态
const localModel = ref(props.data?.model || DEFAULT_IMAGE_MODEL)
const localSize = ref(props.data?.size || '1024x1024')
const localQuality = ref(props.data?.quality || 'standard')
const localBackground = ref(props.data?.background || 'auto')
const localOutputFormat = ref(props.data?.output_format || props.data?.outputFormat || 'png')
const localRatio = ref(props.data?.ratio || '1:1')
const localResolution = ref(props.data?.resolution || '1k')

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

const backgroundOptions = computed(() => {
  const options = Array.isArray(currentModelConfig.value?.backgrounds) ? currentModelConfig.value.backgrounds : []
  return options.map((item) => ({ key: item.key, label: item.label || item.key }))
})

const displayBackground = computed(() => {
  const option = backgroundOptions.value.find(o => o.key === localBackground.value)
  return option?.label || localBackground.value
})

const formatOptions = computed(() => {
  const options = Array.isArray(currentModelConfig.value?.outputFormats) ? currentModelConfig.value.outputFormats : []
  return options.map((item) => ({ key: item.key, label: item.label || item.key }))
})

const displayFormat = computed(() => {
  const option = formatOptions.value.find(o => o.key === localOutputFormat.value)
  return option?.label || localOutputFormat.value
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

const applyNearestSizeSelection = (ratioKey, resolutionKey) => {
  const selection = resolveImageConfigSizeSelection({
    sizeOptions: sizeOptions.value,
    currentSize: localSize.value,
    ratio: ratioKey,
    resolution: resolutionKey
  })
  localSize.value = selection.size
  localRatio.value = selection.ratio
  localResolution.value = selection.resolution
  return selection.size
}

localRatio.value = props.data?.ratio || ratioFromSizeKey(localSize.value)
localResolution.value = props.data?.resolution || resolutionFromSizeKey(localSize.value)

// Initialize on mount | 挂载时初始化
onMounted(() => {
  // Set default model if not set | 如果未设置则设置默认Model
  if (!localModel.value) {
    localModel.value = DEFAULT_IMAGE_MODEL
    updateNode(props.id, { model: localModel.value })
  }
})

watch(
  () => props.data,
  (val) => {
    if (!val) return
    if (val.model && val.model !== localModel.value) localModel.value = val.model
    if (val.size && val.size !== localSize.value) localSize.value = val.size
    if (val.quality && val.quality !== localQuality.value) localQuality.value = val.quality
    if (val.background && val.background !== localBackground.value) localBackground.value = val.background
    const nextFormat = val.output_format || val.outputFormat
    if (nextFormat && nextFormat !== localOutputFormat.value) localOutputFormat.value = nextFormat
    localRatio.value = val.ratio || ratioFromSizeKey(localSize.value)
    localResolution.value = val.resolution || resolutionFromSizeKey(localSize.value)
  },
  { deep: true }
)

// Get connected nodes | 获取连接的节点
const getConnectedInputs = () => {
  const resolved = resolveNodeInputs(props.id)
  return {
    prompt: resolved.prompt,
    prompts: resolved.prompts.map((item) => ({
      order: item.order,
      content: item.content,
      nodeId: item.nodeId
    })),
    refImages: resolved.refImages,
    refImagesWithOrder: resolved.references.map((item) => ({
      order: item.order,
      imageData: item.imageData,
      nodeId: item.nodeId
    }))
  }
}

// Computed connected prompts (sorted by order) | 计算连接的Prompt（按顺序排列）
const connectedPrompts = computed(() => {
  return getConnectedInputs().prompts
})

// Computed connected reference images | 计算连接的Reference
const connectedRefImages = computed(() => {
  return getConnectedInputs().refImages
})

const connectionStatusItems = computed(() => [
  {
    key: 'prompt',
    label: `Prompt ${connectedPrompts.value.length > 0 ? `${connectedPrompts.value.length} items` : '○'}`,
    active: connectedPrompts.value.length > 0
  },
  currentModelConfig.value?.supportImageReference
    ? {
        key: 'reference',
        label: `Reference ${connectedRefImages.value.length > 0 ? `${connectedRefImages.value.length} images` : '○'}`,
        active: connectedRefImages.value.length > 0
      }
    : null
].filter(Boolean))

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
  if (config?.defaultParams?.background) {
    localBackground.value = config.defaultParams.background
    updates.background = config.defaultParams.background
  }
  if (config?.defaultParams?.output_format) {
    localOutputFormat.value = config.defaultParams.output_format
    updates.output_format = config.defaultParams.output_format
  }
  localRatio.value = ratioFromSizeKey(localSize.value)
  localResolution.value = resolutionFromSizeKey(localSize.value)
  localSize.value = applyNearestSizeSelection(localRatio.value, localResolution.value)
  updates.size = localSize.value
  updates.ratio = localRatio.value
  updates.resolution = localResolution.value
  updateNode(props.id, updates)
}

// Handle quality selection | 处理Quality选择
const handleQualitySelect = (quality) => {
  localQuality.value = quality
  localRatio.value = ratioFromSizeKey(localSize.value)
  localResolution.value = resolutionFromSizeKey(localSize.value)
  localSize.value = applyNearestSizeSelection(localRatio.value, localResolution.value)
  updateNode(props.id, {
    quality,
    size: localSize.value,
    ratio: localRatio.value,
    resolution: localResolution.value
  })
}

const handleBackgroundSelect = (background) => {
  localBackground.value = background
  updateNode(props.id, { background })
}

const handleFormatSelect = (format) => {
  localOutputFormat.value = format
  updateNode(props.id, { output_format: format })
}

// Handle size selection | 处理Size选择
const handleSizeSelect = (size) => {
  localSize.value = size
  localRatio.value = ratioFromSizeKey(size)
  localResolution.value = resolutionFromSizeKey(size)
  updateNode(props.id, {
    size,
    ratio: localRatio.value,
    resolution: localResolution.value
  })
}

// Update size from manual input | 更新手动输入的Size
const updateSize = () => {
  localRatio.value = ratioFromSizeKey(localSize.value)
  localResolution.value = resolutionFromSizeKey(localSize.value)
  updateNode(props.id, {
    size: localSize.value,
    ratio: localRatio.value,
    resolution: localResolution.value
  })
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
      const targetUrl = String(targetNode?.data?.previewUrl || targetNode?.data?.url || '').trim()
      if (onlyEmpty) {
        // Check if target is an image node with empty or no url | 检查目标是否为空白图片节点
        if (!targetUrl) {
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
    const targetUrl = String(targetNode?.data?.previewUrl || targetNode?.data?.url || '').trim()
    if (targetNode?.type === 'image' && targetUrl) {
      return true
    }
  }
  return false
})

const resolveImagePersistence = async (rawValue, fileName, persistenceFailureMessage, sourceNodeId = props.id) => {
  const rawUrl = String(rawValue || '').trim()
  if (!rawUrl) {
    throw new Error('No image output')
  }

  try {
    const stableUrl = await persistImageUrl(rawUrl, fileName, {
      projectId: currentProjectId.value,
      source: 'image_generation',
      sourceNodeId
    })
    if (stableUrl) {
      return {
        persistedUrl: stableUrl,
        displayUrl: stableUrl,
        persisted: true
      }
    }
  } catch (error) {
    if (!rawUrl.startsWith('data:image/') && /^https?:\/\//i.test(rawUrl)) {
      console.warn('Image config persistence failed, keeping preview only:', error)
      return {
        persistedUrl: '',
        displayUrl: rawUrl,
        persisted: false
      }
    }
    throw error
  }

  if (rawUrl.startsWith('data:image/')) {
    throw new Error(persistenceFailureMessage)
  }

  return {
    persistedUrl: '',
    displayUrl: rawUrl,
    persisted: false
  }
}

const getCanvasSaveSnapshot = () => {
  const state = projectSaveState.value || {}
  return {
    localSaved: !!state.localSaved,
    remoteSynced: !!state.remoteSynced,
    hasTransientMedia: !!state.hasTransientMedia
  }
}

const resolveImageSaveFeedback = (savedOk) => {
  const snapshot = getCanvasSaveSnapshot()

  if (savedOk || snapshot.remoteSynced) {
    return {
      persistStatus: 'saved',
      persistError: '',
      mode: 'synced'
    }
  }

  if (snapshot.localSaved && !snapshot.hasTransientMedia) {
    return {
      persistStatus: 'saved',
      persistError: '',
      mode: 'local-only'
    }
  }

  if (snapshot.hasTransientMedia) {
    return {
      persistStatus: 'error',
      persistError: 'Image uses a temporary address and was not fully saved.',
      mode: 'temporary'
    }
  }

  return {
    persistStatus: 'error',
    persistError: 'Project save failed. Refresh may lose this image.',
    mode: 'failed'
  }
}

const getImageNodeDisplayUrl = (imageNodeId) => {
  const imageNode = nodes.value.find((node) => node.id === imageNodeId)
  return String(imageNode?.data?.previewUrl || imageNode?.data?.url || imageNode?.data?.base64 || '').trim()
}

const persistGeneratedImageResultInBackground = async ({
  imageNodeId,
  rawUrl,
  sourcePrompt,
  sourceRefImages
}) => {
  try {
    const persistence = await resolveImagePersistence(
      rawUrl,
      `generated-${Date.now()}.png`,
      'Generated image persistence failed. Please retry.',
      imageNodeId
    )

    if (getImageNodeDisplayUrl(imageNodeId) !== rawUrl) {
      return
    }

    updateNode(imageNodeId, {
      url: persistence.persistedUrl,
      previewUrl: persistence.persisted ? '' : persistence.displayUrl,
      base64: '',
      loading: false,
      label: 'Text to Image',
      model: localModel.value,
      size: localSize.value,
      quality: localQuality.value,
      background: localBackground.value,
      output_format: localOutputFormat.value,
      ratio: localRatio.value || ratioFromSizeKey(localSize.value),
      resolution: localResolution.value || resolutionFromSizeKey(localSize.value),
      sourceConfigId: props.id,
      sourcePrompt,
      sourceRefImages,
      persistStatus: persistence.persisted ? 'saving' : 'pending',
      persistError: persistence.persisted ? '' : 'Image uses a temporary address until it is fully saved.',
      updatedAt: Date.now()
    })

    if (!persistence.persisted) {
      window.$message?.warning('Image generated, but the result is still temporary. Refresh may lose it.')
      return
    }

    const savedOk = await saveProject()
    const saveFeedback = resolveImageSaveFeedback(savedOk)
    updateNode(imageNodeId, {
      persistStatus: saveFeedback.persistStatus,
      persistError: saveFeedback.persistError,
      updatedAt: Date.now()
    })
    if (saveFeedback.mode === 'temporary') {
      window.$message?.warning('Image generated, but the result is still temporary. Refresh may lose it.')
      return
    }
    if (saveFeedback.mode === 'failed') {
      window.$message?.warning('Image generated, but project save failed. Please retry save.')
      return
    }
    if (saveFeedback.mode === 'local-only') {
      window.$message?.success('Image generated and saved in the current project')
      return
    }
    if (!savedOk) {
      const saveState = projectSaveState.value || {}
      if (saveState.hasTransientMedia) {
        window.$message?.warning('Image generated, but the result is still temporary. Refresh may lose it.')
      } else {
        window.$message?.warning('Image generated, but project save failed. Please retry save.')
      }
    }
  } catch (error) {
    if (getImageNodeDisplayUrl(imageNodeId) !== rawUrl) {
      return
    }
    console.warn('Image config background persistence failed, keeping preview only:', error)
    updateNode(imageNodeId, {
      loading: false,
      persistStatus: 'error',
      persistError: error?.message || 'Generated image persistence failed. Please retry.',
      updatedAt: Date.now()
    })
    window.$message?.warning('Image generated, but the result is still temporary. Refresh may lose it.')
  }
}

// Handle generate action | 处理生成操作
// mode: 'auto' = 自动判断, 'replace' = Replace现有, 'new' = 新建节点
const handleGenerate = async (mode = 'auto') => {
  const { prompt, prompts, refImages, refImagesWithOrder } = getConnectedInputs()

  if (!prompt && refImages.length === 0) {
    window.$message?.warning('Connect a text prompt or reference image first')
    return
  }
  
  if (import.meta.env.DEV && prompts.length > 1) {
    console.debug('[ImageConfigNode] 拼接Prompt顺序:', prompts.map(p => `${p.order}: ${p.content.substring(0, 20)}...`))
  }
  
  if (import.meta.env.DEV && refImagesWithOrder && refImagesWithOrder.length > 1) {
    console.debug('[ImageConfigNode] Reference顺序:', refImagesWithOrder.map(r => `${r.order}: ${r.nodeId}`))
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

    const imageNodeData = {
      url: '',
      loading: true,
      label: 'Image Result'
    }
    const imageNodePosition = getAutoPlacementPosition('image', { x: nodeX + 400, y: nodeY + yOffset }, imageNodeData)
    imageNodeId = addNode('image', imageNodePosition, imageNodeData)

    // Auto-connect imageConfig → image | 自动连接 生图配置 → 图片
    addEdge(edgeStrategy.resolve({
      source: props.id,
      target: imageNodeId,
      sourceHandle: 'right',
      targetHandle: 'left'
    }))
  }
  
  createdImageNodeId.value = imageNodeId

  // Force Vue Flow to recalculate node dimensions | 强制 Vue Flow 重新计算节点Size
  setTimeout(() => {
    updateNodeInternals(imageNodeId)
  }, 50)

  try {
    const sourcePrompt = String(prompt || '').trim()
    const sourceRefImages = Array.isArray(refImages) ? [...refImages] : []

    // Build request params | 构建请求参数
    const params = {
      model: localModel.value,
      prompt: sourcePrompt,
      projectId: currentProjectId.value,
      sourceNodeId: imageNodeId,
      n: 1,
      ratio: localRatio.value || ratioFromSizeKey(localSize.value),
      aspect_ratio: localRatio.value || ratioFromSizeKey(localSize.value),
      resolution: localResolution.value || resolutionFromSizeKey(localSize.value)
    }

    if (hasSizeOptions.value && localSize.value) {
      params.size = localSize.value
    }
    if (hasQualityOptions.value && localQuality.value) {
      params.quality = localQuality.value
    }
    if (backgroundOptions.value.length > 0 && localBackground.value) {
      params.background = localBackground.value
    }
    if (formatOptions.value.length > 0 && localOutputFormat.value) {
      params.output_format = localOutputFormat.value
      if (['jpeg', 'webp'].includes(String(localOutputFormat.value).toLowerCase())) {
        params.output_compression = 100
      }
      params.moderation = 'auto'
    }

    // Add reference image if provided | 如果有Reference则添加
    if (refImages.length > 0) {
      params.image = refImages
    }

    const result = await generate(params)

    // Update image node with generated URL | 更新图片节点 URL
    if (result && result.length > 0) {
      const rawUrl = String(result[0].url || '').trim()
      if (!rawUrl) {
        throw new Error('No image output')
      }

      updateNode(imageNodeId, {
        url: '',
        previewUrl: rawUrl,
        base64: '',
        loading: false,
        label: 'Text to Image',
        model: localModel.value,
        size: localSize.value,
        quality: localQuality.value,
        background: localBackground.value,
        output_format: localOutputFormat.value,
        ratio: localRatio.value || ratioFromSizeKey(localSize.value),
        resolution: localResolution.value || resolutionFromSizeKey(localSize.value),
        sourceConfigId: props.id,
        sourcePrompt,
        sourceRefImages,
        persistStatus: 'pending',
        persistError: 'Image is being saved in the background.',
        updatedAt: Date.now()
      })
      
      // Mark this config node as executed | 标记配置节点已执行
      updateNode(props.id, { status: 'completed', executed: true, outputNodeId: imageNodeId, error: '' })
      void persistGeneratedImageResultInBackground({
        imageNodeId,
        rawUrl,
        sourcePrompt,
        sourceRefImages
      })
    }
    window.$message?.success('Image generated')
  } catch (err) {
    updateNode(props.id, { status: 'failed', error: err.message || 'Generation failed' })
    // Update node to show error | 更新节点显示错误
    updateNode(imageNodeId, {
      loading: false,
      error: err.message || 'Generation failed',
      persistStatus: 'error',
      persistError: err.message || 'Generation failed',
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
