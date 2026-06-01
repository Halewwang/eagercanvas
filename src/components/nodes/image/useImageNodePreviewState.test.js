import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { nextTick } from 'vue'

const previewStateUrl = new URL('./useImageNodePreviewState.js', import.meta.url)
const layoutUrl = new URL('../../../utils/imageNodeLayout.js', import.meta.url)
const vueUrl = import.meta.resolve('vue')
const previewStateSource = readFileSync(previewStateUrl, 'utf8')
  .replace("from 'vue'", `from '${vueUrl}'`)
  .replace("from '@/utils/imageNodeLayout'", `from '${layoutUrl.href}'`)
const {
  PREVIEW_MAX_ZOOM,
  PREVIEW_MIN_ZOOM,
  useImageNodePreviewState
} = await import(`data:text/javascript;base64,${Buffer.from(previewStateSource).toString('base64')}`)

const createStage = (overrides = {}) => ({
  clientWidth: overrides.clientWidth ?? 900,
  clientHeight: overrides.clientHeight ?? 700,
  scrollLeft: overrides.scrollLeft ?? 0,
  scrollTop: overrides.scrollTop ?? 0
})

const createHarness = () => {
  const listeners = []
  const stage = createStage()
  const preview = useImageNodePreviewState({
    getWindowSize: () => ({ width: 1200, height: 900 }),
    addWindowEventListener: (type, handler) => listeners.push(['add', type, handler]),
    removeWindowEventListener: (type, handler) => listeners.push(['remove', type, handler])
  })
  preview.previewModalRef.value = {
    getStageElement: () => stage
  }

  return {
    listeners,
    preview,
    stage
  }
}

test('image node preview state opens the modal, measures the stage, and removes resize listeners', async () => {
  const { listeners, preview } = createHarness()

  preview.previewZoom.value = 2
  preview.openPreviewModal()
  await nextTick()
  await nextTick()

  assert.equal(preview.showPreviewModal.value, true)
  assert.equal(preview.previewZoom.value, 1)
  assert.deepEqual(preview.previewStageSize.value, { width: 900, height: 700 })
  assert.equal(listeners[0][0], 'add')
  assert.equal(listeners[0][1], 'resize')

  preview.showPreviewModal.value = false
  await nextTick()
  assert.equal(listeners.at(-1)[0], 'remove')
  assert.equal(listeners.at(-1)[1], 'resize')
})

test('image node preview state preserves viewport focus when zooming and clamps zoom bounds', async () => {
  const { preview, stage } = createHarness()
  stage.clientWidth = 500
  stage.clientHeight = 400
  stage.scrollLeft = 100
  stage.scrollTop = 50

  preview.previewStageSize.value = { width: 900, height: 700 }
  preview.previewNaturalSize.value = { width: 2000, height: 1000 }

  preview.setPreviewZoom(2)
  await nextTick()

  assert.equal(preview.previewZoom.value, 2)
  assert.equal(Math.round(stage.scrollLeft), 450)
  assert.equal(Math.round(stage.scrollTop), 126)

  preview.setPreviewZoom(99)
  assert.equal(preview.previewZoom.value, PREVIEW_MAX_ZOOM)

  preview.setPreviewZoom(0)
  assert.equal(preview.previewZoom.value, PREVIEW_MIN_ZOOM)
})

test('image node preview state updates natural image size from load events and re-centers visible modals', async () => {
  const { preview, stage } = createHarness()
  preview.openPreviewModal()
  await nextTick()

  const result = preview.setPreviewNaturalSizeFromEvent({
    target: {
      naturalWidth: 1600,
      naturalHeight: 900
    }
  })
  await nextTick()

  assert.deepEqual(result, { width: 1600, height: 900 })
  assert.deepEqual(preview.previewNaturalSize.value, { width: 1600, height: 900 })
  assert.equal(stage.scrollLeft, 0)
  assert.equal(stage.scrollTop, 0)

  assert.equal(preview.setPreviewNaturalSizeFromEvent(null), null)
})
