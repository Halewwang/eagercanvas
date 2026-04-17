import assert from 'node:assert/strict'
import test from 'node:test'

import { shouldLoadInlineVideoPlayer } from './videoPreview.js'

test('video node does not load inline player until requested', () => {
  assert.equal(shouldLoadInlineVideoPlayer({ hasVideoUrl: true, previewRequested: false }), false)
  assert.equal(shouldLoadInlineVideoPlayer({ hasVideoUrl: true, previewRequested: true }), true)
  assert.equal(shouldLoadInlineVideoPlayer({ hasVideoUrl: false, previewRequested: true }), false)
})
