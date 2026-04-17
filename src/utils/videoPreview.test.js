import assert from 'node:assert/strict'
import test from 'node:test'

import { shouldLoadInlineVideoPlayer, shouldRenderStaticVideoPreview } from './videoPreview.js'

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
