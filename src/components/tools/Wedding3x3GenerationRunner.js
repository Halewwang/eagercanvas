import {
  extractWedding3x3GeneratedImageUrl,
  extractWedding3x3ImageTaskId,
  isWedding3x3AsyncImageModel,
  waitForWedding3x3AsyncImageResult
} from './Wedding3x3AsyncImageResult.js'

const RESULT_LABEL = 'Wedding 3x3 Result'
const RESULT_FILE_TYPE = 'image/png'

const getPrompt = (output = {}) => String(output?.output?.prompt || '')

const createBasePayload = ({
  imageSource,
  model,
  output,
  quality,
  ratio,
  resolution,
  size
}) => ({
  targetMode: 'new',
  model,
  size,
  ratio,
  resolution,
  quality,
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
  model,
  output,
  quality,
  ratio,
  resolution,
  size,
  sync
}) => ({
  model,
  prompt: getPrompt(output),
  image: imageSource,
  size,
  ratio,
  aspect_ratio: ratio,
  resolution,
  quality,
  enable_sync_mode: sync,
  enable_base64_output: false
})

const loadDefaultImageApi = async () => import('@/api')

const resolveAsyncImageApi = async ({ createRun, getTask } = {}) => {
  if (typeof createRun === 'function' && typeof getTask === 'function') {
    return { createRun, getTask }
  }

  const api = await loadDefaultImageApi()
  return {
    createRun: createRun || api.createImageGenerationRun,
    getTask: getTask || api.getImageGenerationTask
  }
}

export const createWedding3x3PendingPayload = (payload = {}) => createBasePayload(payload)

export const createWedding3x3ApplyPayload = (payload = {}) => ({
  ...createBasePayload(payload),
  url: String(payload.url || '').trim(),
  base64: ''
})

export const runWedding3x3Generation = async ({
  createRun,
  getTask,
  imageGen,
  imageSource,
  model,
  output,
  pollOptions = {},
  quality,
  ratio,
  resolution,
  size
} = {}) => {
  const request = createGenerationRequest({
    imageSource,
    model,
    output,
    quality,
    ratio,
    resolution,
    size,
    sync: !isWedding3x3AsyncImageModel(model)
  })

  let nextUrl = ''
  if (isWedding3x3AsyncImageModel(model)) {
    const asyncApi = await resolveAsyncImageApi({ createRun, getTask })
    const run = await asyncApi.createRun(request)
    const runResult = run?.result || run
    nextUrl = extractWedding3x3GeneratedImageUrl(runResult)

    if (!nextUrl) {
      const taskId = extractWedding3x3ImageTaskId(runResult)
      const finalResult = await waitForWedding3x3AsyncImageResult(taskId, {
        getTask: asyncApi.getTask,
        ...pollOptions
      })
      nextUrl = extractWedding3x3GeneratedImageUrl(finalResult)
    }
  } else {
    if (typeof imageGen?.generate !== 'function') {
      throw new Error('Image generator is missing')
    }
    const generated = await imageGen.generate(request)
    const first = Array.isArray(generated) ? generated[0] : generated
    nextUrl = String(first?.url || '').trim()
  }

  if (!nextUrl) {
    throw new Error('No image output from model')
  }

  return nextUrl
}
