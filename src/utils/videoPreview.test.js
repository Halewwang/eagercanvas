import assert from 'node:assert/strict'
import test from 'node:test'

import {
  getVisibleVideoBindingStatusItems,
  getVisibleVideoConnectionStatusItems,
  shouldLoadInlineVideoPlayer,
  shouldRenderStaticVideoPreview
} from './videoPreview.js'

test('video node does not load inline player until requested', () => {
  assert.equal(shouldLoadInlineVideoPlayer({ hasVideoUrl: true, previewRequested: false }), false)
  assert.equal(shouldLoadInlineVideoPlayer({ hasVideoUrl: true, previewRequested: true }), true)
  assert.equal(shouldLoadInlineVideoPlayer({ hasVideoUrl: false, previewRequested: true }), false)
})

test('video node renders a static video preview before playback is requested', () => {
  assert.equal(shouldRenderStaticVideoPreview({ hasVideoUrl: true, previewRequested: false }), true)
  assert.equal(shouldRenderStaticVideoPreview({ hasVideoUrl: true, previewRequested: true }), false)
  assert.equal(shouldRenderStaticVideoPreview({ hasVideoUrl: false, previewRequested: false }), false)
})

test('Seedance connection status hides generation type label while keeping input labels', () => {
  const items = getVisibleVideoConnectionStatusItems({
    model: 'seedance-2.0',
    inputProfile: {
      allowPrompt: true,
      allowFirstFrame: true,
      allowLastFrame: true,
      allowImageReference: false,
      allowVideoReference: false
    },
    connected: {
      prompt: true,
      firstFrame: true,
      lastFrame: true
    }
  })

  assert.deepEqual(items.map((item) => item.key), ['prompt', 'first', 'last'])
  assert.equal(items.some((item) => item.key === 'generation-type'), false)
})

test('Seedance video binding status hides duplicate generation type label', () => {
  const items = getVisibleVideoBindingStatusItems({
    model: 'seedance-2.0',
    inputProfile: {
      allowPrompt: true,
      allowFirstFrame: true,
      allowLastFrame: true,
      allowImageReference: true,
      allowVideoReference: true
    },
    activeKeys: new Set(['prompt', 'first_frame_image', 'last_frame_image'])
  })

  assert.deepEqual(items.map((item) => item.key), [
    'prompt',
    'first_frame_image',
    'last_frame_image',
    'input_reference',
    'video_reference'
  ])
  assert.equal(items.some((item) => item.label.startsWith('Mode:')), false)
})
