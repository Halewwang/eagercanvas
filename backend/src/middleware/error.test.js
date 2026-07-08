import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { z } from 'zod'

import { errorMiddleware } from './error.js'

const source = readFileSync(new URL('./error.js', import.meta.url), 'utf8')

test('error middleware registers async issue writes with serverless waitUntil', () => {
  assert.match(source, /from '@vercel\/functions'/)
  assert.match(source, /waitUntil\(queueDatabaseIssue\(err, \{[\s\S]*pathTemplate: req\.path[\s\S]*\}\)\.catch\(\(\) => \{\}\)\)/)
  assert.match(source, /waitUntil\(queueIssueEvent\(buildServerErrorIssuePayload\(err, req, status, code\)\)\.catch\(\(\) => \{\}\)\)/)
  assert.match(source, /\.\.\.\(err\.metadata && typeof err\.metadata === 'object' \? \{ details: err\.metadata \} : \{\}\)/)
})

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

test('error middleware builds a safe issue payload for server errors', () => {
  const error = new Error('database exploded')
  error.code = 'DB_FAILED'

  const payload = errorMiddleware.buildIssuePayload(error, {
    requestId: 'req-test',
    method: 'POST',
    path: '/projects/11111111-1111-1111-1111-111111111111',
    user: { id: 'user-1' }
  }, 500, 'INTERNAL_ERROR')

  assert.equal(payload.source_layer, 'backend')
  assert.equal(payload.category, 'server_error')
  assert.equal(payload.severity, 'p1')
  assert.equal(payload.request_id, 'req-test')
  assert.equal(payload.user_id, 'user-1')
  assert.equal(payload.error_code, 'INTERNAL_ERROR')
  assert.equal(payload.path_template, '/projects/11111111-1111-1111-1111-111111111111')
})
