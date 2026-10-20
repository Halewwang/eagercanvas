import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { effectScope } from 'vue'

const source = readFileSync(new URL('./useImageApi.js', import.meta.url), 'utf8')

test('image generation request forwards source node id for result recovery', () => {
  assert.match(source, /if \(params\.sourceNodeId\) requestData\.sourceNodeId = params\.sourceNodeId/)
})


const toModule = (code) => `data:text/javascript;base64,${Buffer.from(code).toString('base64')}`
const modelsSource = readFileSync(new URL('../../config/models.js', import.meta.url), 'utf8')
  .replace("from '@/utils/gptImageParameters'", `from '${new URL('../../utils/gptImageParameters.js', import.meta.url).href}'`)
const modelsModuleUrl = toModule(modelsSource)
const mockApiUrl = toModule("export const calls = []; export const generateImage = async data => { calls.push(data); return { data: [{ url: 'https://example.test/image.png' }] } }; export const getImageGenerationTask = async () => ({})")
const loadGeneration = async (apiUrl = mockApiUrl) => {
  const vueUrl = import.meta.resolve('vue')
  const stateSource = readFileSync(new URL('./useApiState.js', import.meta.url), 'utf8').replace("from 'vue'", `from '${vueUrl}'`)
  const code = source
    .replace("from 'vue'", `from '${vueUrl}'`)
    .replace("from '@/api'", `from '${apiUrl}'`)
    .replace("from '@/config/models'", `from '${modelsModuleUrl}'`)
    .replace("from '@/utils/gptImageParameters'", `from '${new URL('../../utils/gptImageParameters.js', import.meta.url).href}'`)
    .replace("from './useApiState.js'", `from '${toModule(stateSource)}'`)
    .replace("from './imageApiCore.js'", `from '${new URL('./imageApiCore.js', import.meta.url).href}'`)
  const module = await import(toModule(code))
  const api = await import(apiUrl)
  return { ...module, calls: api.calls }
}

test('image API sends ratio and resolution in the JSON body without alias parameters', async () => {
  const { useImageGeneration, calls } = await loadGeneration()
  await useImageGeneration().generate({ model: 'gpt-image-2', prompt: 'test', ratio: '16:9', resolution: '4k', quality: 'high', background: 'opaque', output_format: 'webp', size: '1024x1024' })
  const body = calls.at(-1)
  assert.equal(body.size, '16:9')
  assert.equal(body.resolution, '4k')
  assert.equal(body.n, 1)
  for (const key of ['quality', 'generationQuality', 'background', 'output_format']) assert.equal(Object.hasOwn(body, key), false)
  for (const key of ['ratio', 'aspect_ratio', 'generationRatio', 'generationResolution']) assert.equal(Object.hasOwn(body, key), false)
})

test('image API normalizes old pixel callers and gives canonical parameters precedence', async () => {
  const { useImageGeneration, calls } = await loadGeneration()
  await useImageGeneration().generate({ prompt: 'test', size: '1536x1024' })
  assert.equal(calls.at(-1).size, '1:1')
  await useImageGeneration().generate({ prompt: 'test', generationRatio: '1:1', generationResolution: '2k', generationQuality: 'medium', ratio: '16:9', resolution: '4k', quality: 'high', size: '1536x1024' })
  assert.equal(calls.at(-1).size, '1:1')
  assert.equal(calls.at(-1).quality, undefined)
})


test('image API allows Auto ratio with fixed resolution and rejects a sixteenth reference before HTTP', async () => {
  const { useImageGeneration, calls } = await loadGeneration()
  const image = useImageGeneration()
  const references = Array.from({ length: 15 }, (_, index) => `https://example.test/ref-${index}.png`)
  await image.generate({ prompt: 'test', ratio: 'auto', resolution: '4k', image: references })
  assert.equal(calls.at(-1).size, 'auto')
  assert.equal(calls.at(-1).resolution, '4k')
  assert.deepEqual(calls.at(-1).images, references)
  const count = calls.length
  await assert.rejects(image.generate({ prompt: 'test', image: [...references, 'extra.png'] }), /最多.*15.*参考图/)
  assert.equal(calls.length, count)
})

test('submission waits for durable save and refresh resume only issues GET requests', async () => {
  const apiUrl = toModule(`export const calls = [];
    export const generateImage = async () => { calls.push('POST'); return { status: 'submitted', task_id: 'saved-task' } };
    export const getImageGenerationTask = async id => { calls.push(['GET', id]); return { data: [{ url: 'https://example.test/result.png' }] } };`)
  const { useImageGeneration, calls } = await loadGeneration(apiUrl)
  let finishSave
  const saving = new Promise(resolve => { finishSave = resolve })
  const first = useImageGeneration().generate({ prompt: 'test' }, { onSubmitted: async id => {
    assert.equal(id, 'saved-task')
    await saving
  } })
  await new Promise(resolve => setTimeout(resolve, 0))
  assert.deepEqual(calls, ['POST'])
  finishSave()
  await first
  assert.deepEqual(calls, ['POST', ['GET', 'saved-task']])
  calls.length = 0
  await useImageGeneration().resume('saved-task')
  assert.deepEqual(calls, [['GET', 'saved-task']])
})

test('provider terminal failure is explicit and abort never resubmits a paid task', async () => {
  const apiUrl = toModule(`export const calls = [];
    export const generateImage = async () => { calls.push('POST'); return {} };
    export const getImageGenerationTask = async () => ({ status: 'failed', error: { message: 'provider rejected' } });`)
  const { useImageGeneration, calls } = await loadGeneration(apiUrl)
  await assert.rejects(useImageGeneration().resume('failed-task'), err => err.imageTaskTerminal === true)
  const controller = new AbortController()
  controller.abort()
  await assert.rejects(useImageGeneration().resume('paused-task', { signal: controller.signal }), err => err.name === 'AbortError')
  assert.deepEqual(calls, [])
})

test('session errors remain recoverable without resubmitting a paid task', async () => {
  const apiUrl = toModule(`export const calls = [];
    export const generateImage = async () => { calls.push('POST'); return {} };
    export const getImageGenerationTask = async () => { throw Object.assign(new Error('sign in'), { status: 401 }) };`)
  const { useImageGeneration, calls } = await loadGeneration(apiUrl)
  await assert.rejects(useImageGeneration().resume('session-task'), err => !err.imageTaskTerminal)
  assert.deepEqual(calls, [])
})


test('disposing the component scope aborts its GET polling without a new generation', async () => {
  const apiUrl = toModule(`export const calls = [];
    export const generateImage = async () => { calls.push('POST'); return {} };
    export const getImageGenerationTask = async (id, options) => { calls.push(['GET', id]); return new Promise((resolve, reject) => {
      options.signal.addEventListener('abort', () => reject(Object.assign(new Error('aborted'), { name: 'AbortError' })), { once: true })
    }) };`)
  const { useImageGeneration, calls } = await loadGeneration(apiUrl)
  const scope = effectScope()
  const hook = scope.run(() => useImageGeneration())
  const pending = hook.resume('unmount-task')
  scope.stop()
  await assert.rejects(pending, err => err.name === 'AbortError' && !err.imageTaskTerminal)
  assert.deepEqual(calls, [['GET', 'unmount-task']])
})
