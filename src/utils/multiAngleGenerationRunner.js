import {
  buildMultiAngleCameraInput,
  buildMultiAngleCameraPrompt
} from './multiAngleCamera.js'
const RESULT_FILE_TYPE = 'image/png'

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
  background,
  ratio,
  resolution,
  size
} = {}) => ({
  targetMode: 'new',
  ...(background ? { background } : {}),  ...(size ? { size } : {}),
  ...(ratio ? { ratio } : {}),
  ...(resolution ? { resolution } : {}),
  fileType: RESULT_FILE_TYPE,
  meta: context?.meta
})

export const createMultiAngleApplyPayload = ({
  context,
  background,
  ratio,
  resolution,
  size,
  url
} = {}) => ({
  targetMode: 'new',
  ...(background ? { background } : {}),  url: String(url || '').trim(),
  base64: '',
  fileType: RESULT_FILE_TYPE,
  ...(size ? { size } : {}),
  ...(ratio ? { ratio } : {}),
  ...(resolution ? { resolution } : {}),
  meta: context?.meta
})

export const runMultiAngleGeneration = async ({
  context,
  background,
  imageGen,
  imageSource,
  model,
  ratio,
  resolution,
  size
} = {}) => {
  if (typeof imageGen?.generate !== 'function') {
    throw new Error('Image generator is missing')
  }

  const generated = await imageGen.generate({
    tool: 'multi-angle',
    model,
    prompt: context?.prompt || '',
    image: imageSource,
    ...(background ? { background } : {}),    ...(size ? { size } : {}),
    ...(ratio ? { ratio } : {}),
    ...(resolution ? { resolution } : {})
  })
  const first = Array.isArray(generated) ? generated[0] : generated
  const nextUrl = String(first?.url || '').trim()
  if (!nextUrl) {
    throw new Error('No image output from model')
  }

  return nextUrl
}
