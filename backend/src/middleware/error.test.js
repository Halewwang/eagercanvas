import assert from 'node:assert/strict'
import test from 'node:test'
import { z } from 'zod'

import { errorMiddleware } from './error.js'
import { HttpError } from '../utils/http.js'

test('error middleware reports Zod validation errors as bad requests', () => {
  const error = z.object({ email: z.string().email() }).safeParse({ email: 'bad-email' }).error
  const response = {
    statusCode: 0,
    body: null,
    status(statusCode) {
      this.statusCode = statusCode
      return this
    },
    json(payload) {
      this.body = payload
    }
  }

  errorMiddleware(error, { requestId: 'req-test', method: 'POST', path: '/auth/send-code' }, response)

  assert.equal(response.statusCode, 400)
  assert.equal(response.body.code, 'VALIDATION_ERROR')
  assert.equal(response.body.message, 'Invalid email address')
})

test('error middleware exposes safe diagnostic details only when explicitly allowed', (t) => {
  t.mock.method(console, 'error', () => {})
  const error = new HttpError(503, 'storage unavailable', 'STORAGE_UNAVAILABLE')
  error.exposeDetails = true
  error.metadata = {
    operation: 'asset_upload',
    retryable: true
  }
  const response = {
    statusCode: 0,
    body: null,
    status(statusCode) {
      this.statusCode = statusCode
      return this
    },
    json(payload) {
      this.body = payload
    }
  }

  errorMiddleware(error, { requestId: 'req-test', method: 'POST', path: '/upload' }, response)

  assert.equal(response.statusCode, 503)
  assert.equal(response.body.code, 'STORAGE_UNAVAILABLE')
  assert.deepEqual(response.body.details, error.metadata)
})

test('error middleware retains server logging and request correlation without exposing metadata', (t) => {
  const loggedErrors = []
  t.mock.method(console, 'error', (...args) => loggedErrors.push(args))
  const error = new Error('database unavailable')
  error.metadata = { private: 'internal details' }
  const response = {
    status(statusCode) {
      this.statusCode = statusCode
      return this
    },
    json(body) {
      this.body = body
    }
  }

  errorMiddleware(error, { requestId: 'req-test', method: 'POST', path: '/projects' }, response)

  assert.equal(response.statusCode, 500)
  assert.deepEqual(response.body, {
    code: 'INTERNAL_ERROR',
    message: 'database unavailable',
    requestId: 'req-test'
  })
  assert.equal(loggedErrors.length, 1)
  assert.equal(loggedErrors[0][0], '[server:error]')
  assert.equal(loggedErrors[0][1].requestId, 'req-test')
  assert.equal(loggedErrors[0][1].path, '/projects')
})
