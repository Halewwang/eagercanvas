import assert from 'node:assert/strict'
import test from 'node:test'

import { HttpError } from '../utils/http.js'
import {
  buildKlingO1Request,
  buildKlingO3Request,
  extractKlingStatus,
  isKlingTaskId,
  isKlingVideoModel,
  isTopazVideoEnhancePayload,
  normalizeTopazStatus,
  pickFirstImageInput
} from './providers/dashboard302-video-helpers.js'

test('Dashboard302 video helpers identify Kling and Topaz routing inputs', () => {
  assert.equal(isKlingVideoModel('kling-o1'), true)
  assert.equal(isKlingVideoModel('Kling-O3-Pro'), true)
  assert.equal(isKlingVideoModel('veo-3.1'), false)
  assert.equal(isKlingTaskId('kling_task_1'), true)
  assert.equal(isKlingTaskId('task_kling_o3'), true)
  assert.equal(isKlingTaskId('wavespeed-task-1'), false)
  assert.equal(isTopazVideoEnhancePayload({ tool: 'enhance' }), true)
  assert.equal(isTopazVideoEnhancePayload({ operation: 'ENHANCE' }), true)
  assert.equal(isTopazVideoEnhancePayload({ tool: 'remove-background' }), false)
})

test('Dashboard302 video helpers preserve input image and status normalization behavior', () => {
  assert.equal(pickFirstImageInput({ image: ['https://example.com/a.png'] }), 'https://example.com/a.png')
  assert.equal(pickFirstImageInput({ images: ['https://example.com/b.png'] }), 'https://example.com/b.png')
  assert.equal(pickFirstImageInput({ first_frame_image: 'https://example.com/c.png' }), 'https://example.com/c.png')
  assert.equal(extractKlingStatus({ task: { task_status: 99 } }), 'completed')
  assert.equal(extractKlingStatus({ data: { status: 'failed' } }), 'failed')
  assert.equal(extractKlingStatus({ data: { task: { status: 'submitted' } } }), 'processing')
  assert.equal(normalizeTopazStatus('complete'), 'completed')
  assert.equal(normalizeTopazStatus('cancelled'), 'failed')
  assert.equal(normalizeTopazStatus(''), 'processing')
})

test('Dashboard302 video helpers preserve Kling O1 request shaping', () => {
  assert.deepEqual(buildKlingO1Request({
    prompt: 'Move the product camera',
    aspectRatio: '4:3',
    duration: 12,
    firstFrameImage: 'https://example.com/first.png',
    lastFrameImage: 'https://example.com/last.png',
    referenceImages: ['https://example.com/ref.png']
  }), {
    images: ['https://example.com/first.png', 'https://example.com/last.png', 'https://example.com/ref.png'],
    prompt: 'Move the product camera',
    duration: 10,
    aspect_ratio: 'auto',
    o1_type: 'firstTail'
  })

  assert.throws(
    () => buildKlingO1Request({ prompt: 'missing image' }),
    (error) => {
      assert.ok(error instanceof HttpError)
      assert.equal(error.status, 400)
      assert.equal(error.code, 'INVALID_VIDEO_INPUT')
      return true
    }
  )
})

test('Dashboard302 video helpers preserve Kling O3 request shaping', () => {
  assert.deepEqual(buildKlingO3Request({
    prompt: 'Animate the image',
    aspectRatio: '4:3',
    duration: 2,
    firstFrameImage: 'https://example.com/first.png',
    referenceImages: ['https://example.com/ref-1.png', 'https://example.com/ref-2.png'],
    mode: 'std',
    generateAudio: true
  }), {
    images: [
      'https://example.com/first.png',
      'https://example.com/ref-1.png',
      'https://example.com/ref-2.png'
    ],
    prompt: 'Animate the image',
    duration: 3,
    aspect_ratio: '16:9',
    mode: 'std',
    o1_type: 'referImage',
    enable_audio: true
  })

  assert.throws(
    () => buildKlingO3Request({
      prompt: 'bad firstTail',
      o1Type: 'firstTail',
      firstFrameImage: 'https://example.com/first.png'
    }),
    (error) => {
      assert.ok(error instanceof HttpError)
      assert.equal(error.status, 400)
      assert.equal(error.code, 'INVALID_VIDEO_INPUT')
      return true
    }
  )
})
