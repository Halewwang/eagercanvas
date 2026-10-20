export const GPT_IMAGE_2_RATIOS = ['auto', '1:1', '3:2', '2:3', '4:3', '3:4', '5:4', '4:5', '16:9', '9:16', '2:1', '1:2', '3:1', '1:3', '21:9', '9:21']
export const GPT_IMAGE_2_RESOLUTION_OPTIONS = [
  { key: '1k', label: '1K' },
  { key: '2k', label: '2K' },
  { key: '4k', label: '4K' }
]

export const resolveGptImage2Size = ({ ratio, size } = {}) => (
  GPT_IMAGE_2_RATIOS.includes(ratio ?? size) ? ratio ?? size : '1:1'
)

export const getGptImageGenerationSettings = (data = {}) => {
  const ratioValue = data.generationRatio ?? data.exportRatio ?? '1:1'
  const resolutionValue = String(data.generationResolution ?? ({ 1024: '1k', 2048: '2k', 4096: '4k' }[data.exportSize]) ?? '1k').toLowerCase()
  const ratio = ratioValue === '' ? 'auto' : resolveGptImage2Size({ ratio: ratioValue })
  const resolution = GPT_IMAGE_2_RESOLUTION_OPTIONS.some(item => item.key === resolutionValue) ? resolutionValue : '1k'
  return { ratio, resolution, size: ratio }
}

export const selectGptImageGenerationSize = ({ ratio, resolution }, field, value) => {
  const settings = getGptImageGenerationSettings({
    generationRatio: field === 'ratio' ? value : ratio,
    generationResolution: field === 'resolution' ? value : resolution
  })
  return { ratio: settings.ratio, resolution: settings.resolution }
}
