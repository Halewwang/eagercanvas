export const shouldLoadInlineVideoPlayer = ({
  hasVideoUrl = false,
  previewRequested = false
} = {}) => Boolean(hasVideoUrl && previewRequested)
