import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildRunProviderRequestOptions,
  resolveRunProviderAccess
} from './run-provider-access.js'

test('resolveRunProviderAccess keeps GPT Image lite off the 302 runtime key lookup path', async () => {
  let credentialCalls = 0
  let accessCalls = 0

  const access = await resolveRunProviderAccess('user-1', {
    type: 'image',
    payload: {
      model: 'gpt-image-lite',
      prompt: 'A clean product shot'
    }
  }, {
    resolveCredential: async () => {
      credentialCalls += 1
      throw new Error('302 credential lookup should not run for derouter image generation')
    },
    resolveServiceAccess: async (userId) => {
      accessCalls += 1
      assert.equal(userId, 'user-1')
      return {
        serviceCredentialId: 'cred-1',
        apiName: 'eager_user_active'
      }
    }
  })

  assert.equal(credentialCalls, 0)
  assert.equal(accessCalls, 1)
  assert.deepEqual(access, {
    serviceCredentialId: 'cred-1',
    apiName: 'derouter',
    apiKey: ''
  })
  assert.deepEqual(buildRunProviderRequestOptions(access), {})
})

test('resolveRunProviderAccess keeps GPT Image 2 on the user 302 runtime key path', async () => {
  let credentialCalls = 0
  let accessCalls = 0

  const access = await resolveRunProviderAccess('user-1', {
    type: 'image',
    payload: {
      model: 'gpt-image-2',
      prompt: 'A clean product shot'
    }
  }, {
    resolveCredential: async (userId) => {
      credentialCalls += 1
      assert.equal(userId, 'user-1')
      return {
        serviceCredentialId: 'cred-1',
        apiName: 'eager_user_active',
        apiKey: 'sk-user'
      }
    },
    resolveServiceAccess: async () => {
      accessCalls += 1
      throw new Error('service-only access should not run for GPT Image 2')
    }
  })

  assert.equal(credentialCalls, 1)
  assert.equal(accessCalls, 0)
  assert.deepEqual(access, {
    serviceCredentialId: 'cred-1',
    apiName: 'eager_user_active',
    apiKey: 'sk-user'
  })
  assert.deepEqual(buildRunProviderRequestOptions(access), { apiKey: 'sk-user' })
})
