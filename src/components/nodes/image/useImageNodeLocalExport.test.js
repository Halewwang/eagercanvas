import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { nextTick, ref } from 'vue'

const source = readFileSync(new URL('./useImageNodeLocalExport.js', import.meta.url), 'utf8')
  .replace("from 'vue'", `from '${import.meta.resolve('vue')}'`)
  .replace("from '@/utils/imageLocalExport'", `from '${new URL('../../../utils/imageLocalExport.js', import.meta.url).href}'`)
  .replace("from '@/utils/imageNodeLayout'", `from '${new URL('../../../utils/imageNodeLayout.js', import.meta.url).href}'`)
const { IMAGE_EXPORT_RATIO_OPTIONS, IMAGE_EXPORT_SIZE_OPTIONS, useImageNodeLocalExport } = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`)

const createHarness = ({ result, error, exportImage, dimensionsReady = true, sourceUrl = 'https://fixture.invalid/original.png', initialData = {} } = {}) => {
  const calls = []
  const activeTool = ref('')
  const data = ref(initialData)
  const displayImageUrl = ref(sourceUrl)
  const local = useImageNodeLocalExport({
    activeTool,
    cancelCropMode: () => { calls.push(['cancel']); activeTool.value = '' },
    cropRect: () => ({ x: 60, y: 40, width: 240, height: 160 }),
    cropStageMetrics: () => ({ naturalWidth: 1536, naturalHeight: 1024, scale: 360 / 1536, offsetX: 0, offsetY: 0 }),
    data,
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
    nodeId: () => 'image-fixture',
    startCropMode: async (ratio) => { calls.push(['crop', ratio]); activeTool.value = 'crop' },
    updateNode: (id, patch) => {
      calls.push(['update', id, patch])
      data.value = { ...data.value, ...patch }
    }
  })
  return { activeTool, calls, data, displayImageUrl, local }
}

test('empty nodes can preselect and persist export controls before an image or dimensions exist', async () => {
  const { calls, data, local } = createHarness({ sourceUrl: '', dimensionsReady: false })
  assert.equal(local.localExportRatio.value, '1:1')
  assert.equal(local.localExportSize.value, 1024)
  await local.startLocalExportCrop('16:9')
  local.setLocalExportSize(4096)
  assert.deepEqual(data.value, { exportRatio: '16:9', exportSize: 4096 })
  assert.deepEqual(calls, [
    ['update', 'image-fixture', { exportRatio: '16:9' }],
    ['update', 'image-fixture', { exportSize: 4096 }]
  ])
  assert.equal(local.localExportCropActive.value, false)
})

test('existing images retain original settings and synchronize validated external changes', async () => {
  const { calls, data, local } = createHarness()
  assert.equal(local.localExportRatio.value, '')
  assert.equal(local.localExportSize.value, 0)
  assert.equal(IMAGE_EXPORT_RATIO_OPTIONS[0].key, '')
  assert.deepEqual(IMAGE_EXPORT_SIZE_OPTIONS.map(({ key }) => key), [0, 1024, 2048, 4096])
  data.value = { exportRatio: '4:5', exportSize: 2048 }
  await nextTick()
  assert.equal(local.localExportRatio.value, '4:5')
  assert.equal(local.localExportSize.value, 2048)
  data.value = { exportRatio: 'bad', exportSize: '4096' }
  await nextTick()
  assert.equal(local.localExportRatio.value, '')
  assert.equal(local.localExportSize.value, 0)
  assert.deepEqual(calls, [])
})

test('saved 4K and ratio are used for download without requiring a live crop box', async () => {
  const { calls, local } = createHarness({ initialData: { exportRatio: '16:9', exportSize: 4096 } })
  await local.downloadLocalImage()
  assert.deepEqual(calls.find(([type]) => type === 'export')[1], {
    source: 'https://fixture.invalid/original.png', maxEdge: 4096, aspectRatio: '16:9', fileName: 'fixture.webp',
    cropRect: null, cropSourceSize: null
  })
})

for (const ratio of ['', '16:9']) {
  test(`external ratio change to ${ratio || 'Original'} discards the stale local crop before download`, async () => {
    const { activeTool, calls, data, local } = createHarness({ initialData: { exportRatio: '', exportSize: 4096 } })
    await local.startLocalExportCrop('1:1')
    assert.equal(local.localExportCropActive.value, true)
    data.value = { ...data.value, exportRatio: ratio }
    await nextTick()
    assert.equal(local.localExportRatio.value, ratio)
    assert.equal(activeTool.value, '')
    assert.equal(local.localExportCropActive.value, false)
    assert.equal(calls.filter(([type]) => type === 'cancel').length, 1)
    await local.downloadLocalImage()
    const payload = calls.find(([type]) => type === 'export')[1]
    assert.equal(payload.aspectRatio, ratio)
    assert.equal(payload.cropRect, null)
    assert.equal(payload.cropSourceSize, null)
    assert.equal(payload.maxEdge, 4096)
  })
}

test('external ratio updates preserve ordinary editing crop and local selections do not cancel themselves', async () => {
  const { activeTool, calls, data, local } = createHarness()
  await local.startLocalExportCrop('1:1')
  await local.startLocalExportCrop('16:9')
  assert.equal(local.localExportCropActive.value, true)
  assert.equal(calls.filter(([type]) => type === 'cancel').length, 0)
  await local.startEditingCrop()
  data.value = { ...data.value, exportRatio: '' }
  await nextTick()
  assert.equal(activeTool.value, 'crop')
  assert.equal(local.localExportCropActive.value, false)
  assert.equal(calls.filter(([type]) => type === 'cancel').length, 0)
})

test('selecting original ratio cancels only local crop and ordinary editing keeps saved parameters', async () => {
  const { activeTool, calls, data, local } = createHarness({ initialData: { exportSize: 4096 } })
  await local.startLocalExportCrop('3:2')
  await local.startLocalExportCrop('')
  assert.equal(activeTool.value, '')
  assert.equal(local.localExportCropActive.value, false)
  assert.equal(calls.filter(([type]) => type === 'cancel').length, 1)
  await local.startLocalExportCrop('4:5')
  await local.startEditingCrop()
  assert.deepEqual(data.value, { exportRatio: '4:5', exportSize: 4096 })
  assert.equal(local.localExportCropActive.value, false)
  await local.startLocalExportCrop('')
  assert.equal(activeTool.value, 'crop')
  assert.equal(calls.filter(([type]) => type === 'cancel').length, 1)
})

test('export ratio enters a distinct local crop mode; ordinary Crop remains an editing action', async () => {
  const { activeTool, calls, local } = createHarness()
  await local.startLocalExportCrop('16:9')
  assert.equal(local.localExportCropActive.value, true)
  assert.equal(local.localExportRatio.value, '16:9')
  assert.deepEqual(calls, [['update', 'image-fixture', { exportRatio: '16:9' }], ['crop', '16:9']])
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
    source: 'https://fixture.invalid/original.png', maxEdge: 2048, aspectRatio: '3:2', fileName: 'fixture.webp',
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
  local.setLocalExportSize('4096')
  local.setLocalExportSize(999)
  await local.downloadLocalImage(999)
  assert.deepEqual(calls, [])
  displayImageUrl.value = ''
  await local.startLocalExportCrop('1:1')
  await local.downloadLocalImage()
  assert.deepEqual(calls, [['update', 'image-fixture', { exportRatio: '1:1' }]])
  displayImageUrl.value = 'fixture.png'
  const pending = local.downloadLocalImage()
  assert.equal(local.localExportBusy.value, true)
  await local.downloadLocalImage(1024)
  await local.startLocalExportCrop('1:1')
  local.setLocalExportSize(4096)
  assert.equal(local.localExportSize.value, 0)
  finish({ blob: 'png', fileName: 'fixture.png', width: 1, height: 1 })
  await pending
  assert.equal(calls.filter(([type]) => type === 'download').length, 1)
})


test('local crop waits for image dimensions while full PNG export can decode the source directly', async () => {
  const { activeTool, calls, local } = createHarness({ dimensionsReady: false })
  await local.startLocalExportCrop('1:1')
  assert.deepEqual(calls, [['update', 'image-fixture', { exportRatio: '1:1' }]])
  activeTool.value = 'crop'
  await local.downloadLocalImage()
  assert.ok(!calls.some(([type]) => type === 'export'))
  activeTool.value = ''
  await local.downloadLocalImage()
  assert.equal(calls.filter(([type]) => type === 'export').length, 1)
})
