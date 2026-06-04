const IMAGE_BASE_SIZE_BY_RATIO = {
  '1:1': { w: 1024, h: 1024 },
  '3:2': { w: 1152, h: 768 },
  '2:3': { w: 768, h: 1152 },
  '4:3': { w: 1152, h: 864 },
  '3:4': { w: 864, h: 1152 },
  '4:5': { w: 896, h: 1120 },
  '5:4': { w: 1120, h: 896 },
  '16:9': { w: 1280, h: 720 },
  '9:16': { w: 720, h: 1280 },
  '21:9': { w: 1680, h: 720 }
}

const STYLE_PROMPTS = {
  vivid: 'Vivid, hyper-realistic, high contrast, 8k resolution',
  cinematic: 'Cinematic lighting, movie scene, dramatic atmosphere',
  anime: 'Anime style, japanese animation, cel shaded',
  'digital-art': 'Digital art, trending on artstation, highly detailed'
}

export const normalizeAspectRatioFromSize = (size = '') => {
  if (!size || typeof size !== 'string' || !size.includes('x')) return ''
  const [w, h] = String(size).split('x').map(Number)
  if (!w || !h) return ''
  const ratio = w / h
  if (Math.abs(ratio - 1) < 0.02) return '1:1'
  if (Math.abs(ratio - 3 / 2) < 0.03) return '3:2'
  if (Math.abs(ratio - 2 / 3) < 0.03) return '2:3'
  if (Math.abs(ratio - 16 / 9) < 0.03) return '16:9'
  if (Math.abs(ratio - 9 / 16) < 0.03) return '9:16'
  if (Math.abs(ratio - 4 / 3) < 0.03) return '4:3'
  if (Math.abs(ratio - 3 / 4) < 0.03) return '3:4'
  if (Math.abs(ratio - 4 / 5) < 0.03) return '4:5'
  if (Math.abs(ratio - 5 / 4) < 0.03) return '5:4'
  if (Math.abs(ratio - 21 / 9) < 0.03) return '21:9'
  return ''
}

export const normalizeImageResolution = (value = '') => {
  const safe = String(value || '').trim().toLowerCase()
  if (safe === '1k' || safe === '2k' || safe === '4k') return safe
  return ''
}

export const normalizeResolutionFromSize = (size = '', ratio = '') => {
  if (!size || typeof size !== 'string' || !size.includes('x')) return ''
  const [w, h] = String(size).split('x').map(Number)
  if (!w || !h) return ''
  const ratioKey = ratio || normalizeAspectRatioFromSize(size) || '1:1'
  const base = IMAGE_BASE_SIZE_BY_RATIO[ratioKey] || IMAGE_BASE_SIZE_BY_RATIO['1:1']
  const scale = Math.max(w / base.w, h / base.h)
  if (scale >= 3.5) return '4k'
  if (scale >= 1.8) return '2k'
  return '1k'
}

export const isWavespeedImageModel = (model = '') => {
  const safe = String(model || '').trim().toLowerCase()
  return safe.includes('/') || safe.startsWith('wavespeed')
}

export const isGeminiImagePreviewModel = (model = '') => {
  const safe = String(model || '').trim().toLowerCase()
  return (
    safe.includes('gemini-3.1-flash-image-preview') ||
    safe.includes('gemini-3-pro-image-preview') ||
    safe.includes('nano-banana-2') ||
    safe.includes('nano-banana-pro')
  )
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

const getInputImages = (payload = {}) => {
  const inputImages = Array.isArray(payload.images)
    ? payload.images.filter(Boolean)
    : []
  const firstImage = pickFirstImageInput(payload)
  if (!inputImages.length && firstImage) {
    inputImages.push(firstImage)
  }
  return inputImages
}

export const resolveImageGenerationRequest = (payload = {}) => {
  const model = String(payload.model_name || payload.model || '').trim()
  const lowerModel = model.toLowerCase()
  const size = String(payload.size || '')
  const aspectRatio = String(
    payload.aspect_ratio ||
    payload.ratio ||
    normalizeAspectRatioFromSize(size) ||
    '1:1'
  ).trim()
  const prompt = buildStyledPrompt(payload)
  const inputImages = getInputImages(payload)
  const resolution =
    normalizeImageResolution(payload.resolution) ||
    normalizeImageResolution(payload.quality) ||
    normalizeResolutionFromSize(size, aspectRatio) ||
    '1k'

  if (lowerModel === 'gpt-image-2' || lowerModel === 'gpt-image-lite') {
    return {
      kind: 'adapter',
      adapter: lowerModel === 'gpt-image-lite' ? 'derouter' : 'openai',
      payload: {
        ...payload,
        prompt,
        ratio: payload.ratio || payload.aspect_ratio || aspectRatio,
        size: payload.size,
        images: inputImages
      }
    }
  }

  if (isWavespeedImageModel(model)) {
    return {
      kind: 'adapter',
      adapter: 'dashboard302',
      payload: {
        ...payload,
        prompt,
        size: payload.size || size || '1024x1024'
      }
    }
  }

  if (isGeminiImagePreviewModel(model)) {
    return {
      kind: 'adapter',
      adapter: 'dashboard302',
      payload: {
        ...payload,
        prompt,
        aspect_ratio: aspectRatio,
        resolution,
        images: inputImages
      }
    }
  }

  return {
    kind: 'direct',
    path: '/v1/images/generations',
    method: 'POST',
    payload
  }
}
