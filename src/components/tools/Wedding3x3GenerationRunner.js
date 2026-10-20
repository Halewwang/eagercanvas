import { resolveImageModelKey } from '@/config/models'

const RESULT_LABEL = 'Wedding 3x3 Result'
const RESULT_FILE_TYPE = 'image/png'

const getPrompt = (output = {}) => String(output?.output?.prompt || '')

const createBasePayload = ({
  imageSource,
  model,
  output,
  ratio,
  resolution
}) => ({
  targetMode: 'new',
  model: resolveImageModelKey(model),
  ...(ratio ? { generationRatio: ratio } : {}),
  ...(resolution ? { generationResolution: resolution } : {}),
  fileType: RESULT_FILE_TYPE,
  label: RESULT_LABEL,
  sourcePrompt: getPrompt(output),
  sourceRefImages: /^https?:\/\//i.test(imageSource || '') ? [imageSource] : [],
  meta: {
    tool: 'wedding-3x3',
    json: output
  }
})

const createGenerationRequest = ({
  imageSource,
  model,
  output,
  ratio,
  resolution,
}) => ({
  model: resolveImageModelKey(model),
  prompt: getPrompt(output),
  image: imageSource,
  ...(ratio ? { ratio } : {}),
  ...(resolution ? { resolution } : {}),
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
  model,
  onSubmitted,
  output,
  ratio,
  resolution,
} = {}) => {
  const request = createGenerationRequest({
    imageSource,
    model,
    output,
    ratio,
    resolution,
    })

  if (typeof imageGen?.generate !== 'function') {
    throw new Error('Image generator is missing')
  }
  const generated = await imageGen.generate(request, { onSubmitted })
  const first = Array.isArray(generated) ? generated[0] : generated
  const nextUrl = String(first?.url || '').trim()

  if (!nextUrl) {
    throw new Error('No image output from model')
  }

  return nextUrl
}
