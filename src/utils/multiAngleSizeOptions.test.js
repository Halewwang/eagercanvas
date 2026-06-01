import assert from 'node:assert/strict'
import test from 'node:test'

import {
  getMultiAngleFilteredSizeOptions,
  getMultiAngleResolutionOptions,
  normalizeMultiAngleOptionList,
  ratioFromMultiAngleSize,
  resolutionFromMultiAngleSize
} from './multiAngleSizeOptions.js'

test('multi angle size options resolve known aspect buckets from size strings', () => {
  assert.equal(ratioFromMultiAngleSize('1024x1024'), '1:1')
  assert.equal(ratioFromMultiAngleSize('2048x1365'), '3:2')
  assert.equal(ratioFromMultiAngleSize('1365x2048'), '2:3')
  assert.equal(ratioFromMultiAngleSize('1792x1024'), '16:9')
  assert.equal(ratioFromMultiAngleSize('1024x1792'), '9:16')
  assert.equal(ratioFromMultiAngleSize('bad-size'), '1:1')
})

test('multi angle size options resolve resolution buckets from the longest side', () => {
  assert.equal(resolutionFromMultiAngleSize('1024x1024'), '1k')
  assert.equal(resolutionFromMultiAngleSize('2048x1365'), '2k')
  assert.equal(resolutionFromMultiAngleSize('4096x2730'), '4k')
  assert.equal(resolutionFromMultiAngleSize(''), '1k')
})

test('multi angle option normalization preserves labels and removes empty keys', () => {
  assert.deepEqual(normalizeMultiAngleOptionList([
    '1024x1024',
    { value: '2048x1365', label: '2K Landscape' },
    { key: '4096x2730' },
    { label: 'label-only' },
    { key: '', label: 'empty' },
    null
  ]), [
    { key: '1024x1024', label: '1024x1024' },
    { key: '2048x1365', label: '2K Landscape' },
    { key: '4096x2730', label: '4096x2730' },
    { key: 'label-only', label: 'label-only' }
  ])
})

test('multi angle filtered sizes prefer matching ratio and fall back to all options', () => {
  const options = [
    { key: '1024x1024', label: 'Square' },
    { key: '1536x1024', label: 'Landscape 1K' },
    { key: '2048x1365', label: 'Landscape 2K' }
  ]

  assert.deepEqual(getMultiAngleFilteredSizeOptions(options, '3:2'), [
    { key: '1536x1024', label: 'Landscape 1K' },
    { key: '2048x1365', label: 'Landscape 2K' }
  ])
  assert.deepEqual(getMultiAngleFilteredSizeOptions(options, '21:9'), options)
})

test('multi angle resolution options are unique and keep the first matching size key', () => {
  assert.deepEqual(getMultiAngleResolutionOptions([
    { key: '1536x1024', label: 'Landscape 1K' },
    { key: '1600x1067', label: 'Landscape 1K duplicate' },
    { key: '2048x1365', label: 'Landscape 2K' },
    { key: '4096x2730', label: 'Landscape 4K' }
  ], '3:2'), [
    { key: '1k', label: '1K', sizeKey: '1536x1024' },
    { key: '2k', label: '2K', sizeKey: '2048x1365' },
    { key: '4k', label: '4K', sizeKey: '4096x2730' }
  ])
})
