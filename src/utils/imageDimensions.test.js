import assert from 'node:assert/strict'
import test from 'node:test'

import {
  getImageDimensionsFromFile,
  getImageRatioFromDimensions
} from './imageDimensions.js'

const createImageCtor = ({ width = 0, height = 0, fail = false } = {}) => (
  class TestImage {
    constructor() {
      this.width = width
      this.height = height
      this.onload = null
      this.onerror = null
    }

    set src(_value) {
      queueMicrotask(() => {
        if (fail) this.onerror?.(new Error('load failed'))
        else this.onload?.()
      })
    }
  }
)

test('image ratio from dimensions preserves existing aspect bucket behavior', () => {
  assert.equal(getImageRatioFromDimensions(1920, 1080), '16:9')
  assert.equal(getImageRatioFromDimensions(900, 1600), '9:16')
  assert.equal(getImageRatioFromDimensions(0, 1600), '1:1')
  assert.equal(getImageRatioFromDimensions(997, 333), '997:333')
})

test('image file dimension reader resolves dimensions and revokes the object url', async () => {
  const revoked = []
  const dimensions = await getImageDimensionsFromFile(
    { name: 'source.png' },
    {
      createObjectURL: () => 'blob:test-image',
      imageCtor: createImageCtor({ width: 1280, height: 720 }),
      revokeObjectURL: (url) => revoked.push(url)
    }
  )

  assert.deepEqual(dimensions, { width: 1280, height: 720 })
  assert.deepEqual(revoked, ['blob:test-image'])
})

test('image file dimension reader falls back to zero dimensions and still revokes failed object urls', async () => {
  const revoked = []
  const dimensions = await getImageDimensionsFromFile(
    { name: 'broken.png' },
    {
      createObjectURL: () => 'blob:broken-image',
      imageCtor: createImageCtor({ fail: true }),
      revokeObjectURL: (url) => revoked.push(url)
    }
  )

  assert.deepEqual(dimensions, { width: 0, height: 0 })
  assert.deepEqual(revoked, ['blob:broken-image'])
})
