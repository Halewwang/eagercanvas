import assert from 'node:assert/strict'
import test from 'node:test'

import { buildAuthFetchOptions, fetchWithAuth } from './authFetch.js'

test('auth fetch options include credentials and bearer token without dropping headers', () => {
  const options = buildAuthFetchOptions({
    token: 'abc123',
    options: {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Trace-Id': 'trace-1'
      },
      body: '{"ok":true}'
    }
  })

  assert.equal(options.method, 'POST')
  assert.equal(options.credentials, 'include')
  assert.equal(options.body, '{"ok":true}')
  assert.deepEqual(options.headers, {
    'Content-Type': 'application/json',
    'X-Trace-Id': 'trace-1',
    Authorization: 'Bearer abc123'
  })
})

test('auth fetch options preserve explicit credentials and skip empty tokens', () => {
  const options = buildAuthFetchOptions({
    token: '',
    options: {
      credentials: 'omit',
      headers: {
        Accept: 'application/json'
      }
    }
  })

  assert.equal(options.credentials, 'omit')
  assert.deepEqual(options.headers, {
    Accept: 'application/json'
  })
})

test('fetchWithAuth reads token from injected storage and calls injected fetch', async () => {
  const calls = []
  const response = { ok: true }
  const fetchImpl = async (...args) => {
    calls.push(args)
    return response
  }
  const storage = {
    getItem(key) {
      assert.equal(key, 'ec_access_token')
      return 'stored-token'
    }
  }

  const result = await fetchWithAuth('/api/demo', {
    method: 'GET',
    headers: { Accept: 'application/json' }
  }, { fetchImpl, storage })

  assert.equal(result, response)
  assert.equal(calls.length, 1)
  assert.equal(calls[0][0], '/api/demo')
  assert.deepEqual(calls[0][1], {
    method: 'GET',
    headers: {
      Accept: 'application/json',
      Authorization: 'Bearer stored-token'
    },
    credentials: 'include'
  })
})
