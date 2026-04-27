import assert from 'node:assert/strict'
import test from 'node:test'
import { z } from 'zod'

import { errorMiddleware } from './error.js'

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
