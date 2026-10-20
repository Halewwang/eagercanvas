import assert from 'node:assert/strict'
import test from 'node:test'
import { GPT_IMAGE_2_RATIOS, GPT_IMAGE_2_RESOLUTION_OPTIONS, getGptImageGenerationSettings, resolveGptImage2Size, selectGptImageGenerationSize } from './gptImageParameters.js'

test('APIMart generation uses documented ratios and resolution tiers without invented pixels', () => {
  assert.deepEqual(GPT_IMAGE_2_RATIOS, ['auto', '1:1', '3:2', '2:3', '4:3', '3:4', '5:4', '4:5', '16:9', '9:16', '2:1', '1:2', '3:1', '1:3', '21:9', '9:21'])
  assert.deepEqual(GPT_IMAGE_2_RESOLUTION_OPTIONS.map(item => item.key), ['1k', '2k', '4k'])
  assert.equal(resolveGptImage2Size({ ratio: '16:9', resolution: '4k', size: '1024x1024' }), '16:9')
  assert.equal(resolveGptImage2Size({ size: '9:21' }), '9:21')
  assert.equal(resolveGptImage2Size({ size: '1536x1024' }), '1:1')
})

test('generation migration keeps media dimensions independent and drops unsupported settings', () => {
  assert.deepEqual(getGptImageGenerationSettings(), { ratio: '1:1', resolution: '1k', size: '1:1' })
  assert.deepEqual(getGptImageGenerationSettings({ url: 'image.png', size: '1536x1024', ratio: '3:2' }), { ratio: '1:1', resolution: '1k', size: '1:1' })
  assert.deepEqual(getGptImageGenerationSettings({ exportRatio: '16:9', exportSize: 4096 }), { ratio: '16:9', resolution: '4k', size: '16:9' })
  assert.deepEqual(getGptImageGenerationSettings({ generationRatio: 'auto', generationResolution: '4k', generationQuality: 'high', background: 'opaque' }), { ratio: 'auto', resolution: '4k', size: 'auto' })
  assert.deepEqual(getGptImageGenerationSettings({ generationResolution: 'auto', exportRatio: '', exportSize: 0 }), { ratio: 'auto', resolution: '1k', size: 'auto' })
})

test('ratio and resolution selections remain independent including Auto ratio with fixed resolution', () => {
  assert.deepEqual(selectGptImageGenerationSize({ ratio: '16:9', resolution: '4k' }, 'ratio', 'auto'), { ratio: 'auto', resolution: '4k' })
  assert.deepEqual(selectGptImageGenerationSize({ ratio: 'auto', resolution: '1k' }, 'resolution', '4k'), { ratio: 'auto', resolution: '4k' })
  assert.deepEqual(selectGptImageGenerationSize({ ratio: 'auto', resolution: '4k' }, 'resolution', 'auto'), { ratio: 'auto', resolution: '1k' })
})
