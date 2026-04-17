export const shouldLoadInlineVideoPlayer = ({
  hasVideoUrl = false,
  previewRequested = false
} = {}) => Boolean(hasVideoUrl && previewRequested)

export const shouldRenderStaticVideoPreview = ({
  hasVideoUrl = false,
  previewRequested = false
} = {}) => Boolean(hasVideoUrl && !previewRequested)
