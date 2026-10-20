import { computed, ref, watch } from 'vue'
import { getGptImageGenerationSettings, selectGptImageGenerationSize } from '@/utils/gptImageParameters'
import { getImageNodeSelectOptions, getImageNodeStageStyle } from '@/utils/imageNodeLayout'

const readOption = (source) => {
  if (typeof source === 'function') return source()
  if (source && typeof source === 'object' && 'value' in source) return source.value
  return source
}

export const useImageNodeModelControls = ({
  data,
  defaultImageModel = '',
  getModelConfig = () => null,
  imageModelOptions = [],
  nodeId,
  naturalSize,
  updateNode = () => {}
} = {}) => {
  const readData = () => readOption(data) || {}
  const readModels = () => readOption(imageModelOptions) || []
  const resolveModel = (key) => readModels().some(model => model.key === key) ? key : readOption(defaultImageModel)
  const localImageModel = ref(resolveModel(readData().model))
  const initial = getGptImageGenerationSettings(readData())
  const localImageRatio = ref(initial.ratio)
  const localResolution = ref(initial.resolution)
  const imageModelDropdownOptions = computed(() => getImageNodeSelectOptions(readModels()))
  const currentConfig = computed(() => getModelConfig(localImageModel.value))
  const ratioDropdownOptions = computed(() => (currentConfig.value?.ratios || []).map(key => ({ key, label: key === 'auto' ? 'Auto' : key })))
  const resolutionDropdownOptions = computed(() => currentConfig.value?.resolutions || [])
  const displayImageModel = computed(() => imageModelDropdownOptions.value.find(item => item.key === localImageModel.value)?.label || localImageModel.value)
  const displayRatio = computed(() => localImageRatio.value === 'auto' ? 'Auto' : localImageRatio.value)
  const displayResolution = computed(() => localResolution.value.toUpperCase())
  const stageStyle = computed(() => getImageNodeStageStyle(localImageRatio.value === 'auto'
    ? { ratio: readData().ratio, size: readData().size, naturalSize: readOption(naturalSize) }
    : { ratio: localImageRatio.value }))
  const moduleStyle = computed(() => ({ width: `calc(${stageStyle.value.width} + 2px)` }))

  watch(readData, nextData => {
    localImageModel.value = resolveModel(nextData.model)
    const settings = getGptImageGenerationSettings(nextData)
    localImageRatio.value = settings.ratio
    localResolution.value = settings.resolution
  }, { deep: true })

  const saveSettings = () => updateNode(readOption(nodeId), {
    generationRatio: localImageRatio.value,
    generationResolution: localResolution.value
  })
  const setImageModel = key => {
    localImageModel.value = resolveModel(key)
    updateNode(readOption(nodeId), { model: localImageModel.value })
  }
  const selectSize = (field, value) => {
    const options = field === 'ratio' ? ratioDropdownOptions.value : resolutionDropdownOptions.value
    if (!options.some(item => item.key === value)) return
    const next = selectGptImageGenerationSize({ ratio: localImageRatio.value, resolution: localResolution.value }, field, value)
    localImageRatio.value = next.ratio
    localResolution.value = next.resolution
    saveSettings()
  }
  const setImageRatio = value => selectSize('ratio', value)
  const setResolution = value => selectSize('resolution', value)

  return {
    displayImageModel,
    displayRatio,
    displayResolution,
    imageModelDropdownOptions,
    localImageModel,
    localImageRatio,
    localResolution,
    moduleStyle,
    ratioDropdownOptions,
    resolutionDropdownOptions,
    setImageModel,
    setImageRatio,
    setResolution,
    stageStyle
  }
}
