import {
  buildMultiAngleCameraInput,
  buildMultiAngleCameraPrompt
} from './multiAngleCamera.js'
const RESULT_FILE_TYPE = 'image/png'

const generationData = ({ ratio, resolution }) => ({
  ...(ratio ? { generationRatio: ratio } : {}),
  ...(resolution ? { generationResolution: resolution } : {}),
})

const createMeta = ({ cameraInput, prompt, model, azimuth, elevation, zoom }) => ({
  tool: 'multi-angle',
  azimuth: Math.round(Number(azimuth) || 0),
  elevation: Math.round(Number(elevation) || 0),
  zoom: Number(Number(zoom || 0).toFixed(1)),
  camera: cameraInput,
  prompt,
  model
})

export const createMultiAngleGenerationContext = ({
  azimuth = 0,
  elevation = 0,
  model = '',
  zoom = 4.2
} = {}) => {
  const cameraInput = buildMultiAngleCameraInput({ azimuth, elevation, zoom })
  const prompt = buildMultiAngleCameraPrompt({
    ...cameraInput,
    azimuth,
    elevation,
    zoom
  })
  return {
    cameraInput,
    prompt,
    meta: createMeta({ cameraInput, prompt, model, azimuth, elevation, zoom })
  }
}

export const createMultiAnglePendingPayload = ({
  context,
  imageSource,
  model,
  ratio,
  resolution,
} = {}) => ({
  targetMode: 'new',
  ...generationData({ ratio, resolution }),
  fileType: RESULT_FILE_TYPE,
  model: model || context?.meta?.model || '',
  sourcePrompt: context?.prompt || '',
  sourceRefImages: /^https?:\/\//i.test(imageSource || '') ? [imageSource] : [],
  meta: context?.meta
})

export const createMultiAngleApplyPayload = ({
  context,
  imageSource,
  model,
  ratio,
  resolution,
  url
} = {}) => ({
  targetMode: 'new',
  url: String(url || '').trim(),
  base64: '',
  fileType: RESULT_FILE_TYPE,
  ...generationData({ ratio, resolution }),
  model: model || context?.meta?.model || '',
  sourcePrompt: context?.prompt || '',
  sourceRefImages: /^https?:\/\//i.test(imageSource || '') ? [imageSource] : [],
  meta: context?.meta
})

export const runMultiAngleGeneration = async ({
  context,
  imageGen,
  imageSource,
  model,
  onSubmitted,
  ratio,
  resolution,
} = {}) => {
  if (typeof imageGen?.generate !== 'function') {
    throw new Error('Image generator is missing')
  }

  const generated = await imageGen.generate({
    tool: 'multi-angle',
    model,
    prompt: context?.prompt || '',
    image: imageSource,
    ...(ratio ? { ratio } : {}),
    ...(resolution ? { resolution } : {}),
  }, { onSubmitted })
  const first = Array.isArray(generated) ? generated[0] : generated
  const nextUrl = String(first?.url || '').trim()
  if (!nextUrl) {
    throw new Error('No image output from model')
  }

  return nextUrl
}
