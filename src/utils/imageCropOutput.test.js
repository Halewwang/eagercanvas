import assert from 'node:assert/strict'
import test from 'node:test'

import { createImageNodeCropPayload } from './imageCropOutput.js'

const createCanvasHarness = ({ blob = { type: 'image/png' }, context = {} } = {}) => {
  const drawImageCalls = []
  const canvas = {
    height: 0,
    width: 0,
    getContext: (type) => (type === '2d'
      ? {
          drawImage: (...args) => drawImageCalls.push(args),
          ...context
        }
      : null),
    toBlob: (resolve, type) => {
      canvas.blobType = type
      resolve(blob)
    }
  }

  return {
    canvas,
    drawImageCalls
  }
}

test('image crop output creates the replacement payload from crop geometry', async () => {
  const cleanupCalls = []
  const { canvas, drawImageCalls } = createCanvasHarness()
  const img = { naturalWidth: 400, naturalHeight: 300 }

  const payload = await createImageNodeCropPayload({
    source: 'image-source',
    cropRect: { x: 10, y: 20, width: 120, height: 80 },
    cropStageMetrics: {
      naturalWidth: 400,
      naturalHeight: 300,
      scale: 1,
      offsetX: 0,
      offsetY: 0
    },
    createCanvas: () => canvas,
    loadImageElement: async (source) => ({
      img: { ...img, source },
      cleanup: () => cleanupCalls.push(source)
    }),
    now: () => 1234,
    readBlobAsDataUrl: async (blob) => `data:image/png;base64,${blob.type}`
  })

  assert.equal(canvas.width, 120)
  assert.equal(canvas.height, 80)
  assert.equal(canvas.blobType, 'image/png')
  assert.deepEqual(drawImageCalls, [[
    { ...img, source: 'image-source' },
    10,
    20,
    120,
    80,
    0,
    0,
    120,
    80
  ]])
  assert.deepEqual(payload, {
    url: 'data:image/png;base64,image/png',
    base64: 'data:image/png;base64,image/png',
    size: '120x80',
    ratio: '3:2',
    resolution: '1k',
    fileType: 'image/png',
    fileName: 'crop-1234.png'
  })
  assert.deepEqual(cleanupCalls, ['image-source'])
})

test('image crop output cleans up loaded images when crop rendering fails', async () => {
  const cleanupCalls = []

  await assert.rejects(
    () => createImageNodeCropPayload({
      source: 'broken-source',
      cropRect: { x: 10, y: 20, width: 120, height: 80 },
      cropStageMetrics: {
        naturalWidth: 400,
        naturalHeight: 300,
        scale: 1,
        offsetX: 0,
        offsetY: 0
      },
      createCanvas: () => ({
        getContext: () => null
      }),
      loadImageElement: async (source) => ({
        img: { naturalWidth: 400, naturalHeight: 300 },
        cleanup: () => cleanupCalls.push(source)
      })
    }),
    /Crop canvas unavailable/
  )

  assert.deepEqual(cleanupCalls, ['broken-source'])
})
