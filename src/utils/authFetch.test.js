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

test('fetchWithAuth refreshes an expired access token once and retries the original request', async () => {
  const values = new Map([['ec_access_token', 'expired-token']])
  const calls = []
  const storage = {
    getItem(key) {
      return values.get(key) || ''
    },
    setItem(key, value) {
      values.set(key, value)
    },
    removeItem(key) {
      values.delete(key)
    }
  }
  const fetchImpl = async (url, options = {}) => {
    calls.push({ url, options })
    if (calls.length === 1) {
      assert.equal(url, 'https://api.test/api/v1/chat/completions')
      assert.equal(options.headers.Authorization, 'Bearer expired-token')
      return new Response(JSON.stringify({ message: 'Invalid or expired access token' }), { status: 401 })
    }
    if (calls.length === 2) {
      assert.equal(url, 'https://api.test/api/v1/auth/refresh')
      assert.equal(options.method, 'POST')
      return new Response(JSON.stringify({ accessToken: 'fresh-token' }), { status: 200 })
    }
    assert.equal(url, 'https://api.test/api/v1/chat/completions')
    assert.equal(options.headers.Authorization, 'Bearer fresh-token')
    return new Response('ok', { status: 200 })
  }

  const result = await fetchWithAuth('https://api.test/api/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: '{"stream":true}'
  }, { fetchImpl, storage })

  assert.equal(result.status, 200)
  assert.equal(values.get('ec_access_token'), 'fresh-token')
  assert.equal(calls.length, 3)
})
