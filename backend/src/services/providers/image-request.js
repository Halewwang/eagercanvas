import { HttpError } from '../../utils/http.js'

const STYLE_PROMPTS = {
  vivid: 'Vivid, hyper-realistic, high contrast',
  cinematic: 'Cinematic lighting, movie scene, dramatic atmosphere',
  anime: 'Anime style, japanese animation, cel shaded',
  'digital-art': 'Digital art, trending on artstation, highly detailed'
}

const IMAGE_RATIOS = ['auto', '1:1', '3:2', '2:3', '4:3', '3:4', '5:4', '4:5', '16:9', '9:16', '2:1', '1:2', '3:1', '1:3', '21:9', '9:21']

const isValidImageSource = (source) => {
  const url = URL.canParse(source) ? new URL(source) : null
  if (url && ['http:', 'https:'].includes(url.protocol) && url.hostname) return true
  const data = source.match(/^data:image\/[a-z0-9.+-]+;base64,([a-z0-9+/\s]+=*)$/i)
  const encoded = data?.[1].replace(/\s+/g, '') || ''
  return encoded.length > 0 && encoded.length % 4 === 0 && Buffer.from(encoded, 'base64').toString('base64') === encoded
}

export const pickFirstImageInput = (payload = {}) => {
  if (Array.isArray(payload.image_urls) && payload.image_urls.length > 0) return payload.image_urls[0]
  if (typeof payload.image === 'string') return payload.image
  if (Array.isArray(payload.image) && payload.image.length > 0) return payload.image[0]
  if (Array.isArray(payload.images) && payload.images.length > 0) return payload.images[0]
  if (typeof payload.first_frame_image === 'string') return payload.first_frame_image
  if (typeof payload.image_url === 'string') return payload.image_url
  return ''
}

export const getInputImages = (payload = {}) => {
  const inputImages = Array.isArray(payload.image_urls) ? payload.image_urls.filter(Boolean) : []
  if (!inputImages.length && Array.isArray(payload.images)) inputImages.push(...payload.images.filter(Boolean))
  if (!inputImages.length && Array.isArray(payload.image)) inputImages.push(...payload.image.filter(Boolean))
  const firstImage = pickFirstImageInput(payload)
  if (!inputImages.length && firstImage) inputImages.push(firstImage)
  return inputImages
}

export const buildApimartImageRequestBody = (payload = {}) => {
  const model = String(payload.model_name || payload.model || 'gpt-image-2').trim()
  if (model !== 'gpt-image-2' || (payload.model && String(payload.model).trim() !== 'gpt-image-2')) {
    throw new HttpError(400, 'Only gpt-image-2 image generation is supported', 'UNSUPPORTED_IMAGE_MODEL')
  }
  const prompt = typeof payload.prompt === 'string' ? payload.prompt.trim() : ''
  if (!prompt) throw new HttpError(400, 'Image prompt is required', 'IMAGE_PROMPT_REQUIRED')
  const size = payload.size === undefined ? '1:1' : payload.size
  const dimensions = typeof size === 'string' && size.match(/^([1-9]\d*)x([1-9]\d*)$/)
  if (!IMAGE_RATIOS.includes(size) && (!dimensions || dimensions.slice(1).some(value => !Number.isSafeInteger(Number(value))))) {
    throw new HttpError(400, 'Image size must be auto, a supported aspect ratio, or positive WIDTHxHEIGHT pixels', 'INVALID_IMAGE_SIZE')
  }
  const resolution = payload.resolution === undefined ? '1k' : payload.resolution
  if (!['1k', '2k', '4k'].includes(resolution)) {
    throw new HttpError(400, 'Image resolution must be 1k, 2k, or 4k', 'INVALID_IMAGE_RESOLUTION')
  }
  if (payload.image_urls !== undefined && !Array.isArray(payload.image_urls)) {
    throw new HttpError(400, 'Image references must be an array of URLs or image data URIs', 'INVALID_IMAGE_REFERENCE')
  }
  const images = getInputImages(payload)
  if (images.length > 15) throw new HttpError(400, 'At most 15 reference images are supported', 'TOO_MANY_IMAGES')
  const references = images.map(source => {
    if (typeof source !== 'string' || !isValidImageSource(source.trim())) {
      throw new HttpError(400, 'Image references must be HTTP URLs or base64 image data URIs', 'INVALID_IMAGE_REFERENCE')
    }
    return source.trim()
  })
  const style = !payload.style || payload.style === 'natural' ? '' : STYLE_PROMPTS[payload.style] || payload.style
  return {
    model: 'gpt-image-2',
    prompt: style ? `${prompt}\n\nStyle: ${style}` : prompt,
    n: 1,
    size,
    resolution,
    ...(references.length ? { image_urls: references } : {})
  }
}

export const resolveImageGenerationRequest = (payload = {}) => ({
  kind: 'adapter',
  adapter: 'apimart',
  payload: buildApimartImageRequestBody(payload)
})
