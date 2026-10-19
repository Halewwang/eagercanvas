import assert from 'node:assert/strict'
import test from 'node:test'
import { resolveRunProviderAccess } from './run-provider-access.js'

for (const type of ['chat', 'image', 'video']) {
  test(`${type} checks the same service grant and never reads or returns a per-user provider key`, async () => {
    const access = await resolveRunProviderAccess('user-1', { type }, {
      resolveCredential: () => assert.fail('per-user keys have been removed'),
      resolveServiceAccess: async (userId) => {
        assert.equal(userId, 'user-1')
        return { serviceCredentialId: 'service-1', apiKey: 'must-not-be-forwarded' }
      }
    })
    assert.deepEqual(access, { serviceCredentialId: 'service-1', apiName: type === 'video' ? 'shared' : 'enbrand' })
    assert.equal(Object.hasOwn(access, 'apiKey'), false)
  })

  test(`${type} preserves service and account rejections`, async () => {
    await assert.rejects(resolveRunProviderAccess('user-1', { type }, {
      resolveServiceAccess: async () => { throw new Error('SERVICE_DISABLED') }
    }), /SERVICE_DISABLED/)
  })
}
