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
    stageStyle: () => stageStyle.value
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
    frameWidth: 396,
    frameHeight: 212,
    naturalWidth: 1920,
    naturalHeight: 1080,
    scale: 0.20625,
    offsetX: 0,
    offsetY: -5.375
  })
  assert.deepEqual(crop.cropRect.value, {
    x: 56,
    y: 30,
    width: 285,
    height: 153
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
    x: 96,
    y: 20,
    width: 285,
    height: 153
  })

  crop.startCropResize('se', { clientX: 140, clientY: 90 })
  eventHandlers.get('mousemove')({ clientX: 180, clientY: 130 })
  assert.deepEqual(crop.cropRect.value, {
    x: 71,
    y: 19,
    width: 325,
    height: 193
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
