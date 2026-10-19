import assert from 'node:assert/strict'
import test from 'node:test'

import { buildProviderUrl } from './providers/http-client.js'

test('provider http client preserves provider base url normalization', () => {
  assert.equal(
    buildProviderUrl('https://provider.test/v1', '/v1/responses'),
    'https://provider.test/v1/responses'
  )
  assert.equal(
    buildProviderUrl('https://provider.test/v1', '/v1beta/models/example'),
    'https://provider.test/v1beta/models/example'
  )
  assert.equal(
    buildProviderUrl('https://provider.test/v1beta', '/v1beta/models/example'),
    'https://provider.test/v1beta/models/example'
  )
  assert.equal(
    buildProviderUrl('https://provider.test/v1beta', '/v1/videos'),
    'https://provider.test/v1/videos'
  )
  assert.equal(
    buildProviderUrl('https://provider.test/root/', 'custom/path'),
    'https://provider.test/root/custom/path'
  )
  assert.equal(
    buildProviderUrl('https://provider.test/v1', 'https://override.test/direct'),
    'https://override.test/direct'
  )
})
