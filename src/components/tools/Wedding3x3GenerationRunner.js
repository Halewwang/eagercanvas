import { resolveImageModelKey } from '@/config/models'

const RESULT_LABEL = 'Wedding 3x3 Result'
const RESULT_FILE_TYPE = 'image/png'

const getPrompt = (output = {}) => String(output?.output?.prompt || '')

const createBasePayload = ({
  imageSource,
  background,
  model,
  output,
  quality,
  ratio,
  resolution,
  size
}) => ({
  targetMode: 'new',
  model: resolveImageModelKey(model),
  ...(background ? { background } : {}),
  ...(size ? { size } : {}),
  ...(ratio ? { ratio } : {}),
  ...(resolution ? { resolution } : {}),
  ...(quality ? { quality } : {}),
  fileType: RESULT_FILE_TYPE,
  label: RESULT_LABEL,
  sourcePrompt: getPrompt(output),
  sourceRefImages: [imageSource],
  meta: {
    tool: 'wedding-3x3',
    json: output
  }
})

const createGenerationRequest = ({
  imageSource,
  background,
  model,
  output,
  quality,
  ratio,
  resolution,
  size
}) => ({
  model: resolveImageModelKey(model),
  ...(background ? { background } : {}),
  prompt: getPrompt(output),
  image: imageSource,
  ...(size ? { size } : {}),
  ...(ratio ? { ratio, aspect_ratio: ratio } : {}),
  ...(resolution ? { resolution } : {}),
  ...(quality ? { quality } : {})
})

export const createWedding3x3PendingPayload = (payload = {}) => createBasePayload(payload)

export const createWedding3x3ApplyPayload = (payload = {}) => ({
  ...createBasePayload(payload),
  url: String(payload.url || '').trim(),
  base64: ''
})

export const runWedding3x3Generation = async ({
  imageGen,
  imageSource,
  background,
  model,
  output,
  quality,
  ratio,
  resolution,
  size
} = {}) => {
  const request = createGenerationRequest({
    imageSource,
    background,
    model,
    output,
    quality,
    ratio,
    resolution,
    size
  })

  if (typeof imageGen?.generate !== 'function') {
    throw new Error('Image generator is missing')
  }
  const generated = await imageGen.generate(request)
  const first = Array.isArray(generated) ? generated[0] : generated
  const nextUrl = String(first?.url || '').trim()

  if (!nextUrl) {
    throw new Error('No image output from model')
  }

  return nextUrl
}
