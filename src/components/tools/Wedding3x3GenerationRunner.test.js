import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'

const modelsSource = readFileSync(new URL('../../config/models.js', import.meta.url), 'utf8')
  .replace("from '@/utils/gptImageParameters'", `from '${new URL('../../utils/gptImageParameters.js', import.meta.url).href}'`)
const modelsModuleUrl = `data:text/javascript;base64,${Buffer.from(modelsSource).toString('base64')}`

const runnerSource = readFileSync(new URL('./Wedding3x3GenerationRunner.js', import.meta.url), 'utf8')
  .replace("from '@/config/models'", `from '${modelsModuleUrl}'`)
const {
  createWedding3x3ApplyPayload,
  createWedding3x3PendingPayload,
  runWedding3x3Generation
} = await import(`data:text/javascript;base64,${Buffer.from(runnerSource).toString('base64')}`)

const baseOutput = {
  output: {
    prompt: 'A structured wedding product prompt'
  },
  meta: {
    sample: true
  }
}

const baseRunInput = {
  imageSource: 'https://cdn.example.com/reference.png',
  model: 'gpt-image-2',
  output: baseOutput,
  ratio: '3:2',
  resolution: '2k',
  size: '2048x1365'
}

test('wedding 3x3 generation runner builds pending payloads from current output metadata', () => {
  assert.deepEqual(createWedding3x3PendingPayload(baseRunInput), {
    targetMode: 'new',
    model: 'gpt-image-2',
    generationRatio: '3:2',
    generationResolution: '2k',
    fileType: 'image/png',
    label: 'Wedding 3x3 Result',
    sourcePrompt: 'A structured wedding product prompt',
    sourceRefImages: ['https://cdn.example.com/reference.png'],
    meta: {
      tool: 'wedding-3x3',
      json: baseOutput
    }
  })
})

test('wedding 3x3 generation runner builds apply payloads with the generated image url', () => {
  assert.deepEqual(
    createWedding3x3ApplyPayload({
      ...baseRunInput,
      url: ' https://cdn.example.com/result.png '
    }),
    {
      targetMode: 'new',
      model: 'gpt-image-2',
      url: 'https://cdn.example.com/result.png',
      base64: '',
      fileType: 'image/png',
      generationRatio: '3:2',
      generationResolution: '2k',
      label: 'Wedding 3x3 Result',
      sourcePrompt: 'A structured wedding product prompt',
      sourceRefImages: ['https://cdn.example.com/reference.png'],
      meta: {
        tool: 'wedding-3x3',
        json: baseOutput
      }
    }
  )
})

test('wedding 3x3 passes task submission callbacks outside the request and omits temporary references from pending data', async () => {
  const onSubmitted = () => {}
  const imageSource = 'data:image/png;base64,temporary-image'
  let request
  let options
  await runWedding3x3Generation({
    ...baseRunInput,
    imageSource,
    onSubmitted,
    imageGen: { generate: async (payload, config) => {
      request = payload
      options = config
      return [{ url: 'https://cdn.example.com/result.png' }]
    } }
  })
  assert.equal(options.onSubmitted, onSubmitted)
  assert.equal(Object.hasOwn(request, 'onSubmitted'), false)
  assert.equal(request.image, imageSource)
  for (const source of [imageSource, 'blob:https://example.com/temporary-image']) {
    const pending = createWedding3x3PendingPayload({ ...baseRunInput, imageSource: source })
    assert.deepEqual(pending.sourceRefImages, [])
    assert.equal(JSON.stringify(pending).includes(source), false)
  }
})

test('wedding 3x3 generation runner uses synchronous GPT image generation', async () => {
  const calls = []
  const url = await runWedding3x3Generation({
    ...baseRunInput,
    imageGen: {
      generate: async (payload) => {
        calls.push(payload)
        return [{ url: 'https://cdn.example.com/sync.png' }]
      }
    }
  })

  assert.equal(url, 'https://cdn.example.com/sync.png')
  assert.deepEqual(calls, [
    {
      model: 'gpt-image-2',
      prompt: 'A structured wedding product prompt',
      image: 'https://cdn.example.com/reference.png',
      ratio: '3:2',
      resolution: '2k',
      }
  ])
})

test('wedding 3x3 replaces retired models and uses the normal image generation path', async () => {
  const calls = []
  const url = await runWedding3x3Generation({
    ...baseRunInput,
    model: 'gemini-3.1-flash-image-preview',
    imageGen: { generate: async (payload) => {
      calls.push(payload)
      return [{ url: 'https://cdn.example.com/result.png' }]
    } }
  })
  assert.equal(url, 'https://cdn.example.com/result.png')
  assert.equal(calls[0].model, 'gpt-image-2')
  assert.equal(Object.hasOwn(calls[0], 'enable_sync_mode'), false)
})

test('wedding 3x3 generation runner rejects empty model output', async () => {
  await assert.rejects(
    runWedding3x3Generation({
      ...baseRunInput,
      imageGen: {
        generate: async () => ({ url: '   ' })
      }
    }),
    /No image output from model/
  )
})

test('wedding 3x3 keeps its prompt and reference without inventing output controls', async () => {
  const calls = []
  await runWedding3x3Generation({
    imageSource: 'reference.png', model: 'gpt-image-2', output: baseOutput, imageGen: { generate: async (request) => { calls.push(request); return [{ url: 'result.png' }] } }
  })
  assert.deepEqual(calls[0], {
    model: 'gpt-image-2', prompt: baseOutput.output.prompt, image: 'reference.png', })
})
