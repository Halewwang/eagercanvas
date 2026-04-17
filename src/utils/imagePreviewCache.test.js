import assert from 'node:assert/strict'
import test from 'node:test'

import {
  createMemoryImagePreviewDriver,
  getImagePreviewCacheKey,
  resolveImageNodeDisplaySource,
  shouldGenerateImagePreview
} from './imagePreviewCache.js'

test('image preview cache key is stable for the same source URL', () => {
  assert.equal(
    getImagePreviewCacheKey(' https://cdn.example.com/image.png?token=abc '),
    getImagePreviewCacheKey('https://cdn.example.com/image.png?token=abc')
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
