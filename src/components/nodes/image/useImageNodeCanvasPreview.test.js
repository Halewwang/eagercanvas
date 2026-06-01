import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { ref } from 'vue'

const canvasPreviewUrl = new URL('./useImageNodeCanvasPreview.js', import.meta.url)
const imagePreviewCacheUrl = new URL('../../../utils/imagePreviewCache.js', import.meta.url)
const vueUrl = import.meta.resolve('vue')
const canvasPreviewSource = readFileSync(canvasPreviewUrl, 'utf8')
  .replace("from 'vue'", `from '${vueUrl}'`)
  .replace("from '@/utils/imagePreviewCache'", `from '${imagePreviewCacheUrl.href}'`)
const { useImageNodeCanvasPreview } = await import(`data:text/javascript;base64,${Buffer.from(canvasPreviewSource).toString('base64')}`)

const createDeferred = () => {
  let resolve
  let reject
  const promise = new Promise((promiseResolve, promiseReject) => {
    resolve = promiseResolve
    reject = promiseReject
  })
  return { promise, reject, resolve }
}

const createCanvasPreviewHarness = (overrides = {}) => {
  const activeTool = ref(overrides.activeTool || '')
  const displayImageUrl = ref(overrides.displayImageUrl || 'https://cdn.example.com/image.png')
  const isCanvasInteracting = ref(overrides.isCanvasInteracting || false)
  const calls = []
  const preview = useImageNodeCanvasPreview({
    activeTool: () => activeTool.value,
    displayImageUrl: () => displayImageUrl.value,
    generatePreviewDataUrl: overrides.generatePreviewDataUrl || (async (source) => {
      calls.push(['generate', source])
      return 'data:generated'
    }),
    isCanvasInteracting: () => isCanvasInteracting.value,
    loadCachedPreview: overrides.loadCachedPreview || (async (source) => {
      calls.push(['load', source])
      return null
    }),
    saveCachedPreview: overrides.saveCachedPreview || (async (source, previewUrl) => {
      calls.push(['save', source, previewUrl])
      return true
    }),
    watchSources: false
  })

  return {
    activeTool,
    calls,
    displayImageUrl,
    isCanvasInteracting,
    preview
  }
}

test('image node canvas preview uses cached low resolution previews for canvas display', async () => {
  const { calls, preview } = createCanvasPreviewHarness({
    loadCachedPreview: async (source) => {
      calls.push(['load', source])
      return { previewUrl: 'data:cached' }
    },
    generatePreviewDataUrl: async () => {
      throw new Error('generation should not run when cache exists')
    }
  })

  await preview.syncCanvasImagePreview()

  assert.equal(preview.canvasPreviewState.value, 'ready')
  assert.equal(preview.cachedCanvasPreviewUrl.value, 'data:cached')
  assert.equal(preview.canvasDisplayImageUrl.value, 'data:cached')
  assert.deepEqual(calls, [['load', 'https://cdn.example.com/image.png']])
})

test('image node canvas preview generates and saves a low resolution preview when cache is missing', async () => {
  const { calls, preview } = createCanvasPreviewHarness()

  await preview.syncCanvasImagePreview()

  assert.equal(preview.canvasPreviewState.value, 'ready')
  assert.equal(preview.cachedCanvasPreviewUrl.value, 'data:generated')
  assert.equal(preview.canvasDisplayImageUrl.value, 'data:generated')
  assert.deepEqual(calls, [
    ['load', 'https://cdn.example.com/image.png'],
    ['generate', 'https://cdn.example.com/image.png'],
    ['save', 'https://cdn.example.com/image.png', 'data:generated']
  ])
})

test('image node canvas preview preserves full source while cropping and falls back to source on failures', async () => {
  const { activeTool, preview } = createCanvasPreviewHarness({
    activeTool: 'crop',
    generatePreviewDataUrl: async () => ''
  })

  assert.equal(preview.canvasDisplayImageUrl.value, 'https://cdn.example.com/image.png')

  activeTool.value = ''
  await preview.syncCanvasImagePreview()

  assert.equal(preview.canvasPreviewState.value, 'failed')
  assert.equal(preview.canvasDisplayImageUrl.value, 'https://cdn.example.com/image.png')
})

test('image node canvas preview ignores stale async cache results after the source changes', async () => {
  const deferred = createDeferred()
  const { calls, displayImageUrl, preview } = createCanvasPreviewHarness({
    loadCachedPreview: async (source) => {
      calls.push(['load', source])
      if (source.endsWith('image.png')) return deferred.promise
      return { previewUrl: 'data:next' }
    },
    generatePreviewDataUrl: async () => {
      throw new Error('generation should not run in stale-cache test')
    }
  })

  const firstSync = preview.syncCanvasImagePreview()
  displayImageUrl.value = 'https://cdn.example.com/next.png'
  await preview.syncCanvasImagePreview()
  deferred.resolve({ previewUrl: 'data:stale' })
  await firstSync

  assert.equal(preview.canvasPreviewState.value, 'ready')
  assert.equal(preview.cachedCanvasPreviewUrl.value, 'data:next')
  assert.equal(preview.canvasDisplayImageUrl.value, 'data:next')
  assert.deepEqual(calls, [
    ['load', 'https://cdn.example.com/image.png'],
    ['load', 'https://cdn.example.com/next.png']
  ])
})
