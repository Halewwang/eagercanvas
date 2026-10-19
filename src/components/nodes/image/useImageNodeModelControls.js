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
  naturalSize,
  resolveGptImage2Size,
  updateNode = noop
} = {}) => {
  const readData = () => readOption(data) || {}
  const readDefaultImageModel = () => readOption(defaultImageModel) || ''
  const readDefaultImageSize = () => readOption(defaultImageSize) || '1024x1024'
  const readImageModelOptions = () => readOption(imageModelOptions) || []
  const resolveModel = (key) => readImageModelOptions().some((model) => model.key === key)
    ? key
    : readDefaultImageModel()
  const readNodeId = () => readOption(nodeId)

  const initialData = readData()
  const localImageModel = ref(resolveModel(initialData.model))
  const localImageSize = ref(getModelConfig(localImageModel.value)?.sizes?.length ? initialData.size || readDefaultImageSize() : '')
  const resolveQuality = (quality) => {
    const config = getModelConfig(localImageModel.value)
    if (!config?.qualities?.length) return ''
    return config.qualities.some((item) => item.key === quality)
      ? quality
      : config?.defaultParams?.quality || quality || 'auto'
  }
  const localImageQuality = ref(resolveQuality(initialData.quality))
  const resolveBackground = (background) => {
    const config = getModelConfig(localImageModel.value)
    return config?.backgrounds?.some((item) => item.key === background) ? background : config?.defaultParams?.background || ''
  }
  const localBackground = ref(resolveBackground(initialData.background))
  const localOutputFormat = ref(getModelConfig(localImageModel.value)?.outputFormats?.length > 1 ? initialData.output_format || initialData.outputFormat || 'png' : '')
  const localImageRatio = ref(getModelConfig(localImageModel.value)?.ratios?.length ? initialData.ratio || getImageNodeRatioFromSizeKey(localImageSize.value) : '')
  const localResolution = ref(getModelConfig(localImageModel.value)?.resolutions?.length ? initialData.resolution || getImageNodeResolutionFromSizeKey(localImageSize.value) : '')

  const syncFromData = (nextData = {}) => {
    if (!nextData) return
    localImageModel.value = resolveModel(nextData.model)
    localImageSize.value = getModelConfig(localImageModel.value)?.sizes?.length ? nextData.size || readDefaultImageSize() : ''
    localImageQuality.value = resolveQuality(nextData.quality)
    localBackground.value = resolveBackground(nextData.background)
    const nextFormat = nextData.output_format || nextData.outputFormat
    localOutputFormat.value = getModelConfig(localImageModel.value)?.outputFormats?.length > 1 ? nextFormat || '' : ''
    localImageRatio.value = getModelConfig(localImageModel.value)?.ratios?.length ? nextData.ratio || getImageNodeRatioFromSizeKey(localImageSize.value) : ''
    localResolution.value = getModelConfig(localImageModel.value)?.resolutions?.length ? nextData.resolution || getImageNodeResolutionFromSizeKey(localImageSize.value) : ''
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
  const isGptImage2Model = computed(() => localImageModel.value === 'gpt-image-2')
  const showAdvancedCapsuleParams = computed(() => currentImageModelConfig.value?.showAdvancedCapsuleParams === true)
  const imageSizeOptions = computed(() => getModelSizeOptions(localImageModel.value, localImageQuality.value))
  const sizeMetaOptions = computed(() => getImageNodeSizeMetaOptions(imageSizeOptions.value))

  const ratioDropdownOptions = computed(() => getImageNodeRatioDropdownOptions({
    modelRatios: currentImageModelConfig.value?.ratios,
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
    size: localImageSize.value,
    naturalSize: readOption(naturalSize)
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
    if (!imageSizeOptions.value.length) return ''
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
    localImageModel.value = resolveModel(key)
    const config = getModelConfig(localImageModel.value)
    localImageSize.value = config?.sizes?.length ? config.defaultParams?.size || localImageSize.value || readDefaultImageSize() : ''
    localImageQuality.value = resolveQuality(config?.defaultParams?.quality)
    localBackground.value = resolveBackground(config?.defaultParams?.background)
    localOutputFormat.value = config?.outputFormats?.length > 1 ? config.defaultParams?.output_format || localOutputFormat.value : ''
    localImageRatio.value = config?.ratios?.length ? getImageNodeRatioFromSizeKey(localImageSize.value) : ''
    localResolution.value = config?.resolutions?.length ? getImageNodeResolutionFromSizeKey(localImageSize.value) : ''
    if (imageSizeOptions.value.length) localImageSize.value = pickNearestSizeKey(localImageRatio.value, localResolution.value)
    const patch = buildModelParamsPatch({
      model: localImageModel.value,
      size: localImageSize.value,
      quality: localImageQuality.value,
      background: localBackground.value,
      outputFormat: localOutputFormat.value,
      ratio: localImageRatio.value,
      resolution: localResolution.value
    })
    if (!config?.sizes?.length) delete patch.size
    if (!config?.ratios?.length) delete patch.ratio
    updateNode(readNodeId(), patch)
  }

  const setImageRatio = (ratioKey) => {
    if (!ratioDropdownOptions.value.some((item) => item.key === ratioKey)) return
    localImageSize.value = pickNearestSizeKey(ratioKey, localResolution.value)
    updateNode(readNodeId(), buildSizeParamsPatch({
      size: localImageSize.value,
      ratio: localImageRatio.value,
      resolution: localResolution.value
    }))
  }

  const setResolution = (resolutionKey) => {
    if (!resolutionDropdownOptions.value.some((item) => item.key === resolutionKey)) return
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

  const setOutputFormat = (format) => {
    localOutputFormat.value = format
    updateNode(readNodeId(), { output_format: format })
  }

  return {
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
    setImageModel,
    setImageQuality,
    setImageRatio,
    setOutputFormat,
    setResolution,
    stageStyle
  }
}
