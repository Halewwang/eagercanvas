import assert from 'node:assert/strict'
import { test } from 'node:test'
import * as serviceOpsCore from './useAdminServiceOpsCore.js'

test('admin service log query update preserves the existing allowed fields', () => {
  const query = { page: 1, limit: 20, start: '', end: '' }

  assert.equal(serviceOpsCore.updateAdminLog302Query(query, 'page', 3), true)
  assert.equal(serviceOpsCore.updateAdminLog302Query(query, 'limit', 50), true)
  assert.equal(serviceOpsCore.updateAdminLog302Query(query, 'start', '2026-05-01'), true)
  assert.equal(serviceOpsCore.updateAdminLog302Query(query, 'end', '2026-05-30'), true)

  assert.deepEqual(query, {
    page: 3,
    limit: 50,
    start: '2026-05-01',
    end: '2026-05-30'
  })
})

test('admin service log query update ignores unsupported keys', () => {
  const query = { page: 1, limit: 20, start: '', end: '' }

  assert.equal(serviceOpsCore.updateAdminLog302Query(query, 'requestId', 'abc'), false)
  assert.equal(serviceOpsCore.updateAdminLog302Query(query, '', 'abc'), false)

  assert.deepEqual(query, { page: 1, limit: 20, start: '', end: '' })
})

test('admin service log query defaults to the current day range for visible time filters', () => {
  assert.equal(typeof serviceOpsCore.createAdminServiceLogQuery, 'function')
  assert.equal(typeof serviceOpsCore.formatAdminServiceLocalDateTime, 'function')

  const query = serviceOpsCore.createAdminServiceLogQuery({
    now: new Date(2026, 5, 6, 19, 12, 44),
    pageSize: 10
  })

  assert.deepEqual(query, {
    page: 1,
    limit: 10,
    start: '2026-06-06T00:00',
    end: '2026-06-06T19:12'
  })
  assert.equal(serviceOpsCore.formatAdminServiceLocalDateTime(new Date(2026, 0, 2, 3, 4, 5)), '2026-01-02T03:04')
})

test('admin service key form helpers preserve defaults and draft coercion', () => {
  assert.equal(typeof serviceOpsCore.createAdminServiceKeyForm, 'function')
  assert.equal(typeof serviceOpsCore.buildAdminServiceKeyDraft, 'function')
  assert.equal(typeof serviceOpsCore.resetAdminServiceKeyForm, 'function')

  assert.deepEqual(serviceOpsCore.createAdminServiceKeyForm(), {
    api_name: '',
    allow_save_logs: false,
    allow_custom_model: false,
    allow_manage_key: false,
    limit_cost: 0,
    limit_daily_cost: 0,
    expired_on: 0
  })

  assert.deepEqual(serviceOpsCore.buildAdminServiceKeyDraft({
    api_name: 'svc-a',
    allow_save_logs: 1,
    allow_custom_model: '',
    allow_manage_key: true,
    limit_cost: '12.5',
    limit_daily_cost: undefined,
    expired_on: '1770000000'
  }), {
    api_name: 'svc-a',
    allow_save_logs: true,
    allow_custom_model: false,
    allow_manage_key: true,
    limit_cost: 12.5,
    limit_daily_cost: 0,
    expired_on: 1770000000
  })

  const form = {
    api_name: 'svc-old',
    allow_save_logs: true,
    allow_custom_model: true,
    allow_manage_key: true,
    limit_cost: 9,
    limit_daily_cost: 8,
    expired_on: 7
  }
  serviceOpsCore.resetAdminServiceKeyForm(form)
  assert.deepEqual(form, serviceOpsCore.createAdminServiceKeyForm())
})

test('admin service time and notice helpers preserve load failure messages', () => {
  assert.equal(typeof serviceOpsCore.toAdminServiceUnixSeconds, 'function')
  assert.equal(typeof serviceOpsCore.isAdminServiceAvailabilityError, 'function')
  assert.equal(typeof serviceOpsCore.getAdminServiceNoticeMessage, 'function')
  assert.equal(typeof serviceOpsCore.prefixAdminServiceNotice, 'function')

  assert.equal(serviceOpsCore.toAdminServiceUnixSeconds('2026-05-30T00:00:00Z'), 1780099200)
  assert.equal(serviceOpsCore.toAdminServiceUnixSeconds(''), undefined)
  assert.equal(serviceOpsCore.toAdminServiceUnixSeconds('not-a-date'), undefined)

  assert.equal(serviceOpsCore.isAdminServiceAvailabilityError({ response: { status: 502 } }), true)
  assert.equal(serviceOpsCore.isAdminServiceAvailabilityError({ status: 504 }), true)
  assert.equal(serviceOpsCore.isAdminServiceAvailabilityError({ status: 404 }), false)

  const getErrorMessage = (error, fallback) => error?.message || fallback
  assert.equal(
    serviceOpsCore.getAdminServiceNoticeMessage('加载失败', { status: 503, message: 'upstream down' }, getErrorMessage),
    'Eager 服务暂时不可用，已跳过该区块的数据加载。其他后台功能仍可正常使用。'
  )
  assert.equal(
    serviceOpsCore.getAdminServiceNoticeMessage('加载失败', { status: 400, message: 'bad request' }, getErrorMessage),
    'bad request'
  )
  assert.equal(serviceOpsCore.prefixAdminServiceNotice('账户余额', '加载失败'), '账户余额：加载失败')
  assert.equal(serviceOpsCore.prefixAdminServiceNotice('', '加载失败'), '加载失败')
  assert.equal(serviceOpsCore.prefixAdminServiceNotice('账户余额', ''), '')
})
