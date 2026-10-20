import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const modelsUrl = new URL('../../config/models.js', import.meta.url)
const modelsSource = readFileSync(modelsUrl, 'utf8')
  .replace("from '@/utils/gptImageParameters'", `from '${new URL('../../utils/gptImageParameters.js', import.meta.url).href}'`)
const modelsModuleUrl = `data:text/javascript;base64,${Buffer.from(modelsSource).toString('base64')}`
const stateUrl = new URL('./useApiState.js', import.meta.url)
const imageCoreUrl = new URL('./imageApiCore.js', import.meta.url)

const loadHook = async (name) => {
  const source = readFileSync(new URL(name, import.meta.url), 'utf8')
    .replace("import { onUnmounted, ref } from 'vue'", `import { ref } from '${import.meta.resolve('vue')}'; const onUnmounted = () => {}`)
    .replace("from 'vue'", `from '${import.meta.resolve('vue')}'`)
    .replace(/import \{ ([^}]+) \} from '@\/api'/, 'const { $1 } = globalThis.__modelRequestMigrationApi')
    .replace("from '@/config/models'", `from '${modelsModuleUrl}'`)
    .replace("from '@/utils/gptImageParameters'", `from '${new URL('../../utils/gptImageParameters.js', import.meta.url).href}'`)
    .replace("from './useApiState.js'", `from '${stateUrl.href}'`)
    .replace("from './imageApiCore.js'", `from '${imageCoreUrl.href}'`)
  return import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`)
}

test('saved canvas models are normalized at chat and image request boundaries', async () => {
  const calls = []
  globalThis.__modelRequestMigrationApi = {
    streamChatCompletions: async function* (request) {
      calls.push(['chat', request])
      yield 'OK'
    },
    generateImage: async (request, options) => {
      calls.push(['image', request, options])
      return { data: [{ url: 'data:image/png;base64,aW1hZ2U=' }] }
    },
    getImageGenerationTask: async () => { throw new Error('Synchronous images must not poll') }
  }
  try {
    const { useChat } = await loadHook('./useChatApi.js')
    const { useImageGeneration } = await loadHook('./useImageApi.js')
    const chat = useChat({ model: () => 'gemini-2.5-flash' })
    assert.equal(await chat.send('Hello'), 'OK')
    assert.equal(calls[0][1].model, 'gpt-5.6-sol')

    const image = useImageGeneration()
    const result = await image.generate({ model: 'gpt-image-lite', quality: 'standard', prompt: 'A square', sourceNodeId: 'image-1' })
    const request = calls[1][1]
    assert.equal(request.model, 'gpt-image-2')
    assert.equal(request.model_name, 'gpt-image-2')
    assert.equal(request.quality, undefined)
    assert.equal(request.size, '1:1')
    assert.equal(request.sourceNodeId, 'image-1')
    assert.equal(calls[1][2].endpoint, '/images/generations')
    assert.equal(result[0].url, 'data:image/png;base64,aW1hZ2U=')

    await image.generate({ model: 'gpt-image-2', quality: 'high', ratio: '1:1', resolution: '2k', prompt: 'A square' })
    assert.equal(calls[2][1].quality, undefined)
    assert.equal(calls[2][1].size, '1:1')

    const references = Array.from({ length: 15 }, (_, index) => `ref-${index}`)
    await image.generate({ model: 'gpt-image-2', prompt: 'Preserve all objects', image: ['', ...references, '  '] })
    assert.deepEqual(calls[3][1].images, references)
    const requestCount = calls.length
    await assert.rejects(
      image.generate({ model: 'gpt-image-2', prompt: 'Preserve all objects', image: [...references, 'ref-16'] }),
      /最多.*15.*参考图/
    )
    assert.equal(calls.length, requestCount, '16 references must fail before sending a request')

    await image.generate({
      model: 'gpt-image-2', prompt: 'Keep the camera prompt', projectId: 'project-1',
      size: '4096x4096', ratio: '16:9', aspect_ratio: '16:9', resolution: '4k', quality: 'high',
      background: 'transparent', output_format: 'jpeg', output_compression: 100, moderation: 'auto',
      enable_sync_mode: true, enable_base64_output: false, image: ['ref-1', 'ref-2']
    })
    assert.deepEqual(calls[4][1], {
      model: 'gpt-image-2', model_name: 'gpt-image-2', prompt: 'Keep the camera prompt',
      projectId: 'project-1', image: 'ref-1', images: ['ref-1', 'ref-2'],
      size: '16:9', resolution: '4k', n: 1
    })

  } finally {
    delete globalThis.__modelRequestMigrationApi
  }
})
