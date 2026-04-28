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
