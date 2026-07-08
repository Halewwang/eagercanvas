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

test('error message explains reserved service credential keys for admins', () => {
  assert.equal(
    getErrorMessage({
      message: 'Management provider keys cannot be assigned to a user service credential.',
      response: { data: { code: 'SERVICE_API_KEY_RESERVED' } }
    }, '手动绑定服务 Key 失败'),
    '不能绑定系统管理 Key。请在 302.ai 为该用户单独创建普通运行时 API Key 后再粘贴。'
  )
})
