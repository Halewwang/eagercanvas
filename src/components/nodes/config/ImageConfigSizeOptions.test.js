import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  getImageConfigRatioFromSizeKey,
  getImageConfigResolutionFromSizeKey,
  resolveImageConfigSizeSelection
} from './ImageConfigSizeOptions.js'

test('image config size helpers derive ratio and resolution from provider size keys', () => {
  assert.equal(getImageConfigRatioFromSizeKey('auto'), 'auto')
  assert.equal(getImageConfigRatioFromSizeKey('1024x1024'), '1:1')
  assert.equal(getImageConfigRatioFromSizeKey('1536x1024'), '3:2')
  assert.equal(getImageConfigRatioFromSizeKey('1024x1536'), '2:3')
  assert.equal(getImageConfigRatioFromSizeKey('1344x768'), '16:9')
  assert.equal(getImageConfigRatioFromSizeKey('768x1344'), '9:16')
  assert.equal(getImageConfigRatioFromSizeKey('1792x768'), '21:9')
  assert.equal(getImageConfigRatioFromSizeKey('bad-size'), '1:1')

  assert.equal(getImageConfigResolutionFromSizeKey('auto'), '1k')
  assert.equal(getImageConfigResolutionFromSizeKey('1024x1024'), '1k')
  assert.equal(getImageConfigResolutionFromSizeKey('2048x2048'), '2k')
  assert.equal(getImageConfigResolutionFromSizeKey('4096x4096'), '4k')
  assert.equal(getImageConfigResolutionFromSizeKey(''), '1k')
})

test('image config size selection keeps provider-safe nearest size semantics', () => {
  const sizeOptions = [
    { key: 'auto', label: 'Auto' },
    { key: '1024x1024', label: 'Square 1K' },
    { key: '2048x2048', label: 'Square 2K' },
    { key: '1536x1024', label: 'Landscape 1K' },
    { key: '3072x2048', label: 'Landscape 2K' }
  ]

  assert.deepEqual(
    resolveImageConfigSizeSelection({
      sizeOptions,
      currentSize: '1024x1024',
      ratio: '3:2',
      resolution: '2k'
    }),
    { size: '3072x2048', ratio: '3:2', resolution: '2k' }
  )

  assert.deepEqual(
    resolveImageConfigSizeSelection({
      sizeOptions,
      currentSize: '2048x2048',
      ratio: '3:2',
      resolution: '4k'
    }),
    { size: '1536x1024', ratio: '3:2', resolution: '1k' }
  )

  assert.deepEqual(
    resolveImageConfigSizeSelection({
      sizeOptions,
      currentSize: '2048x2048',
      ratio: 'auto',
      resolution: '2k'
    }),
    { size: 'auto', ratio: 'auto', resolution: '2k' }
  )
})
