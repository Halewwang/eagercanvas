import assert from 'node:assert/strict'
import { test } from 'node:test'

import {
  getImageTaskId,
  getImageTaskStatus,
  normalizeGeneratedImages,
  normalizeResolution,
  ratioFromSize,
  resolutionFromSize
} from './api/imageApiCore.js'
import {
  buildVideoRequestData,
  getVideoTaskId,
  getVideoTaskStatus,
  getVideoUrl
} from './api/videoApiCore.js'

test('image api core preserves size, resolution, task id, and output normalization behavior', () => {
  assert.equal(ratioFromSize('1280x720'), '16:9')
  assert.equal(ratioFromSize('720x1280'), '9:16')
  assert.equal(ratioFromSize('invalid'), '1:1')
  assert.equal(normalizeResolution('2K'), '2k')
  assert.equal(normalizeResolution('large'), '')
  assert.equal(resolutionFromSize('2048x2048', '1:1'), '2k')
  assert.equal(resolutionFromSize('4096x4096', '1:1'), '4k')
  assert.equal(getImageTaskId({ data: { request_id: 'img-task-1' } }), 'img-task-1')
  assert.equal(getImageTaskStatus({ data: { status: 'SUCCEEDED' } }), 'succeeded')
  assert.deepEqual(
    normalizeGeneratedImages({
      data: [{
        b64_json: 'data:image/png;base64,abc',
        revised_prompt: 'kept',
        transient: true,
        persist_error: 'storage failed'
      }]
    }),
    [{
      url: 'data:image/png;base64,abc',
      revisedPrompt: 'kept',
      transient: true,
      persistError: 'storage failed'
    }]
  )
})

test('video api core preserves task id, status, and nested result url extraction behavior', () => {
  assert.equal(getVideoTaskId({ data: { data: { id: 'video-task-1' } } }), 'video-task-1')
  assert.equal(getVideoTaskStatus({ raw: { task: { task_status: 'SUCCESS' } } }), 'success')
  assert.equal(
    getVideoUrl({ data: { task_result: { videos: [{ url: 'https://cdn.example/video.mp4' }] } } }),
    'https://cdn.example/video.mp4'
  )
  assert.equal(
    getVideoUrl({ detail: { draft_info: { downloadable_url: 'https://cdn.example/draft.mp4' } } }),
    'https://cdn.example/draft.mp4'
  )
})

test('video api core preserves request payload mapping for generation and tool calls', () => {
  assert.deepEqual(
    buildVideoRequestData({
      model: 'seedance-2',
      prompt: 'move forward',
      projectId: 'project-1',
      sourceNodeId: 'node-1',
      tool: 'enhance',
      file: 'file-ref',
      filters: ['denoise'],
      output: { format: 'mp4' },
      first_frame_image: 'first.png',
      last_frame_image: 'last.png',
      ratio: '16:9',
      size: '1280x720',
      mode: 'first-last',
      o1_type: 'first',
      duration: '5',
      images: ['ref.png'],
      videos: ['clip.mp4'],
      enable_audio: true,
      generate_audio: false
    }),
    {
      model: 'seedance-2',
      model_name: 'seedance-2',
      prompt: 'move forward',
      projectId: 'project-1',
      sourceNodeId: 'node-1',
      tool: 'enhance',
      file: 'file-ref',
      filters: ['denoise'],
      output: { format: 'mp4' },
      first_frame_image: 'first.png',
      last_frame_image: 'last.png',
      aspect_ratio: '16:9',
      size: '1280x720',
      mode: 'first-last',
      o1_type: 'first',
      duration: 5,
      seconds: 5,
      images: ['ref.png'],
      videos: ['clip.mp4'],
      enable_audio: true,
      generate_audio: false
    }
  )
})
