import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { nextTick, ref } from 'vue'
const { GPT_IMAGE_2_RATIOS, GPT_IMAGE_2_RESOLUTION_OPTIONS } = await import(new URL('../../../utils/gptImageParameters.js', import.meta.url).href)

const source = readFileSync(new URL('./useImageNodeModelControls.js', import.meta.url), 'utf8')
  .replace("from 'vue'", `from '${import.meta.resolve('vue')}'`)
  .replace("from '@/utils/gptImageParameters'", `from '${new URL('../../../utils/gptImageParameters.js', import.meta.url).href}'`)
  .replace("from '@/utils/imageNodeLayout'", `from '${new URL('../../../utils/imageNodeLayout.js', import.meta.url).href}'`)
const { useImageNodeModelControls } = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`)
const createHarness = (initial = {}) => {
  const data = ref({ model: 'gpt-image-2', ...initial })
  const updates = []
  const naturalSize = ref({ width: 0, height: 0 })
  const controls = useImageNodeModelControls({
    data, naturalSize, nodeId: 'image-1', defaultImageModel: 'gpt-image-2',
    imageModelOptions: [{ key: 'gpt-image-2', label: 'GPT Image 2' }],
    getModelConfig: () => ({ ratios: GPT_IMAGE_2_RATIOS, resolutions: GPT_IMAGE_2_RESOLUTION_OPTIONS }),
    updateNode: (id, patch) => { updates.push([id, patch]); data.value = { ...data.value, ...patch } }
  })
  return { data, updates, naturalSize, controls }
}

test('new image nodes expose only ratio and resolution with provider defaults', () => {
  const { controls } = createHarness()
  assert.equal(controls.displayImageModel.value, 'GPT Image 2')
  assert.equal(controls.displayRatio.value, '1:1')
  assert.equal(controls.displayResolution.value, '1K')
  assert.equal(controls.ratioDropdownOptions.value.length, 16)
  assert.deepEqual(controls.resolutionDropdownOptions.value.map(item => item.key), ['1k', '2k', '4k'])
  assert.equal(controls.setImageQuality, undefined)
})

test('canonical parameter selection never mutates returned media dimensions or couples Auto ratio', async () => {
  const { controls, data, updates } = createHarness({ url: 'image.png', size: '1536x1024', ratio: '3:2', generationRatio: '16:9', generationResolution: '4k' })
  controls.setImageRatio('auto')
  assert.equal(controls.localResolution.value, '4k')
  controls.setResolution('2k')
  assert.equal(controls.displayRatio.value, 'Auto')
  controls.setImageRatio('9:21')
  await nextTick()
  assert.equal(controls.displayRatio.value, '9:21')
  assert.equal(controls.displayResolution.value, '2K')
  assert.equal(data.value.size, '1536x1024')
  assert.equal(data.value.ratio, '3:2')
  for (const [, patch] of updates) for (const key of ['size', 'ratio', 'quality', 'background']) assert.equal(Object.hasOwn(patch, key), false)
  const count = updates.length
  controls.setResolution('auto')
  controls.setImageRatio('unsupported')
  assert.equal(updates.length, count)
})

test('external updates and retired model keys normalize while stage follows real image dimensions', async () => {
  const { controls, data, naturalSize } = createHarness({ model: 'retired' })
  assert.equal(controls.localImageModel.value, 'gpt-image-2')
  data.value = { generationRatio: '3:1', generationResolution: '4k' }
  await nextTick()
  assert.equal(controls.displayRatio.value, '3:1')
  naturalSize.value = { width: 1536, height: 1024 }
  assert.deepEqual(controls.stageStyle.value, { width: '360px', height: '240px' })
  controls.setImageModel('retired')
  assert.equal(controls.localImageModel.value, 'gpt-image-2')
})
