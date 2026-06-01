import assert from 'node:assert/strict'
import test from 'node:test'

import {
  getWedding3x3RatioOptions,
  getWedding3x3ResolutionOptions,
  ratioFromSizeKey,
  resolutionFromSizeKey,
  resolveWedding3x3SelectedSize
} from './Wedding3x3GenerationOptions.js'

test('wedding 3x3 generation options map provider size keys to ratio buckets', () => {
  assert.equal(ratioFromSizeKey('1024x1024'), '1:1')
  assert.equal(ratioFromSizeKey('1536x1024'), '3:2')
  assert.equal(ratioFromSizeKey('1024x1536'), '2:3')
  assert.equal(ratioFromSizeKey('1344x768'), '16:9')
  assert.equal(ratioFromSizeKey('768x1344'), '9:16')
  assert.equal(ratioFromSizeKey('1792x768'), '21:9')
  assert.equal(ratioFromSizeKey('bad-size'), '1:1')
})

test('wedding 3x3 generation options map provider size keys to resolution buckets', () => {
  assert.equal(resolutionFromSizeKey('1024x1024'), '1k')
  assert.equal(resolutionFromSizeKey('1792x1024'), '2k')
  assert.equal(resolutionFromSizeKey('4096x2304'), '4k')
  assert.equal(resolutionFromSizeKey(''), '1k')
})

test('wedding 3x3 generation options keep unique ratio and resolution choices in provider order', () => {
  const sizeOptions = [
    { key: '1024x1024', label: 'Square 1K' },
    { key: '1536x1024', label: 'Landscape 1K' },
    { key: '3072x2048', label: 'Landscape 4K' },
    { key: '1024x1536', label: 'Portrait 1K' },
    { key: '1792x768', label: 'Wide 2K' }
  ]

  assert.deepEqual(getWedding3x3RatioOptions(sizeOptions), [
    { key: '1:1', label: '1:1' },
    { key: '3:2', label: '3:2' },
    { key: '2:3', label: '2:3' },
    { key: '21:9', label: '21:9' }
  ])
  assert.deepEqual(getWedding3x3ResolutionOptions(sizeOptions, '3:2'), [
    { key: '1k', label: '1K' },
    { key: '4k', label: '4K' }
  ])
})

test('wedding 3x3 selected size prefers exact ratio and resolution before fallbacks', () => {
  const sizeOptions = [
    { key: '1024x1024', label: 'Square 1K' },
    { key: '1536x1024', label: 'Landscape 1K' },
    { key: '3072x2048', label: 'Landscape 4K' },
    { key: '1024x1536', label: 'Portrait 1K' }
  ]

  assert.equal(resolveWedding3x3SelectedSize(sizeOptions, '3:2', '4k', 'fallback-size'), '3072x2048')
  assert.equal(resolveWedding3x3SelectedSize(sizeOptions, '3:2', '2k', 'fallback-size'), '1536x1024')
  assert.equal(resolveWedding3x3SelectedSize(sizeOptions, '21:9', '2k', 'fallback-size'), '1024x1024')
  assert.equal(resolveWedding3x3SelectedSize([], '3:2', '1k', 'fallback-size'), 'fallback-size')
  assert.equal(resolveWedding3x3SelectedSize([], '3:2', '1k', ''), '1024x1024')
})
