import assert from 'node:assert/strict'
import test from 'node:test'

import { getErrorMessage } from './error.js'

test('error message normalizes raw abort errors for UI display', () => {
  assert.equal(
    getErrorMessage(new Error('This operation was aborted'), 'Image generation failed'),
    '请求超时或已被中断，请稍后重试。'
  )
  assert.equal(
    getErrorMessage({
      message: 'Derouter image request timed out after 300000ms. Please retry.',
      response: { data: { code: 'DEROUTER_TIMEOUT' } }
    }, 'Image generation failed'),
    'GPT Image lite 生成超时，请稍后重试。'
  )
})
