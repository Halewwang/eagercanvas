import { HttpError } from '../../utils/http.js'

const STYLE_PROMPTS = {
  vivid: 'Vivid, hyper-realistic, high contrast',
  cinematic: 'Cinematic lighting, movie scene, dramatic atmosphere',
  anime: 'Anime style, japanese animation, cel shaded',
  'digital-art': 'Digital art, trending on artstation, highly detailed'
}

export const pickFirstImageInput = (payload = {}) => {
  if (typeof payload.image === 'string') return payload.image
  if (Array.isArray(payload.image) && payload.image.length > 0) return payload.image[0]
  if (Array.isArray(payload.images) && payload.images.length > 0) return payload.images[0]
  if (typeof payload.first_frame_image === 'string') return payload.first_frame_image
  if (typeof payload.image_url === 'string') return payload.image_url
  return ''
}

const buildStyledPrompt = (payload = {}) => {
  const prompt = String(payload.prompt || '').trim()
  if (!payload.style || payload.style === 'natural') return prompt

  const stylePrompt = STYLE_PROMPTS[payload.style] || payload.style
  return `${prompt}\n\nStyle: ${stylePrompt}`
}

export const getInputImages = (payload = {}) => {
  const inputImages = Array.isArray(payload.images)
    ? payload.images.filter(Boolean)
    : []
  if (!inputImages.length && Array.isArray(payload.image)) inputImages.push(...payload.image.filter(Boolean))
  const firstImage = pickFirstImageInput(payload)
  if (!inputImages.length && firstImage) {
    inputImages.push(firstImage)
  }
  return inputImages
}

export const resolveImageGenerationRequest = (payload = {}) => {
  const model = String(payload.model_name || payload.model || 'gpt-image-2').trim()
  if (model !== 'gpt-image-2' || (payload.model && String(payload.model).trim() !== 'gpt-image-2')) {
    throw new HttpError(400, 'Only gpt-image-2 image generation is supported', 'UNSUPPORTED_IMAGE_MODEL')
  }

  return {
    kind: 'adapter',
    adapter: 'enbrand',
    payload: {
      model: 'gpt-image-2',
      prompt: buildStyledPrompt(payload),
      images: getInputImages(payload),
      background: payload.background
    }
  }
}

export const buildGptImage2RequestBody = (payload = {}) => ({
  model: 'gpt-image-2',
  prompt: String(payload.prompt || '').trim(),
  background: String(payload.background || '').trim().toLowerCase() === 'opaque' ? 'opaque' : 'auto',
  output_format: 'png',
  n: 1
})
