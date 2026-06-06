import assert from 'node:assert/strict'
import { EventEmitter } from 'node:events'
import test from 'node:test'

import { createRequestObserver } from './request-observer.js'

test('request observer records slow requests after response finish', async () => {
  const events = []
  const req = {
    requestId: 'req-1',
    user: { id: 'user-1' },
    method: 'GET',
    path: '/api/v1/projects',
    route: { path: '/projects' },
    baseUrl: '/api/v1'
  }
  const res = new EventEmitter()
  res.statusCode = 200

  const originalNow = Date.now
  let current = 1000
  Date.now = () => current

  try {
    const middleware = createRequestObserver({
      slowRequestMs: 50,
      recordIssue: async (payload) => events.push(payload)
    })
    middleware(req, res, () => {})
    current = 1100
    res.emit('finish')
    await new Promise((resolve) => setImmediate(resolve))
  } finally {
    Date.now = originalNow
  }

  assert.equal(events.length, 1)
  assert.equal(events[0].source_layer, 'performance')
  assert.equal(events[0].category, 'slow_request')
  assert.equal(events[0].duration_ms, 100)
  assert.equal(events[0].path_template, '/api/v1/projects')
})

test('request observer default slow threshold matches PRD', async () => {
  const events = []
  const req = {
    requestId: 'req-default-slow',
    method: 'GET',
    path: '/api/v1/slow'
  }
  const res = new EventEmitter()
  res.statusCode = 200

  const originalNow = Date.now
  let current = 1000
  Date.now = () => current

  try {
    const middleware = createRequestObserver({
      recordIssue: async (payload) => events.push(payload)
    })
    middleware(req, res, () => {})
    current = 4000
    res.emit('finish')
    await new Promise((resolve) => setImmediate(resolve))
  } finally {
    Date.now = originalNow
  }

  assert.equal(events.length, 1)
  assert.equal(events[0].category, 'slow_request')
  assert.equal(events[0].duration_ms, 3000)
})

test('request observer skips duplicate 500 event when error middleware already reported it', async () => {
  const events = []
  const req = {
    requestId: 'req-1',
    issueErrorReported: true,
    method: 'GET',
    path: '/api/v1/projects'
  }
  const res = new EventEmitter()
  res.statusCode = 500

  const middleware = createRequestObserver({
    slowRequestMs: 1000,
    recordIssue: async (payload) => events.push(payload)
  })
  middleware(req, res, () => {})
  res.emit('finish')
  await new Promise((resolve) => setImmediate(resolve))

  assert.equal(events.length, 0)
})
