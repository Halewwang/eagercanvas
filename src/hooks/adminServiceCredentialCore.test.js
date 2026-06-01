import assert from 'node:assert/strict'
import { test } from 'node:test'

const credentialCore = await import('./adminServiceCredentialCore.js').catch(() => ({}))

test('admin service credential core owns shared default form values', () => {
  assert.equal(typeof credentialCore.createAdminServiceCredentialForm, 'function')

  assert.deepEqual(credentialCore.createAdminServiceCredentialForm(), {
    api_name: '',
    allow_save_logs: false,
    allow_custom_model: false,
    allow_manage_key: false,
    limit_cost: 0,
    limit_daily_cost: 0,
    expired_on: 0
  })
})

test('admin service credential core owns draft coercion and reset behavior', () => {
  assert.equal(typeof credentialCore.buildAdminServiceCredentialDraft, 'function')
  assert.equal(typeof credentialCore.resetAdminServiceCredentialForm, 'function')

  assert.deepEqual(credentialCore.buildAdminServiceCredentialDraft({
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
  credentialCore.resetAdminServiceCredentialForm(form)

  assert.deepEqual(form, credentialCore.createAdminServiceCredentialForm())
})
