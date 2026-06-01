import {
  buildMultiAngleCameraInput,
  buildMultiAngleCameraPrompt
} from './multiAngleCamera.js'
import { resolutionFromMultiAngleSize } from './multiAngleSizeOptions.js'

const RESULT_FILE_TYPE = 'image/png'

const computeRatioLabel = (width, height) => {
  const gcd = (a, b) => (b ? gcd(b, a % b) : a)
  if (!width || !height) return '1:1'
  const divisor = gcd(width, height)
  return `${Math.round(width / divisor)}:${Math.round(height / divisor)}`
}

const createMeta = ({ cameraInput, prompt, model, azimuth, elevation, zoom }) => ({
  tool: 'multi-angle',
  azimuth: Math.round(Number(azimuth) || 0),
  elevation: Math.round(Number(elevation) || 0),
  zoom: Number(Number(zoom || 0).toFixed(1)),
  camera: cameraInput,
  prompt,
  model
})

const resolveResolution = (resolution, size) =>
  resolution || resolutionFromMultiAngleSize(size)

const resolveRatio = (ratio, size) => {
  if (ratio) return ratio
  const [width, height] = String(size || '1024x1024').split('x').map(Number)
  return computeRatioLabel(width, height)
}

export const createMultiAngleGenerationContext = ({
  azimuth = 0,
  elevation = 0,
  model = '',
  zoom = 4.2
} = {}) => {
  const cameraInput = buildMultiAngleCameraInput({ azimuth, elevation, zoom })
  const prompt = buildMultiAngleCameraPrompt(cameraInput)
  return {
    cameraInput,
    prompt,
    meta: createMeta({ cameraInput, prompt, model, azimuth, elevation, zoom })
  }
}

export const createMultiAnglePendingPayload = ({
  context,
  ratio,
  resolution,
  size
} = {}) => ({
  targetMode: 'new',
  size,
  ratio,
  resolution: resolveResolution(resolution, size),
  fileType: RESULT_FILE_TYPE,
  meta: context?.meta
})

export const createMultiAngleApplyPayload = ({
  context,
  ratio,
  resolution,
  size,
  url
} = {}) => ({
  targetMode: 'new',
  url: String(url || '').trim(),
  base64: '',
  fileType: RESULT_FILE_TYPE,
  size,
  ratio: resolveRatio(ratio, size),
  resolution: resolveResolution(resolution, size),
  meta: context?.meta
})

export const runMultiAngleGeneration = async ({
  context,
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
    ...(context?.cameraInput || {}),
    size,
    ratio,
    resolution: resolveResolution(resolution, size),
    enable_sync_mode: true,
    enable_base64_output: false
  })
  const first = Array.isArray(generated) ? generated[0] : generated
  const nextUrl = String(first?.url || '').trim()
  if (!nextUrl) {
    throw new Error('No image output from model')
  }

  return nextUrl
}
