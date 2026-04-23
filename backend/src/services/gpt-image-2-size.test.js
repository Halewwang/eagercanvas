import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildGptImage2RequestBody,
  resolveGptImage2Size
} from './gpt-image-2-size.js'

test('resolves GPT Image 2 capsule resolution to provider size', () => {
  assert.equal(resolveGptImage2Size({ ratio: '1:1', resolution: '1k' }), '1024x1024')
  assert.equal(resolveGptImage2Size({ ratio: '1:1', resolution: '2k' }), '2048x2048')
  assert.equal(resolveGptImage2Size({ ratio: '1:1', resolution: '4k' }), '2880x2880')
})

test('keeps GPT Image 2 4K output under provider limits', () => {
  const size = resolveGptImage2Size({ ratio: '16:9', resolution: '4k' })
  const [width, height] = size.split('x').map(Number)

  assert.equal(size, '3840x2160')
  assert.ok(Math.max(width, height) <= 3840)
  assert.ok(width * height <= 8_300_000)
})

test('builds GPT Image 2 request body with supported advanced params', () => {
  assert.deepEqual(
    buildGptImage2RequestBody({
      prompt: 'A product shot',
      ratio: '9:16',
      resolution: '4k',
      quality: 'high',
      background: 'transparent',
      output_format: 'webp'
    }),
    {
      model: 'gpt-image-2',
      prompt: 'A product shot',
      size: '2160x3840',
      quality: 'high',
      background: 'transparent',
      output_format: 'webp',
      n: 1,
      moderation: 'auto',
      output_compression: 100
    }
  )
})
