import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { nextTick, ref } from 'vue'

const cropInteractionUrl = new URL('./useImageNodeCropInteraction.js', import.meta.url)
const layoutUrl = new URL('../../../utils/imageNodeLayout.js', import.meta.url)
const vueUrl = import.meta.resolve('vue')
const cropInteractionSource = readFileSync(cropInteractionUrl, 'utf8')
  .replace("from 'vue'", `from '${vueUrl}'`)
  .replace("from '@/utils/imageNodeLayout'", `from '${layoutUrl.href}'`)
const { useImageNodeCropInteraction } = await import(`data:text/javascript;base64,${Buffer.from(cropInteractionSource).toString('base64')}`)

const createHarness = (overrides = {}) => {
  const calls = []
  const eventHandlers = new Map()
  const hasDisplayImage = ref(overrides.hasDisplayImage ?? true)
  const naturalSize = ref(overrides.naturalSize || { width: 1920, height: 1080 })
  const stageStyle = ref(overrides.stageStyle || { width: '420px', height: '236px' })

  const crop = useImageNodeCropInteraction({
    addWindowEventListener: (type, handler) => {
      calls.push(['add', type])
      eventHandlers.set(type, handler)
    },
    closePreviewModal: () => calls.push(['close-preview']),
    hasDisplayImage: () => hasDisplayImage.value,
    naturalSize: () => naturalSize.value,
    onApply: () => calls.push(['apply']),
    removeWindowEventListener: (type, handler) => {
      calls.push(['remove', type])
      if (eventHandlers.get(type) === handler) {
        eventHandlers.delete(type)
      }
    },
    stageStyle: () => stageStyle.value,
    viewportZoom: () => overrides.viewportZoom || 1
  })

  return {
    calls,
    crop,
    eventHandlers,
    hasDisplayImage,
    naturalSize,
    stageStyle
  }
}

test('image node crop interaction enters crop mode and initializes a centered crop rect', async () => {
  const { calls, crop, eventHandlers } = createHarness()

  await crop.startCropMode()
  await nextTick()

  assert.equal(crop.activeTool.value, 'crop')
  assert.deepEqual(crop.cropStageMetrics.value, {
    frameWidth: 420,
    frameHeight: 236,
    naturalWidth: 1920,
    naturalHeight: 1080,
    scale: 0.21875,
    offsetX: 0,
    offsetY: -0.125
  })
  assert.deepEqual(crop.cropRect.value, {
    x: 59,
    y: 33,
    width: 302,
    height: 170
  })
  assert.deepEqual(calls, [['close-preview'], ['add', 'keydown']])
  assert.equal(eventHandlers.has('keydown'), true)
})

test('image node crop interaction skips crop mode without a display image', async () => {
  const { calls, crop } = createHarness({ hasDisplayImage: false })

  await crop.startCropMode()

  assert.equal(crop.activeTool.value, '')
  assert.deepEqual(calls, [])
})

test('image node crop interaction handles drag, resize, and pointer listener cleanup', async () => {
  const { crop, eventHandlers } = createHarness()
  await crop.startCropMode()

  crop.startCropDrag({ clientX: 100, clientY: 100 })
  assert.equal(eventHandlers.has('mousemove'), true)
  assert.equal(eventHandlers.has('mouseup'), true)
  eventHandlers.get('mousemove')({ clientX: 140, clientY: 90 })
  assert.deepEqual(crop.cropRect.value, {
    x: 99,
    y: 23,
    width: 302,
    height: 170
  })

  crop.startCropResize('se', { clientX: 140, clientY: 90 })
  eventHandlers.get('mousemove')({ clientX: 180, clientY: 130 })
  assert.deepEqual(crop.cropRect.value, {
    x: 78,
    y: 23,
    width: 342,
    height: 210
  })

  crop.stopCropInteraction()
  assert.equal(crop.cropInteraction.value, null)
  assert.equal(eventHandlers.has('mousemove'), false)
  assert.equal(eventHandlers.has('mouseup'), false)
})

test('image node crop interaction maps keyboard shortcuts to apply and cancel actions', async () => {
  const { calls, crop, eventHandlers } = createHarness()
  await crop.startCropMode()
  await nextTick()

  let enterPrevented = false
  eventHandlers.get('keydown')({
    key: 'Enter',
    preventDefault: () => {
      enterPrevented = true
    }
  })
  assert.equal(enterPrevented, true)
  assert.deepEqual(calls.slice(-1), [['apply']])

  let escapePrevented = false
  eventHandlers.get('keydown')({
    key: 'Escape',
    preventDefault: () => {
      escapePrevented = true
    }
  })
  await nextTick()

  assert.equal(escapePrevented, true)
  assert.equal(crop.activeTool.value, '')
  assert.ok(calls.some((call) => call[0] === 'remove' && call[1] === 'keydown'))
})


test('export crop mode starts with the selected fixed ratio and clears its lock when cancelled', async () => {
  const { crop } = createHarness({ stageStyle: { width: '360px', height: '240px' }, naturalSize: { width: 1536, height: 1024 } })
  await crop.startCropMode('1:1')
  assert.equal(crop.cropAspectRatio.value, '1:1')
  assert.deepEqual(crop.cropRect.value, { x: 60, y: 0, width: 240, height: 240 })
  crop.cancelCropMode()
  assert.equal(crop.cropAspectRatio.value, '')
  await crop.startCropMode()
  assert.equal(crop.cropAspectRatio.value, '')
})

test('crop Enter leaves focused menus and buttons to their own keyboard action', async () => {
  const { calls, crop } = createHarness()
  await crop.startCropMode('1:1')
  const event = { key: 'Enter', target: { closest: () => ({}) }, preventDefault: () => assert.fail('Menu Enter must not apply crop') }
  crop.handleCropKeydown(event)
  assert.ok(!calls.some(([type]) => type === 'apply'))
})


test('crop drag uses canvas coordinates at half and double viewport zoom', async () => {
  for (const zoom of [0.5, 2]) {
    const { crop, eventHandlers } = createHarness({ viewportZoom: zoom })
    await crop.startCropMode('1:1')
    const before = { ...crop.cropRect.value }
    crop.startCropDrag({ clientX: 200, clientY: 200 })
    eventHandlers.get('mousemove')({ clientX: 200 + 20 * zoom, clientY: 200 })
    assert.equal(crop.cropRect.value.x, before.x + 20)
    assert.equal(crop.cropRect.value.width, before.width)
    crop.stopCropInteraction()
    crop.startCropResize('se', { clientX: 200, clientY: 200 })
    eventHandlers.get('mousemove')({ clientX: 200 - 20 * zoom, clientY: 200 - 20 * zoom })
    assert.equal(crop.cropRect.value.width, before.width - 20)
    assert.equal(crop.cropRect.value.height, before.height - 20)
  }
})

test('starting crop on a second image cancels the previous editing crop and its Enter listener', async () => {
  const editing = createHarness()
  const exporting = createHarness()
  await editing.crop.startCropMode()
  await nextTick()
  const previousEnter = editing.eventHandlers.get('keydown')
  await exporting.crop.startCropMode('1:1')
  await nextTick()
  assert.equal(editing.crop.activeTool.value, '')
  assert.equal(editing.eventHandlers.has('keydown'), false)
  previousEnter({ key: 'Enter', preventDefault() {} })
  exporting.eventHandlers.get('keydown')({ key: 'Enter', preventDefault() {} })
  assert.equal(editing.calls.filter(([type]) => type === 'apply').length, 0)
  assert.equal(exporting.calls.filter(([type]) => type === 'apply').length, 1)
})
