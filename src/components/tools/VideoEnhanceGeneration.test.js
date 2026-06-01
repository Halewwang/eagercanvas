import assert from 'node:assert/strict'
import test from 'node:test'

import {
  createVideoEnhanceApplyPayload,
  createVideoEnhanceOutput,
  createVideoEnhancePendingPayload,
  createVideoEnhanceRequestPayload,
  resolveVideoEnhanceResolutionSize,
  runVideoEnhancement
} from './VideoEnhanceGeneration.js'

const controls = {
  model: 'prob-4',
  resolution: '4k',
  frameRate: '30',
  videoEncoder: 'H265',
  dynamicCompressionLevel: 'High'
}

test('video enhance generation resolves output size from ratio and resolution', () => {
  assert.deepEqual(resolveVideoEnhanceResolutionSize('16:9', '4k'), {
    width: 3840,
    height: 2160
  })
  assert.deepEqual(resolveVideoEnhanceResolutionSize('9:16', '2k'), {
    width: 1440,
    height: 2560
  })
  assert.deepEqual(resolveVideoEnhanceResolutionSize('bad-ratio', '1080p'), {
    width: 1920,
    height: 1080
  })
})

test('video enhance generation builds output with existing defaults', () => {
  assert.deepEqual(createVideoEnhanceOutput({
    ratio: '1:1',
    resolution: '1080p',
    frameRate: 'source',
    videoEncoder: 'H264',
    dynamicCompressionLevel: 'Medium'
  }), {
    frameRate: 30,
    audioTransfer: 'Copy',
    audioCodec: 'AAC',
    videoEncoder: 'H264',
    videoProfile: 'Main',
    dynamicCompressionLevel: 'Medium',
    resolution: {
      width: 1920,
      height: 1920
    }
  })
})

test('video enhance generation builds pending and apply payloads without changing metadata', () => {
  assert.deepEqual(createVideoEnhancePendingPayload(controls), {
    targetMode: 'new',
    fileType: 'video/mp4',
    meta: {
      tool: 'video-enhance',
      model: 'prob-4',
      resolution: '4k',
      frameRate: '30',
      videoEncoder: 'H265',
      dynamicCompressionLevel: 'High'
    }
  })

  assert.deepEqual(createVideoEnhanceApplyPayload({
    ...controls,
    url: ' https://cdn.example.com/enhanced.mp4 '
  }), {
    targetMode: 'new',
    url: 'https://cdn.example.com/enhanced.mp4',
    fileType: 'video/mp4',
    meta: {
      tool: 'video-enhance',
      model: 'prob-4',
      resolution: '4k',
      frameRate: '30',
      videoEncoder: 'H265',
      dynamicCompressionLevel: 'High'
    }
  })
})

test('video enhance generation sends the existing provider request shape', () => {
  assert.deepEqual(createVideoEnhanceRequestPayload({
    ...controls,
    file: 'https://cdn.example.com/source.mp4',
    ratio: '16:9'
  }), {
    tool: 'enhance',
    file: 'https://cdn.example.com/source.mp4',
    model: 'prob-4',
    filters: [{ model: 'prob-4' }],
    output: {
      frameRate: 30,
      audioTransfer: 'Copy',
      audioCodec: 'AAC',
      videoEncoder: 'H265',
      videoProfile: 'Main',
      dynamicCompressionLevel: 'High',
      resolution: {
        width: 3840,
        height: 2160
      }
    }
  })
})

test('video enhance generation runner returns provider urls and rejects empty output', async () => {
  const calls = []
  const url = await runVideoEnhancement({
    videoGen: {
      generate: async (payload) => {
        calls.push(payload)
        return { video_url: 'https://cdn.example.com/result.mp4' }
      }
    },
    ...controls,
    file: 'https://cdn.example.com/source.mp4',
    ratio: '16:9'
  })

  assert.equal(url, 'https://cdn.example.com/result.mp4')
  assert.equal(calls.length, 1)
  assert.equal(calls[0].tool, 'enhance')

  await assert.rejects(
    runVideoEnhancement({
      videoGen: {
        generate: async () => ({ url: '   ' })
      },
      ...controls,
      file: 'https://cdn.example.com/source.mp4',
      ratio: '16:9'
    }),
    /No video output from provider/
  )
})
