import assert from 'node:assert/strict'
import test from 'node:test'

import {
  clampToAllowedValue,
  extractTaskId,
  extractVideoUrl,
  isEndpointNotFoundError,
  mapVideoModelName,
  normalizeErrorMessage,
  normalizeSoraStatus,
  normalizeVideoSize
} from './providers/video-response.js'
import { HttpError } from '../utils/http.js'

test('provider video response helpers preserve size and model normalization', () => {
  assert.equal(normalizeVideoSize('16:9'), '1280x720')
  assert.equal(normalizeVideoSize('720x1280'), '720x1280')
  assert.equal(normalizeVideoSize('square'), undefined)
  assert.equal(mapVideoModelName('veo-3.1'), 'veo3.1')
  assert.equal(mapVideoModelName('veo-3.1-pro'), 'veo3.1-pro')
  assert.equal(mapVideoModelName('custom-video'), 'custom-video')
  assert.equal(clampToAllowedValue(6, [4, 6, 8], 8), 6)
  assert.equal(clampToAllowedValue(5, [4, 6, 8], 8), 8)
})

test('provider video response helpers preserve task id, video url, and status extraction', () => {
  assert.equal(extractTaskId({ data: { task: { task_id: 'task-nested' } } }), 'task-nested')
  assert.equal(extractTaskId({ output: { id: 'task-output' } }), 'task-output')
  assert.equal(extractTaskId({}), '')

  assert.equal(
    extractVideoUrl({
      data: {
        works: [
          {
            resource: {
              resource: 'https://cdn.test/work.mp4'
            }
          }
        ]
      }
    }),
    'https://cdn.test/work.mp4'
  )
  assert.equal(extractVideoUrl({ raw_response: { file: { download_url: 'https://cdn.test/file.mp4' } } }), 'https://cdn.test/file.mp4')
  assert.equal(extractVideoUrl({}), '')

  assert.equal(normalizeSoraStatus('queued'), 'processing')
  assert.equal(normalizeSoraStatus('success'), 'completed')
  assert.equal(normalizeSoraStatus('cancelled'), 'failed')
  assert.equal(normalizeSoraStatus('custom'), 'custom')
})

test('provider video response helpers preserve endpoint and Veo error normalization', () => {
  assert.equal(isEndpointNotFoundError(new HttpError(404, 'missing', 'PROVIDER_ERROR')), true)
  assert.equal(isEndpointNotFoundError(new HttpError(405, 'unsupported route', 'PROVIDER_ERROR')), true)
  assert.equal(isEndpointNotFoundError(new HttpError(400, 'bad request', 'PROVIDER_ERROR')), false)
  assert.equal(
    normalizeErrorMessage('No available models currently.'),
    'Veo 3.1 当前在供应商侧无可用资源，请稍后重试或切换到 Kling O1。'
  )
  assert.equal(normalizeErrorMessage('plain failure'), 'plain failure')
  assert.equal(normalizeErrorMessage(''), '')
})
