export const shouldLoadInlineVideoPlayer = ({
  hasVideoUrl = false,
  previewRequested = false
} = {}) => Boolean(hasVideoUrl && previewRequested)

export const shouldRenderStaticVideoPreview = ({
  hasVideoUrl = false,
  previewRequested = false
} = {}) => Boolean(hasVideoUrl && !previewRequested)

export const getVisibleVideoConnectionStatusItems = ({
  inputProfile = {},
  connected = {}
} = {}) => {
  const items = []
  if (inputProfile.allowPrompt) {
    items.push({ key: 'prompt', label: `Prompt ${connected.prompt ? '✓' : '○'}`, active: Boolean(connected.prompt) })
  }
  if (inputProfile.allowFirstFrame) {
    items.push({ key: 'first', label: `First Frame ${connected.firstFrame ? '✓' : '○'}`, active: Boolean(connected.firstFrame) })
  }
  if (inputProfile.allowLastFrame) {
    items.push({ key: 'last', label: `Last Frame ${connected.lastFrame ? '✓' : '○'}`, active: Boolean(connected.lastFrame) })
  }
  if (inputProfile.allowImageReference) {
    const count = Number(connected.referenceImageCount || 0)
    items.push({ key: 'image-reference', label: `Reference ${count > 0 ? `✓ ${count}` : '○'}`, active: count > 0 })
  }
  if (inputProfile.allowVideoReference) {
    const count = Number(connected.referenceVideoCount || 0)
    items.push({ key: 'video-reference', label: `Video Reference ${count > 0 ? `✓ ${count}` : '○'}`, active: count > 0 })
  }
  return items
}

const VIDEO_BINDING_STATUS_LABELS = {
  prompt: 'Prompt',
  first_frame_image: 'First Frame',
  last_frame_image: 'Second Frame',
  input_reference: 'Reference Picture',
  video_reference: 'Reference Video'
}

const toActiveKeySet = (activeKeys) => {
  if (activeKeys instanceof Set) return activeKeys
  if (Array.isArray(activeKeys)) return new Set(activeKeys)
  return new Set()
}

export const getVisibleVideoBindingStatusItems = ({
  model = '',
  inputProfile = {},
  activeKeys = [],
  previews = {}
} = {}) => {
  const keys = toActiveKeySet(activeKeys)
  const items = [
    {
      key: 'prompt',
      label: VIDEO_BINDING_STATUS_LABELS.prompt,
      active: keys.has('prompt')
    },
    {
      key: 'first_frame_image',
      label: VIDEO_BINDING_STATUS_LABELS.first_frame_image,
      active: keys.has('first_frame_image'),
      previewUrl: previews.first_frame_image
    },
    {
      key: 'last_frame_image',
      label: VIDEO_BINDING_STATUS_LABELS.last_frame_image,
      active: keys.has('last_frame_image'),
      previewUrl: previews.last_frame_image
    },
    {
      key: 'input_reference',
      label: VIDEO_BINDING_STATUS_LABELS.input_reference,
      active: keys.has('input_reference'),
      previewUrl: previews.input_reference
    },
    {
      key: 'video_reference',
      label: VIDEO_BINDING_STATUS_LABELS.video_reference,
      active: keys.has('video_reference')
    }
  ]

  if (model === 'seedance-2.0') return items

  return items.filter((item) => {
    if (item.key === 'prompt') return Boolean(inputProfile.allowPrompt)
    if (item.key === 'first_frame_image') return Boolean(inputProfile.allowFirstFrame)
    if (item.key === 'last_frame_image') return Boolean(inputProfile.allowLastFrame)
    if (item.key === 'input_reference') return Boolean(inputProfile.allowImageReference)
    if (item.key === 'video_reference') return Boolean(inputProfile.allowVideoReference)
    return true
  })
}
