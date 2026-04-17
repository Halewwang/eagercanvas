import assert from 'node:assert/strict'
import test from 'node:test'

import {
  createMemoryImagePreviewDriver,
  getImagePreviewTargetSize,
  getImagePreviewCacheKey,
  IMAGE_PREVIEW_MAX_EDGE,
  IMAGE_PREVIEW_WEBP_QUALITY,
  resolveImageNodeDisplaySource,
  shouldGenerateImagePreview
} from './imagePreviewCache.js'

test('image preview cache key is stable for the same source URL', () => {
  assert.equal(
    getImagePreviewCacheKey(' https://cdn.example.com/image.png?token=abc '),
    getImagePreviewCacheKey('https://cdn.example.com/image.png?token=abc')
  )
})

test('image preview cache key separates regenerated higher quality previews', () => {
  assert.equal(
    getImagePreviewCacheKey('https://cdn.example.com/image.png'),
    'v2:https://cdn.example.com/image.png'
  )
})

test('image preview target keeps more detail without using full 4k dimensions', () => {
  assert.equal(IMAGE_PREVIEW_MAX_EDGE, 1280)
  assert.equal(IMAGE_PREVIEW_WEBP_QUALITY, 0.82)
  assert.deepEqual(
    getImagePreviewTargetSize({ width: 3840, height: 2160 }),
    { width: 1280, height: 720 }
  )
  assert.deepEqual(
    getImagePreviewTargetSize({ width: 2160, height: 3840 }),
    { width: 720, height: 1280 }
  )
})

test('image node display uses low resolution preview while full operations keep original source', () => {
  const source = resolveImageNodeDisplaySource({
    originalUrl: 'https://cdn.example.com/full-4k.png',
    cachedPreviewUrl: 'blob:preview-small'
  })

  assert.equal(source.canvasUrl, 'blob:preview-small')
  assert.equal(source.fullUrl, 'https://cdn.example.com/full-4k.png')
})

test('image node display falls back to original source when preview is missing', () => {
  const source = resolveImageNodeDisplaySource({
    originalUrl: 'https://cdn.example.com/full-4k.png',
    cachedPreviewUrl: ''
  })

  assert.equal(source.canvasUrl, 'https://cdn.example.com/full-4k.png')
  assert.equal(source.fullUrl, 'https://cdn.example.com/full-4k.png')
})

test('preview generation is skipped during canvas interaction', () => {
  assert.equal(shouldGenerateImagePreview({ originalUrl: 'https://cdn.example.com/a.png', isInteracting: true }), false)
  assert.equal(shouldGenerateImagePreview({ originalUrl: 'https://cdn.example.com/a.png', isInteracting: false }), true)
  assert.equal(shouldGenerateImagePreview({ originalUrl: '', isInteracting: false }), false)
})

test('memory image preview driver stores previews by stable key', async () => {
  const driver = createMemoryImagePreviewDriver()
  const key = getImagePreviewCacheKey('https://cdn.example.com/a.png')

  await driver.set(key, { previewUrl: 'blob:preview-a' })
  const stored = await driver.get(key)

  assert.equal(stored.previewUrl, 'blob:preview-a')
})
