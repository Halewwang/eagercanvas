import { computed, ref, watch } from 'vue'
import {
  getImageNodeAdvancedDropdownOptions,
  getImageNodeControlDisplayLabel,
  getImageNodeNearestSizeKey,
  getImageNodeOptionDisplayLabel,
  getImageNodeRatioDisplayLabel,
  getImageNodeRatioDropdownOptions,
  getImageNodeRatioFromSizeKey,
  getImageNodeResolutionDropdownOptions,
  getImageNodeResolutionFromSizeKey,
  getImageNodeSelectOptions,
  getImageNodeSizeMetaOptions,
  getImageNodeSizeSelection,
  getImageNodeStageStyle
} from '@/utils/imageNodeLayout'

export const GPT_IMAGE_2_RATIO_OPTIONS = [
  { key: '1:1', label: '1:1' },
  { key: '3:2', label: '3:2' },
  { key: '2:3', label: '2:3' },
  { key: '4:3', label: '4:3' },
  { key: '3:4', label: '3:4' },
  { key: '4:5', label: '4:5' },
  { key: '5:4', label: '5:4' },
  { key: '16:9', label: '16:9' },
  { key: '9:16', label: '9:16' },
  { key: '21:9', label: '21:9' }
]

const noop = () => {}
const identityPatch = (payload = {}) => payload

const readOption = (source) => {
  if (typeof source === 'function') return source()
  if (source && typeof source === 'object' && 'value' in source) return source.value
  return source
}

export const useImageNodeModelControls = ({
  buildModelParamsPatch = identityPatch,
  buildSizeParamsPatch = identityPatch,
  data,
  defaultImageModel = '',
  defaultImageSize = '1024x1024',
  getModelConfig = () => null,
  getModelSizeOptions = () => [],
  imageModelOptions = [],
  nodeId,
  resolveGptImage2Size,
  updateNode = noop
} = {}) => {
  const readData = () => readOption(data) || {}
  const readDefaultImageModel = () => readOption(defaultImageModel) || ''
  const readDefaultImageSize = () => readOption(defaultImageSize) || '1024x1024'
  const readImageModelOptions = () => readOption(imageModelOptions) || []
  const readNodeId = () => readOption(nodeId)

  const initialData = readData()
  const localImageModel = ref(initialData.model || readDefaultImageModel())
  const localImageSize = ref(initialData.size || readDefaultImageSize())
  const localImageQuality = ref(initialData.quality || 'standard')
  const localBackground = ref(initialData.background || 'auto')
  const localOutputFormat = ref(initialData.output_format || initialData.outputFormat || 'png')
  const localImageRatio = ref(initialData.ratio || getImageNodeRatioFromSizeKey(localImageSize.value))
  const localResolution = ref(initialData.resolution || getImageNodeResolutionFromSizeKey(localImageSize.value))

  const syncFromData = (nextData = {}) => {
    if (!nextData) return
    if (nextData.model && nextData.model !== localImageModel.value) localImageModel.value = nextData.model
    if (nextData.size && nextData.size !== localImageSize.value) localImageSize.value = nextData.size
    if (nextData.quality && nextData.quality !== localImageQuality.value) localImageQuality.value = nextData.quality
    if (nextData.background && nextData.background !== localBackground.value) localBackground.value = nextData.background
    const nextFormat = nextData.output_format || nextData.outputFormat
    if (nextFormat && nextFormat !== localOutputFormat.value) localOutputFormat.value = nextFormat
    localImageRatio.value = nextData.ratio || getImageNodeRatioFromSizeKey(localImageSize.value)
    localResolution.value = nextData.resolution || getImageNodeResolutionFromSizeKey(localImageSize.value)
  }

  watch(
    () => readData(),
    (nextData) => {
      syncFromData(nextData)
    },
    { deep: true }
  )

  const imageModelDropdownOptions = computed(() => getImageNodeSelectOptions(readImageModelOptions()))
  const currentImageModelConfig = computed(() => getModelConfig(localImageModel.value))
  const isGptImage2Model = computed(() => ['gpt-image-2', 'gpt-image-lite'].includes(localImageModel.value))
  const showAdvancedCapsuleParams = computed(() => currentImageModelConfig.value?.showAdvancedCapsuleParams === true)
  const imageSizeOptions = computed(() => getModelSizeOptions(localImageModel.value, localImageQuality.value))
  const sizeMetaOptions = computed(() => getImageNodeSizeMetaOptions(imageSizeOptions.value))

  const ratioDropdownOptions = computed(() => getImageNodeRatioDropdownOptions({
    isGptImage2Model: isGptImage2Model.value,
    gptImage2RatioOptions: GPT_IMAGE_2_RATIO_OPTIONS,
    hideRatioCapsule: currentImageModelConfig.value?.hideRatioCapsule,
    sizeMetaOptions: sizeMetaOptions.value
  }))

  const resolutionDropdownOptions = computed(() => getImageNodeResolutionDropdownOptions({
    modelResolutions: currentImageModelConfig.value?.resolutions,
    sizeMetaOptions: sizeMetaOptions.value,
    imageRatio: localImageRatio.value
  }))

  const displayImageModel = computed(() => getImageNodeOptionDisplayLabel(
    imageModelDropdownOptions.value,
    localImageModel.value
  ))
  const displayRatio = computed(() => getImageNodeRatioDisplayLabel({
    isGptImage2Model: isGptImage2Model.value,
    ratio: localImageRatio.value
  }))
  const displayResolution = computed(() => localResolution.value.toUpperCase())
  const qualityDropdownOptions = computed(() => getImageNodeAdvancedDropdownOptions({
    enabled: showAdvancedCapsuleParams.value,
    items: currentImageModelConfig.value?.qualities
  }))
  const displayQualityControl = computed(() => getImageNodeControlDisplayLabel({
    enabled: showAdvancedCapsuleParams.value,
    options: qualityDropdownOptions.value,
    value: localImageQuality.value,
    placeholderValue: 'auto',
    placeholderLabel: 'Quality'
  }))
  const backgroundDropdownOptions = computed(() => getImageNodeAdvancedDropdownOptions({
    enabled: showAdvancedCapsuleParams.value,
    items: currentImageModelConfig.value?.backgrounds
  }))
  const displayBackgroundControl = computed(() => getImageNodeControlDisplayLabel({
    enabled: showAdvancedCapsuleParams.value,
    options: backgroundDropdownOptions.value,
    value: localBackground.value,
    placeholderValue: 'auto',
    placeholderLabel: 'Background'
  }))
  const formatDropdownOptions = computed(() => getImageNodeAdvancedDropdownOptions({
    enabled: showAdvancedCapsuleParams.value,
    items: currentImageModelConfig.value?.outputFormats
  }))
  const displayFormatControl = computed(() => getImageNodeControlDisplayLabel({
    enabled: showAdvancedCapsuleParams.value,
    options: formatDropdownOptions.value,
    value: localOutputFormat.value,
    placeholderValue: 'png',
    placeholderLabel: 'Format'
  }))
  const stageStyle = computed(() => getImageNodeStageStyle({
    ratio: localImageRatio.value,
    size: localImageSize.value
  }))
  const moduleStyle = computed(() => ({ width: `calc(${stageStyle.value.width} + 2px)` }))

  const pickNearestSizeKey = (ratioKey, resolutionKey) => {
    const picked = getImageNodeSizeSelection({
      ratioKey,
      resolutionKey,
      isGptImage2Model: isGptImage2Model.value,
      sizeMetaOptions: sizeMetaOptions.value,
      defaultImageSize: readDefaultImageSize(),
      resolveGptImage2Size
    })
    if (picked.ratio) localImageRatio.value = picked.ratio
    if (picked.resolution) localResolution.value = picked.resolution
    return picked.key
  }

  const findNearestSizeKey = (ratioKey, resolutionKey) => {
    return getImageNodeNearestSizeKey({
      ratioKey,
      resolutionKey,
      isGptImage2Model: isGptImage2Model.value,
      sizeMetaOptions: sizeMetaOptions.value,
      defaultImageSize: readDefaultImageSize(),
      resolveGptImage2Size
    })
  }

  const setImageModel = (key) => {
    localImageModel.value = key
    const config = getModelConfig(key)
    localImageSize.value = config?.defaultParams?.size || localImageSize.value || readDefaultImageSize()
    localImageQuality.value = config?.defaultParams?.quality || localImageQuality.value
    localBackground.value = config?.defaultParams?.background || localBackground.value
    localOutputFormat.value = config?.defaultParams?.output_format || localOutputFormat.value
    localImageRatio.value = getImageNodeRatioFromSizeKey(localImageSize.value)
    localResolution.value = getImageNodeResolutionFromSizeKey(localImageSize.value)
    localImageSize.value = pickNearestSizeKey(localImageRatio.value, localResolution.value)
    updateNode(readNodeId(), buildModelParamsPatch({
      model: localImageModel.value,
      size: localImageSize.value,
      quality: localImageQuality.value,
      background: localBackground.value,
      outputFormat: localOutputFormat.value,
      ratio: localImageRatio.value,
      resolution: localResolution.value
    }))
  }

  const setImageRatio = (ratioKey) => {
    localImageSize.value = pickNearestSizeKey(ratioKey, localResolution.value)
    updateNode(readNodeId(), buildSizeParamsPatch({
      size: localImageSize.value,
      ratio: localImageRatio.value,
      resolution: localResolution.value
    }))
  }

  const setResolution = (resolutionKey) => {
    localImageSize.value = pickNearestSizeKey(localImageRatio.value, resolutionKey)
    updateNode(readNodeId(), buildSizeParamsPatch({
      size: localImageSize.value,
      ratio: localImageRatio.value,
      resolution: localResolution.value
    }))
  }

  const setImageQuality = (quality) => {
    localImageQuality.value = quality
    updateNode(readNodeId(), { quality })
  }

  const setBackground = (background) => {
    localBackground.value = background
    updateNode(readNodeId(), { background })
  }

  const setOutputFormat = (format) => {
    localOutputFormat.value = format
    updateNode(readNodeId(), { output_format: format })
  }

  return {
    backgroundDropdownOptions,
    displayBackgroundControl,
    displayFormatControl,
    displayImageModel,
    displayQualityControl,
    displayRatio,
    displayResolution,
    findNearestSizeKey,
    formatDropdownOptions,
    imageModelDropdownOptions,
    imageSizeOptions,
    localBackground,
    localImageModel,
    localImageQuality,
    localImageRatio,
    localImageSize,
    localOutputFormat,
    localResolution,
    moduleStyle,
    qualityDropdownOptions,
    ratioDropdownOptions,
    resolutionDropdownOptions,
    setBackground,
    setImageModel,
    setImageQuality,
    setImageRatio,
    setOutputFormat,
    setResolution,
    stageStyle
  }
}
