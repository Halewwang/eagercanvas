import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import test from 'node:test'
import { nextTick, ref } from 'vue'

const modelControlsUrl = new URL('./useImageNodeModelControls.js', import.meta.url)
const modelControlsPath = fileURLToPath(modelControlsUrl)
const layoutUrl = new URL('../../../utils/imageNodeLayout.js', import.meta.url)
const vueUrl = import.meta.resolve('vue')

const loadModelControls = async () => {
  assert.ok(existsSync(modelControlsPath), 'useImageNodeModelControls.js should exist')
  const modelControlsSource = readFileSync(modelControlsUrl, 'utf8')
    .replace("from 'vue'", `from '${vueUrl}'`)
    .replace("from '@/utils/imageNodeLayout'", `from '${layoutUrl.href}'`)
  return import(`data:text/javascript;base64,${Buffer.from(modelControlsSource).toString('base64')}`)
}

const createHarness = async (overrides = {}) => {
  const { useImageNodeModelControls } = await loadModelControls()
  const updates = []
  const data = ref(overrides.data || {
    model: 'model-a',
    size: '1024x1024',
    quality: 'standard',
    background: 'auto',
    output_format: 'png'
  })
  const imageModelOptions = ref([
    { key: 'model-a', label: 'Model A' },
    { key: 'model-b', label: 'Model B' },
    { key: 'gpt-image-2', label: 'GPT Image 2' }
  ])
  const naturalSize = ref(overrides.naturalSize || { width: 0, height: 0 })
  const configs = {
    'model-a': {
      defaultParams: {
        size: '1024x1024',
        quality: 'standard',
        background: 'auto',
        output_format: 'png'
      },
      sizes: ['1024x1024', '2048x2048', '1280x720', '2560x1440'],
      ratios: ['1:1', '16:9'],
      resolutions: [{ key: '1k' }, { key: '2k' }],
      qualities: [
        { key: 'standard', label: 'Standard' },
        { key: 'hd', label: 'HD' }
      ],
      backgrounds: [
        { key: 'auto', label: 'Auto' },
        { key: 'transparent', label: 'Transparent' }
      ],
      outputFormats: [
        { key: 'png', label: 'PNG' },
        { key: 'webp', label: 'WEBP' }
      ],
      showAdvancedCapsuleParams: true
    },
    'model-b': {
      defaultParams: {
        size: '1280x720',
        quality: 'hd',
        background: 'transparent',
        output_format: 'webp'
      },
      sizes: ['1280x720', '2560x1440'],
      ratios: ['16:9'],
      resolutions: [{ key: '1k' }, { key: '2k' }],
      qualities: [
        { key: 'standard', label: 'Standard' },
        { key: 'hd', label: 'HD' }
      ],
      backgrounds: [
        { key: 'auto', label: 'Auto' },
        { key: 'transparent', label: 'Transparent' }
      ],
      outputFormats: [
        { key: 'png', label: 'PNG' },
        { key: 'webp', label: 'WEBP' }
      ],
      showAdvancedCapsuleParams: true
    },
    'gpt-image-2': {
      defaultParams: {
        size: 'auto',
        quality: 'auto',
        background: 'auto',
        output_format: 'png'
      },
      resolutions: [
        { key: '1k', label: '1K' },
        { key: '2k', label: '2K' }
      ],
      sizes: ['auto'],
      ratios: ['1:1', '16:9', '21:9'],
      hideRatioCapsule: false
    }
  }
  if (overrides.config) configs['gpt-image-2'] = overrides.config
  const controls = useImageNodeModelControls({
    buildModelParamsPatch: (payload) => ({ type: 'model', ...payload }),
    buildSizeParamsPatch: (payload) => ({ type: 'size', ...payload }),
    data: () => data.value,
    defaultImageModel: 'model-a',
    defaultImageSize: '1024x1024',
    getModelConfig: (key) => configs[key],
    getModelSizeOptions: (key) => (configs[key]?.sizes || []).map((size) => ({ key: size, label: size })),
    imageModelOptions,
    nodeId: () => 'node-1',
    naturalSize,
    resolveGptImage2Size: ({ ratio, resolution }) => `${ratio}-${resolution}`,
    updateNode: (id, patch) => updates.push([id, patch])
  })

  return {
    controls,
    data,
    imageModelOptions,
    naturalSize,
    updates
  }
}

test('image node model controls expose capsule options and display labels from local data', async () => {
  const { controls } = await createHarness()

  assert.equal(controls.localImageModel.value, 'model-a')
  assert.equal(controls.localImageSize.value, '1024x1024')
  assert.equal(controls.displayImageModel.value, 'Model A')
  assert.equal(controls.displayRatio.value, '1:1')
  assert.equal(controls.displayResolution.value, '1K')
  assert.deepEqual(controls.stageStyle.value, { width: '320px', height: '320px' })
  assert.deepEqual(controls.moduleStyle.value, { width: 'calc(320px + 2px)' })
  assert.deepEqual(controls.imageModelDropdownOptions.value, [
    { key: 'model-a', label: 'Model A' },
    { key: 'model-b', label: 'Model B' },
    { key: 'gpt-image-2', label: 'GPT Image 2' }
  ])
  assert.deepEqual(controls.ratioDropdownOptions.value.map((item) => item.key), ['1:1', '16:9'])
  assert.deepEqual(controls.resolutionDropdownOptions.value.map((item) => item.key), ['1k', '2k'])
  assert.equal(controls.displayQualityControl.value, 'Standard')
  assert.equal(controls.displayBackgroundControl, undefined)
  assert.equal(controls.setBackground, undefined)
  assert.equal(controls.displayFormatControl.value, 'Format')
})

test('image node model controls switch models through one node patch', async () => {
  const { controls, updates } = await createHarness()

  controls.setImageModel('model-b')

  assert.equal(controls.localImageModel.value, 'model-b')
  assert.equal(controls.localImageSize.value, '1280x720')
  assert.equal(controls.localImageRatio.value, '16:9')
  assert.equal(controls.localResolution.value, '1k')
  assert.equal(controls.localImageQuality.value, 'hd')
  assert.equal(controls.localBackground.value, 'transparent')
  assert.equal(controls.localOutputFormat.value, 'webp')
  assert.deepEqual(updates, [[
    'node-1',
    {
      type: 'model',
      model: 'model-b',
      size: '1280x720',
      quality: 'hd',
      background: 'transparent',
      outputFormat: 'webp',
      ratio: '16:9',
      resolution: '1k'
    }
  ]])
})

test('image node model controls patch nearest size when ratio or resolution changes', async () => {
  const { controls, updates } = await createHarness()

  controls.setImageRatio('16:9')
  controls.setResolution('2k')

  assert.equal(controls.localImageRatio.value, '16:9')
  assert.equal(controls.localResolution.value, '2k')
  assert.equal(controls.localImageSize.value, '2560x1440')
  assert.equal(controls.findNearestSizeKey('16:9', '1k'), '1280x720')
  assert.deepEqual(updates, [
    ['node-1', { type: 'size', size: '1280x720', ratio: '16:9', resolution: '1k' }],
    ['node-1', { type: 'size', size: '2560x1440', ratio: '16:9', resolution: '2k' }]
  ])
})

test('image node model controls sync when node data changes externally', async () => {
  const { controls, data } = await createHarness()

  data.value = {
    model: 'model-b',
    size: '2560x1440',
    quality: 'hd',
    background: 'transparent',
    outputFormat: 'webp'
  }
  await nextTick()

  assert.equal(controls.localImageModel.value, 'model-b')
  assert.equal(controls.localImageSize.value, '2560x1440')
  assert.equal(controls.localImageRatio.value, '16:9')
  assert.equal(controls.localResolution.value, '2k')
  assert.equal(controls.localImageQuality.value, 'hd')
  assert.equal(controls.localBackground.value, 'transparent')
  assert.equal(controls.localOutputFormat.value, 'webp')
})

test('image node model controls keep gpt image 2 ratios and resolved size semantics', async () => {
  const { controls, data } = await createHarness({
    data: {
      model: 'gpt-image-2',
      size: 'auto',
      ratio: 'auto',
      resolution: '1k',
      quality: 'auto',
      background: 'auto',
      output_format: 'png'
    }
  })

  assert.equal(controls.displayRatio.value, 'Auto')
  assert.equal(controls.ratioDropdownOptions.value.at(-1).key, '21:9')

  controls.setImageRatio('16:9')
  controls.setResolution('2k')
  assert.equal(controls.localImageSize.value, '16:9-2k')

  data.value = { ...data.value, ratio: 'auto', size: 'auto' }
  await nextTick()
  assert.equal(controls.findNearestSizeKey('auto', '2k'), 'auto')
})

test('image node model controls replace retired models from saved canvas data', async () => {
  const { controls, data, imageModelOptions } = await createHarness({
    data: { model: 'gemini-3.1-flash-image-preview', size: '1024x1024' }
  })
  assert.equal(controls.localImageModel.value, 'model-a')
  imageModelOptions.value = [{ key: 'model-a', label: 'Model A' }]
  data.value = { model: 'gpt-image-lite', size: '2048x2048' }
  await nextTick()
  assert.equal(controls.localImageModel.value, 'model-a')
  controls.setImageModel('gemini-3-pro-image-preview')
  assert.equal(controls.localImageModel.value, 'model-a')
})


test('empty image capabilities do not recreate parameter controls from saved values', async () => {
  const { controls } = await createHarness({
    data: { model: 'gpt-image-2', ratio: '16:9', size: '4096x2304', resolution: '4k', quality: 'high', background: 'transparent', output_format: 'jpeg' },
    config: { sizes: [], ratios: [], resolutions: [], qualities: [], backgrounds: [], outputFormats: [], defaultParams: {}, showAdvancedCapsuleParams: true }
  })
  for (const name of ['imageSizeOptions', 'ratioDropdownOptions', 'resolutionDropdownOptions', 'qualityDropdownOptions', 'formatDropdownOptions']) {
    assert.deepEqual(controls[name].value, [], name)
  }
})

test('image stage follows loaded image dimensions instead of saved generation parameters', async () => {
  const { controls, naturalSize } = await createHarness({
    data: { model: 'gpt-image-2', ratio: '9:16', size: '2160x3840' }
  })
  naturalSize.value = { width: 1536, height: 1024 }
  assert.deepEqual(controls.stageStyle.value, { width: '360px', height: '240px' })
  naturalSize.value = { width: 1024, height: 1536 }
  assert.deepEqual(controls.stageStyle.value, { width: '240px', height: '360px' })
})

test('selecting an image model without output size controls preserves media dimensions', async () => {
  const { controls, data, updates } = await createHarness({
    data: { model: 'gpt-image-2', size: '1536x1024', ratio: '3:2', background: 'opaque' },
    config: { sizes: [], ratios: [], resolutions: [], qualities: [], backgrounds: [{ key: 'auto' }, { key: 'opaque' }], defaultParams: { background: 'auto' } }
  })
  controls.setImageModel('gpt-image-2')
  const patch = updates.at(-1)[1]
  assert.equal(Object.hasOwn(patch, 'size'), false)
  assert.equal(Object.hasOwn(patch, 'ratio'), false)
  const result = { ...data.value, ...patch }
  assert.equal(result.size, '1536x1024')
  assert.equal(result.ratio, '3:2')
})
