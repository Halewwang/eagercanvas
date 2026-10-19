import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'

const runnerSource = readFileSync(new URL('./Wedding3x3GenerationRunner.js', import.meta.url), 'utf8')
  .replace("from '@/config/models'", `from '${new URL('../../config/models.js', import.meta.url).href}'`)
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
  quality: 'high',
  ratio: '3:2',
  resolution: '2k',
  size: '2048x1365'
}

test('wedding 3x3 generation runner builds pending payloads from current output metadata', () => {
  assert.deepEqual(createWedding3x3PendingPayload(baseRunInput), {
    targetMode: 'new',
    model: 'gpt-image-2',
    size: '2048x1365',
    ratio: '3:2',
    resolution: '2k',
    quality: 'high',
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
      size: '2048x1365',
      ratio: '3:2',
      resolution: '2k',
      quality: 'high',
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
      size: '2048x1365',
      ratio: '3:2',
      aspect_ratio: '3:2',
      resolution: '2k',
      quality: 'high'
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
    imageSource: 'reference.png', model: 'gpt-image-2', output: baseOutput, background: 'opaque',
    imageGen: { generate: async (request) => { calls.push(request); return [{ url: 'result.png' }] } }
  })
  assert.deepEqual(calls[0], {
    model: 'gpt-image-2', prompt: baseOutput.output.prompt, image: 'reference.png', background: 'opaque'
  })
})
