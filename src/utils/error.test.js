import assert from 'node:assert/strict'
import test from 'node:test'

import { getErrorMessage } from './error.js'

test('error message normalizes raw abort errors for UI display', () => {
  assert.equal(
    getErrorMessage(new Error('This operation was aborted'), 'Image generation failed'),
    '请求超时或已被中断，请稍后重试。'
  )
  assert.equal(
    getErrorMessage({ name: 'AbortError' }, 'Image generation failed'),
    '请求超时或已被中断，请稍后重试。'
  )
})

test('error message retains network retry guidance', () => {
  for (const message of ['Network Error', 'Failed to fetch']) {
    assert.equal(
      getErrorMessage(new Error(message)),
      '无法连接到服务端，请稍后重试；如果已开通服务仍报错，请联系管理员检查后台服务配置。'
    )
  }
})

test('error message preserves service errors and caller fallbacks', () => {
  assert.equal(
    getErrorMessage({
      message: '当前账号尚未开通生成服务，请联系管理员。',
      code: 'SERVICE_NOT_ENABLED'
    }, '生成失败'),
    '当前账号尚未开通生成服务，请联系管理员。'
  )
  assert.equal(getErrorMessage(null, '生成失败'), '生成失败')
})
