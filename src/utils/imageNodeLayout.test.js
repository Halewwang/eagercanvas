import assert from 'node:assert/strict'
import test from 'node:test'

import {
  getImageNodeRatioFromSizeKey,
  getImageNodeResolutionFromSizeKey,
  getImageNodeStageRatio,
  getImageNodeStageStyle,
  getImagePreviewCanvasStyle,
  getImagePreviewRenderedSize,
  getImagePreviewViewportSize,
  getImagePreviewCenteredScroll,
  getImagePreviewZoomFocus,
  getImagePreviewZoomScroll,
  normalizeImagePreviewZoom,
  getImageNodeCropBoxStyle,
  getImageNodeCropMaskStyles,
  getImageNodeCropStageMetrics,
  getImageNodeInitialCropRect,
  normalizeImageNodeCropRect,
  getImageNodeCropInteractionRect,
  getImageNodeCropSourceRect,
  getImageNodeRatioLabel,
  getImageNodeToolOptions,
  getImageNodeSelectOptions,
  getImageNodeSizeMetaOptions,
  getImageNodeRatioDropdownOptions,
  getImageNodeResolutionDropdownOptions,
  getImageNodeAdvancedDropdownOptions,
  getImageNodeOptionDisplayLabel,
  getImageNodeControlDisplayLabel,
  getImageNodeRatioDisplayLabel,
  getImageNodeSizeSelection,
  getImageNodeNearestSizeKey,
  getImageNodeProgressPercent,
  getImageNodeProgressBarStyle,
  getImageNodeProgressNextValue,
  getImageNodeFinishProgressNextValue,
  getImageNodeUploadProgressStyle
} from './imageNodeLayout.js'

const getOption = (options, key) => options.find((option) => option.key === key)

test('image node ratio keys preserve model size aspect buckets', () => {
  assert.equal(getImageNodeRatioFromSizeKey('auto'), 'auto')
  assert.equal(getImageNodeRatioFromSizeKey('1536x1024'), '3:2')
  assert.equal(getImageNodeRatioFromSizeKey('1024x1536'), '2:3')
  assert.equal(getImageNodeRatioFromSizeKey('1920x1080'), '16:9')
  assert.equal(getImageNodeRatioFromSizeKey('1080x1920'), '9:16')
  assert.equal(getImageNodeRatioFromSizeKey('997x333'), '1:1')
})

test('image node resolution keys match the previous base-size scale thresholds', () => {
  assert.equal(getImageNodeResolutionFromSizeKey('auto'), '1k')
  assert.equal(getImageNodeResolutionFromSizeKey('1024x1024'), '1k')
  assert.equal(getImageNodeResolutionFromSizeKey('2048x2048'), '2k')
  assert.equal(getImageNodeResolutionFromSizeKey('4096x4096'), '4k')
  assert.equal(getImageNodeResolutionFromSizeKey('2304x1536'), '2k')
  assert.equal(getImageNodeResolutionFromSizeKey('4608x3072'), '4k')
})

test('image node stage ratio prefers explicit ratios and falls back to size parsing', () => {
  assert.equal(getImageNodeStageRatio({ ratio: '3:2', size: '1024x1024' }), '3:2')
  assert.equal(getImageNodeStageRatio({ ratio: 'auto', size: '1920x1080' }), '16:9')
  assert.equal(getImageNodeStageRatio({ ratio: '', size: '1080x1920' }), '9:16')
  assert.equal(getImageNodeStageRatio({ ratio: '', size: '997x333' }), '997:333')
  assert.equal(getImageNodeStageRatio({ ratio: '', size: 'auto' }), '1:1')
})

test('image node stage style keeps fixed and custom ratio dimensions stable', () => {
  assert.deepEqual(getImageNodeStageStyle({ ratio: '1:1', size: '1024x1024' }), {
    width: '320px',
    height: '320px'
  })
  assert.deepEqual(getImageNodeStageStyle({ ratio: '16:9', size: '1024x1024' }), {
    width: '420px',
    height: '236px'
  })
  assert.deepEqual(getImageNodeStageStyle({ ratio: '7:3', size: '1024x1024' }), {
    width: '420px',
    height: '180px'
  })
  assert.deepEqual(getImageNodeStageStyle({ ratio: '1:10', size: '1024x1024' }), {
    width: '46px',
    height: '462px'
  })
})

test('image preview viewport subtracts modal padding without returning negative dimensions', () => {
  assert.deepEqual(getImagePreviewViewportSize({ width: 900, height: 700 }), {
    width: 860,
    height: 660
  })
  assert.deepEqual(getImagePreviewViewportSize({ width: 20, height: 10 }), {
    width: 0,
    height: 0
  })
})

test('image preview rendered size fits natural dimensions into viewport before zooming', () => {
  assert.deepEqual(getImagePreviewRenderedSize({
    naturalSize: { width: 2000, height: 1000 },
    viewportSize: { width: 860, height: 660 },
    zoom: 1
  }), { width: 860, height: 430 })

  assert.deepEqual(getImagePreviewRenderedSize({
    naturalSize: { width: 2000, height: 1000 },
    viewportSize: { width: 860, height: 660 },
    zoom: 2
  }), { width: 1720, height: 860 })

  assert.deepEqual(getImagePreviewRenderedSize({
    naturalSize: { width: 1200, height: 900 },
    viewportSize: { width: 0, height: 0 },
    windowSize: { width: 1000, height: 800 },
    zoom: 1
  }), { width: 773, height: 580 })
})

test('image preview canvas style covers the larger of viewport and rendered image', () => {
  assert.deepEqual(getImagePreviewCanvasStyle({
    viewportSize: { width: 860, height: 660 },
    renderedSize: { width: 1720, height: 860 }
  }), {
    width: '1720px',
    height: '860px'
  })

  assert.deepEqual(getImagePreviewCanvasStyle({
    viewportSize: { width: 860, height: 660 },
    renderedSize: { width: 400, height: 300 }
  }), {
    width: '860px',
    height: '660px'
  })
})

test('image node crop stage metrics preserve cover-scale frame math', () => {
  assert.deepEqual(getImageNodeCropStageMetrics({
    stageStyle: { width: '420px', height: '236px' },
    naturalSize: { width: 1920, height: 1080 }
  }), {
    frameWidth: 396,
    frameHeight: 212,
    naturalWidth: 1920,
    naturalHeight: 1080,
    scale: 0.20625,
    offsetX: 0,
    offsetY: -5.375
  })

  assert.deepEqual(getImageNodeCropStageMetrics({
    stageStyle: { width: '320px', height: '320px' },
    naturalSize: { width: 0, height: 0 }
  }), {
    frameWidth: 296,
    frameHeight: 296,
    naturalWidth: 296,
    naturalHeight: 296,
    scale: 1,
    offsetX: 0,
    offsetY: 0
  })
})

test('image node crop overlay styles preserve box and mask geometry', () => {
  const cropRect = { x: 40, y: 30, width: 120, height: 90 }
  const metrics = { frameWidth: 396, frameHeight: 212 }

  assert.deepEqual(getImageNodeCropBoxStyle(cropRect), {
    left: '40px',
    top: '30px',
    width: '120px',
    height: '90px'
  })

  assert.deepEqual(getImageNodeCropMaskStyles({ cropRect, metrics }), {
    top: {
      left: '0px',
      top: '0px',
      width: '396px',
      height: '30px'
    },
    left: {
      left: '0px',
      top: '30px',
      width: '40px',
      height: '90px'
    },
    right: {
      left: '160px',
      top: '30px',
      width: '236px',
      height: '90px'
    },
    bottom: {
      left: '0px',
      top: '120px',
      width: '396px',
      height: '92px'
    }
  })

  assert.equal(getImageNodeCropMaskStyles({
    cropRect: { x: 360, y: 190, width: 80, height: 40 },
    metrics
  }).right.width, '0px')
})

test('image node initial crop rect preserves centered 72 percent crop box', () => {
  assert.deepEqual(getImageNodeInitialCropRect({
    metrics: { frameWidth: 396, frameHeight: 212 }
  }), {
    x: 56,
    y: 30,
    width: 285,
    height: 153
  })

  assert.equal(getImageNodeInitialCropRect({
    metrics: { frameWidth: 0, frameHeight: 212 }
  }), null)
})

test('image node crop rect normalization preserves min size and clamps to stage bounds', () => {
  const metrics = { frameWidth: 396, frameHeight: 212 }

  assert.deepEqual(normalizeImageNodeCropRect({
    rect: { x: 320, y: 180, width: 120, height: 90 },
    metrics
  }), {
    x: 276,
    y: 122,
    width: 120,
    height: 90
  })

  assert.deepEqual(normalizeImageNodeCropRect({
    rect: { x: -20, y: -10, width: 12, height: 10 },
    metrics
  }), {
    x: 0,
    y: 0,
    width: 48,
    height: 48
  })

  assert.deepEqual(normalizeImageNodeCropRect({
    rect: { x: 20, y: 30, width: 500, height: 260 },
    metrics
  }), {
    x: 0,
    y: 0,
    width: 396,
    height: 212
  })
})

test('image node crop interaction rect preserves drag and corner resize behavior', () => {
  const metrics = { frameWidth: 396, frameHeight: 212 }
  const startRect = { x: 55, y: 30, width: 285, height: 153 }

  assert.deepEqual(getImageNodeCropInteractionRect({
    interaction: {
      type: 'drag',
      startPointerX: 100,
      startPointerY: 100,
      startRect
    },
    pointer: { x: 140, y: 90 },
    metrics
  }), {
    x: 95,
    y: 20,
    width: 285,
    height: 153
  })

  assert.deepEqual(getImageNodeCropInteractionRect({
    interaction: {
      type: 'resize',
      handle: 'nw',
      startPointerX: 100,
      startPointerY: 100,
      startRect
    },
    pointer: { x: 75, y: 120 },
    metrics
  }), {
    x: 30,
    y: 50,
    width: 310,
    height: 133
  })

  assert.deepEqual(getImageNodeCropInteractionRect({
    interaction: {
      type: 'resize',
      handle: 'se',
      startPointerX: 100,
      startPointerY: 100,
      startRect
    },
    pointer: { x: 250, y: 220 },
    metrics
  }), {
    x: 0,
    y: 0,
    width: 396,
    height: 212
  })
})

test('image node crop source rect maps stage crop geometry back to natural image pixels', () => {
  const metrics = {
    naturalWidth: 1920,
    naturalHeight: 1080,
    scale: 0.20625,
    offsetX: 0,
    offsetY: -5.375
  }

  assert.deepEqual(getImageNodeCropSourceRect({
    cropRect: { x: 40, y: 30, width: 120, height: 90 },
    metrics,
    naturalSize: { width: 1920, height: 1080 }
  }), {
    x: 194,
    y: 172,
    width: 582,
    height: 436
  })

  assert.deepEqual(getImageNodeCropSourceRect({
    cropRect: { x: 500, y: 500, width: 80, height: 80 },
    metrics,
    naturalSize: { width: 400, height: 300 }
  }), {
    x: 399,
    y: 299,
    width: 1,
    height: 1
  })
})

test('image node ratio label reduces crop output dimensions with safe fallback', () => {
  assert.equal(getImageNodeRatioLabel(1920, 1080), '16:9')
  assert.equal(getImageNodeRatioLabel(1536, 1024), '3:2')
  assert.equal(getImageNodeRatioLabel(333, 999), '1:3')
  assert.equal(getImageNodeRatioLabel(0, 999), '1:1')
})

test('image preview centered scroll targets the middle of overflow canvas', () => {
  assert.deepEqual(getImagePreviewCenteredScroll({
    canvasSize: { width: 1720, height: 860 },
    stageSize: { width: 900, height: 600 }
  }), { left: 410, top: 130 })

  assert.deepEqual(getImagePreviewCenteredScroll({
    canvasSize: { width: 700, height: 500 },
    stageSize: { width: 900, height: 600 }
  }), { left: 0, top: 0 })
})

test('image preview zoom helpers preserve viewport focus while clamping zoom', () => {
  assert.equal(normalizeImagePreviewZoom(0.61), 0.75)
  assert.equal(normalizeImagePreviewZoom(4.44), 4)
  assert.equal(normalizeImagePreviewZoom(1.234), 1.23)

  const focus = getImagePreviewZoomFocus({
    scroll: { left: 410, top: 130 },
    stageSize: { width: 900, height: 600 },
    canvasSize: { width: 1720, height: 860 }
  })

  assert.deepEqual(focus, {
    x: 0.5,
    y: 0.5
  })

  assert.deepEqual(getImagePreviewZoomScroll({
    focus,
    stageSize: { width: 900, height: 600 },
    canvasSize: { width: 2600, height: 1300 }
  }), { left: 850, top: 350 })

  assert.deepEqual(getImagePreviewZoomFocus({
    scroll: { left: 0, top: 0 },
    stageSize: { width: 900, height: 600 },
    canvasSize: { width: 0, height: 0 }
  }), { x: 0.5, y: 0.5 })
})

test('image node tool options keep upload available while disabling image-only tools without an image', () => {
  const options = getImageNodeToolOptions({
    hasDisplayImage: false,
    isUploading: false,
    isToolBusy: false
  })

  assert.deepEqual(options.map(({ label, key, disabled }) => ({ label, key, disabled })), [
    { label: 'Upload Image', key: 'replace-image', disabled: false },
    { label: 'Cutout', key: 'remove-background', disabled: true },
    { label: 'Crop', key: 'crop', disabled: true },
    { label: 'Upscale', key: 'enhance-4k', disabled: true },
    { label: '3D Camera', key: 'multi-angle', disabled: true },
    { label: 'Theme Set', key: 'wedding-3x3', disabled: true }
  ])
  assert.equal(options.some((option) => 'renderIcon' in option), false)
})

test('image node tool options enable image tools and preserve upscale copy for existing images', () => {
  const options = getImageNodeToolOptions({
    hasDisplayImage: true,
    isUploading: false,
    isToolBusy: false
  })

  assert.equal(getOption(options, 'replace-image').label, 'Replace')
  assert.equal(getOption(options, 'replace-image').disabled, false)
  assert.equal(getOption(options, 'remove-background').disabled, false)
  assert.equal(getOption(options, 'crop').disabled, false)
  assert.equal(getOption(options, 'enhance-4k').disabled, false)
  assert.equal(getOption(options, 'multi-angle').disabled, false)
  assert.equal(getOption(options, 'wedding-3x3').disabled, false)
  assert.equal(
    getOption(options, 'enhance-4k').description,
    'Reuse original model and inputs, increase resolution only'
  )
})

test('image node tool options disable replacement while uploading', () => {
  const options = getImageNodeToolOptions({
    hasDisplayImage: false,
    isUploading: true,
    isToolBusy: false
  })

  assert.equal(getOption(options, 'replace-image').label, 'Upload Image')
  assert.equal(getOption(options, 'replace-image').disabled, true)
})

test('image node tool options disable image-only actions while a tool is busy', () => {
  const options = getImageNodeToolOptions({
    hasDisplayImage: true,
    isUploading: false,
    isToolBusy: true
  })

  assert.equal(getOption(options, 'replace-image').disabled, false)
  assert.deepEqual(
    options
      .filter((option) => option.key !== 'replace-image')
      .map((option) => [option.key, option.disabled]),
    [
      ['remove-background', true],
      ['crop', true],
      ['enhance-4k', true],
      ['multi-angle', true],
      ['wedding-3x3', true]
    ]
  )
})

test('image node select options normalize labels while preserving keys', () => {
  assert.deepEqual(getImageNodeSelectOptions([
    { key: 'gemini-image', label: 'Gemini Image' },
    { key: 'gpt-image-2' }
  ]), [
    { key: 'gemini-image', label: 'Gemini Image' },
    { key: 'gpt-image-2', label: 'gpt-image-2' }
  ])

  assert.deepEqual(getImageNodeSelectOptions([
    { key: '1k' },
    { key: '2k', label: 'Two K' }
  ], { uppercaseFallback: true }), [
    { key: '1k', label: '1K' },
    { key: '2k', label: 'Two K' }
  ])
})

test('image node size meta options preserve ratio, resolution, and pixel ordering data', () => {
  assert.deepEqual(getImageNodeSizeMetaOptions([
    { key: '1024x1024' },
    { key: '2048x2048' },
    { key: '1536x1024' },
    { key: 'auto' }
  ]), [
    { key: '1024x1024', ratio: '1:1', resolutionKey: '1k', pixels: 1048576 },
    { key: '2048x2048', ratio: '1:1', resolutionKey: '2k', pixels: 4194304 },
    { key: '1536x1024', ratio: '3:2', resolutionKey: '1k', pixels: 1572864 },
    { key: 'auto', ratio: 'auto', resolutionKey: '1k', pixels: 0 }
  ])
})

test('image node ratio dropdown options preserve GPT Image 2 and hidden-ratio behavior', () => {
  const sizeMetaOptions = getImageNodeSizeMetaOptions([
    { key: '1024x1024' },
    { key: '2048x2048' },
    { key: '1536x1024' },
    { key: '1024x1536' }
  ])
  const gptImage2RatioOptions = [{ key: 'auto', label: 'Auto' }, { key: '1:1', label: '1:1' }]

  assert.deepEqual(getImageNodeRatioDropdownOptions({
    isGptImage2Model: true,
    gptImage2RatioOptions,
    hideRatioCapsule: false,
    sizeMetaOptions
  }), gptImage2RatioOptions)

  assert.deepEqual(getImageNodeRatioDropdownOptions({
    isGptImage2Model: false,
    gptImage2RatioOptions,
    hideRatioCapsule: true,
    sizeMetaOptions
  }), [])

  assert.deepEqual(getImageNodeRatioDropdownOptions({
    isGptImage2Model: false,
    gptImage2RatioOptions,
    hideRatioCapsule: false,
    sizeMetaOptions
  }), [
    { key: '1:1', label: '1:1' },
    { key: '3:2', label: '3:2' },
    { key: '2:3', label: '2:3' }
  ])
})

test('image node resolution dropdown options prefer model config before derived size buckets', () => {
  const sizeMetaOptions = getImageNodeSizeMetaOptions([
    { key: '4096x4096' },
    { key: '1024x1024' },
    { key: '2048x2048' },
    { key: '1536x1024' }
  ])

  assert.deepEqual(getImageNodeResolutionDropdownOptions({
    modelResolutions: [{ key: 'auto' }, { key: '4k', label: 'Ultra' }],
    sizeMetaOptions,
    imageRatio: '1:1'
  }), [
    { key: 'auto', label: 'AUTO' },
    { key: '4k', label: 'Ultra' }
  ])

  assert.deepEqual(getImageNodeResolutionDropdownOptions({
    modelResolutions: [],
    sizeMetaOptions,
    imageRatio: '1:1'
  }), [
    { key: '1k', label: '1K' },
    { key: '2k', label: '2K' },
    { key: '4k', label: '4K' }
  ])

  assert.deepEqual(getImageNodeResolutionDropdownOptions({
    modelResolutions: [],
    sizeMetaOptions,
    imageRatio: '9:16'
  }), [{ key: '1k', label: '1K' }])
})

test('image node advanced dropdown options and display labels preserve capsule placeholders', () => {
  const qualityOptions = getImageNodeAdvancedDropdownOptions({
    enabled: true,
    items: [{ key: 'auto' }, { key: 'high', label: 'High' }]
  })

  assert.deepEqual(qualityOptions, [
    { key: 'auto', label: 'auto' },
    { key: 'high', label: 'High' }
  ])
  assert.deepEqual(getImageNodeAdvancedDropdownOptions({
    enabled: false,
    items: [{ key: 'auto' }]
  }), [])
  assert.equal(getImageNodeOptionDisplayLabel(qualityOptions, 'high'), 'High')
  assert.equal(getImageNodeOptionDisplayLabel(qualityOptions, 'standard'), 'standard')
  assert.equal(getImageNodeControlDisplayLabel({
    enabled: true,
    options: qualityOptions,
    value: 'auto',
    placeholderValue: 'auto',
    placeholderLabel: 'Quality'
  }), 'Quality')
  assert.equal(getImageNodeControlDisplayLabel({
    enabled: false,
    options: qualityOptions,
    value: 'auto',
    placeholderValue: 'auto',
    placeholderLabel: 'Quality'
  }), 'auto')
  assert.equal(getImageNodeControlDisplayLabel({
    enabled: true,
    options: qualityOptions,
    value: 'high',
    placeholderValue: 'auto',
    placeholderLabel: 'Quality'
  }), 'High')
})

test('image node ratio display keeps GPT Image 2 auto label without changing other ratios', () => {
  assert.equal(getImageNodeRatioDisplayLabel({
    isGptImage2Model: true,
    ratio: 'auto'
  }), 'Auto')
  assert.equal(getImageNodeRatioDisplayLabel({
    isGptImage2Model: false,
    ratio: 'auto'
  }), 'auto')
  assert.equal(getImageNodeRatioDisplayLabel({
    isGptImage2Model: true,
    ratio: '1:1'
  }), '1:1')
})

test('image node size selection preserves existing ratio and resolution picking behavior', () => {
  const sizeMetaOptions = getImageNodeSizeMetaOptions([
    { key: '1024x1024' },
    { key: '2048x2048' },
    { key: '1152x768' },
    { key: '2304x1536' },
    { key: '1280x720' }
  ])

  assert.deepEqual(getImageNodeSizeSelection({
    ratioKey: '3:2',
    resolutionKey: '2k',
    sizeMetaOptions
  }), {
    key: '2304x1536',
    ratio: '3:2',
    resolution: '2k'
  })

  assert.deepEqual(getImageNodeSizeSelection({
    ratioKey: '9:16',
    resolutionKey: '4k',
    sizeMetaOptions
  }), {
    key: '1152x768',
    ratio: '3:2',
    resolution: '1k'
  })

  assert.deepEqual(getImageNodeSizeSelection({
    ratioKey: '16:9',
    resolutionKey: '1k',
    sizeMetaOptions: [],
    defaultImageSize: '1024x1024'
  }), {
    key: '1024x1024'
  })
})

test('image node size helpers delegate GPT Image 2 sizing without coupling to component state', () => {
  const resolveGptImage2Size = ({ ratio, resolution }) => `${ratio}:${resolution}`

  assert.deepEqual(getImageNodeSizeSelection({
    isGptImage2Model: true,
    ratioKey: '',
    resolutionKey: '',
    resolveGptImage2Size
  }), {
    key: '1:1:1k',
    ratio: '1:1',
    resolution: '1k'
  })

  assert.deepEqual(getImageNodeSizeSelection({
    isGptImage2Model: true,
    ratioKey: 'auto',
    resolutionKey: '4k',
    resolveGptImage2Size
  }), {
    key: 'auto',
    ratio: 'auto',
    resolution: '4k'
  })

  assert.equal(getImageNodeNearestSizeKey({
    isGptImage2Model: true,
    ratioKey: '16:9',
    resolutionKey: '2k',
    resolveGptImage2Size
  }), '16:9:2k')
})

test('image node progress style clamps display width and rounds text percent', () => {
  assert.equal(getImageNodeProgressPercent(12.4), 12)
  assert.equal(getImageNodeProgressPercent(12.5), 13)

  assert.deepEqual(getImageNodeProgressBarStyle(-10), { width: '0%' })
  assert.deepEqual(getImageNodeProgressBarStyle(42.5), { width: '42.5%' })
  assert.deepEqual(getImageNodeProgressBarStyle(130), { width: '100%' })
})

test('image node generation progress preserves the existing staged increments', () => {
  assert.equal(getImageNodeProgressNextValue(0), 3)
  assert.equal(getImageNodeProgressNextValue(69), 72)
  assert.equal(getImageNodeProgressNextValue(70), 71.2)
  assert.equal(getImageNodeProgressNextValue(89.5), 90.7)
  assert.equal(getImageNodeProgressNextValue(90), 90.35)
  assert.equal(getImageNodeProgressNextValue(97.9), 98)
  assert.equal(getImageNodeProgressNextValue(98), 98)
})

test('image node finish progress increments to completion without overflowing', () => {
  assert.equal(getImageNodeFinishProgressNextValue(0), 4.5)
  assert.equal(getImageNodeFinishProgressNextValue(96), 100)
  assert.equal(getImageNodeFinishProgressNextValue(100), 100)
})

test('image node upload progress style preserves stage colors and width clamp', () => {
  assert.deepEqual(getImageNodeUploadProgressStyle({
    progress: -5,
    stage: 'idle'
  }), {
    width: '0%',
    background: '#d8dbe0'
  })

  assert.deepEqual(getImageNodeUploadProgressStyle({
    progress: 44.5,
    stage: 'saving'
  }), {
    width: '44.5%',
    background: '#d8dbe0'
  })

  assert.deepEqual(getImageNodeUploadProgressStyle({
    progress: 101,
    stage: 'success'
  }), {
    width: '100%',
    background: '#8b9272'
  })

  assert.deepEqual(getImageNodeUploadProgressStyle({
    progress: 72,
    stage: 'error'
  }), {
    width: '72%',
    background: '#c46a5c'
  })
})
