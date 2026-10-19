import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { ref } from 'vue'

const source = readFileSync(new URL('./useImageNodeLocalExport.js', import.meta.url), 'utf8')
  .replace("from 'vue'", `from '${import.meta.resolve('vue')}'`)
  .replace("from '@/utils/imageLocalExport'", `from '${new URL('../../../utils/imageLocalExport.js', import.meta.url).href}'`)
  .replace("from '@/utils/imageNodeLayout'", `from '${new URL('../../../utils/imageNodeLayout.js', import.meta.url).href}'`)
const { useImageNodeLocalExport } = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`)

const createHarness = ({ result, error, exportImage, dimensionsReady = true } = {}) => {
  const calls = []
  const activeTool = ref('')
  const displayImageUrl = ref('https://fixture.invalid/original.png')
  const local = useImageNodeLocalExport({
    activeTool,
    cancelCropMode: () => { calls.push(['cancel']); activeTool.value = '' },
    cropRect: () => ({ x: 60, y: 40, width: 240, height: 160 }),
    cropStageMetrics: () => ({ naturalWidth: 1536, naturalHeight: 1024, scale: 360 / 1536, offsetX: 0, offsetY: 0 }),
    displayImageUrl,
    downloadImageBlob: (...args) => calls.push(['download', ...args]),
    exportImage: exportImage || (async (payload) => {
      calls.push(['export', payload])
      if (error) throw error
      return result || { blob: 'png', fileName: 'fixture.png', width: 1024, height: 683 }
    }),
    getFileName: () => 'fixture.webp',
    hasNaturalDimensions: () => dimensionsReady,
    messageApi: { success: (text) => calls.push(['success', text]), error: (text) => calls.push(['error', text]) },
    startCropMode: async (ratio) => { calls.push(['crop', ratio]); activeTool.value = 'crop' }
  })
  return { activeTool, calls, displayImageUrl, local }
}

test('export ratio enters a distinct local crop mode; ordinary Crop remains an editing action', async () => {
  const { activeTool, calls, local } = createHarness()
  await local.startLocalExportCrop('16:9')
  assert.equal(local.localExportCropActive.value, true)
  assert.equal(local.localExportRatio.value, '16:9')
  assert.deepEqual(calls, [['crop', '16:9']])
  activeTool.value = ''
  assert.equal(local.localExportCropActive.value, false)
  await local.startEditingCrop()
  assert.equal(local.localExportCropActive.value, false)
  assert.deepEqual(calls.at(-1), ['crop', undefined])
})

test('local PNG export maps stage crop into natural pixels without changing the original source', async () => {
  const { calls, displayImageUrl, local } = createHarness()
  await local.startLocalExportCrop('3:2')
  await local.downloadLocalImage(2048)
  assert.deepEqual(calls.find(([type]) => type === 'export')[1], {
    source: 'https://fixture.invalid/original.png', maxEdge: 2048, fileName: 'fixture.webp',
    cropRect: { x: 256, y: 171, width: 1024, height: 683 },
    cropSourceSize: { width: 1536, height: 1024 }
  })
  assert.deepEqual(calls.find(([type]) => type === 'download'), ['download', 'png', 'fixture.png'])
  assert.ok(calls.some(([type]) => type === 'cancel'))
  assert.equal(displayImageUrl.value, 'https://fixture.invalid/original.png')
  assert.equal(local.localExportBusy.value, false)
})

test('exporting a full image excludes crop data and keeps export failures retryable', async () => {
  const { calls, local } = createHarness({ error: new Error('CORS blocked') })
  assert.equal(await local.downloadLocalImage(), null)
  assert.equal(calls.find(([type]) => type === 'export')[1].cropRect, null)
  assert.equal(calls.find(([type]) => type === 'export')[1].cropSourceSize, null)
  assert.deepEqual(calls.at(-1), ['error', 'CORS blocked'])
  assert.equal(local.localExportBusy.value, false)
  assert.ok(!calls.some(([type]) => type === 'download' || type === 'cancel'))
})

test('local export refuses unsupported controls, empty sources, and repeated requests while busy', async () => {
  let finish
  const { calls, displayImageUrl, local } = createHarness({ exportImage: () => new Promise((resolve) => { finish = resolve }) })
  await local.startLocalExportCrop('invalid')
  await local.downloadLocalImage(999)
  assert.deepEqual(calls, [])
  displayImageUrl.value = ''
  await local.startLocalExportCrop('1:1')
  await local.downloadLocalImage()
  assert.deepEqual(calls, [])
  displayImageUrl.value = 'fixture.png'
  const pending = local.downloadLocalImage()
  assert.equal(local.localExportBusy.value, true)
  await local.downloadLocalImage(1024)
  await local.startLocalExportCrop('1:1')
  finish({ blob: 'png', fileName: 'fixture.png', width: 1, height: 1 })
  await pending
  assert.equal(calls.filter(([type]) => type === 'download').length, 1)
})


test('local crop waits for image dimensions while full PNG export can decode the source directly', async () => {
  const { activeTool, calls, local } = createHarness({ dimensionsReady: false })
  await local.startLocalExportCrop('1:1')
  assert.deepEqual(calls, [])
  activeTool.value = 'crop'
  await local.downloadLocalImage()
  assert.ok(!calls.some(([type]) => type === 'export'))
  activeTool.value = ''
  await local.downloadLocalImage()
  assert.equal(calls.filter(([type]) => type === 'export').length, 1)
})
