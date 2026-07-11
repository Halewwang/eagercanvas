import assert from 'node:assert/strict'
import test from 'node:test'
import { PROJECT_LIST_ACTIVATION_FAILED, awaitProjectListActivation } from './projectListActivation.js'

test('request resolves early but cannot commit before activation', async () => {
  let release
  const commitAfter = new Promise((resolve) => { release = resolve })
  let settled = false
  const pending = awaitProjectListActivation({
    requestPromise: Promise.resolve({ data: [{ id: 'p1' }] }),
    commitAfter
  }).then((value) => { settled = true; return value })
  await Promise.resolve()
  assert.equal(settled, false)
  release()
  assert.deepEqual(await pending, { data: [{ id: 'p1' }] })
})

test('activation rejection is distinguishable from request failure', async () => {
  const cause = new Error('selection failed')
  await assert.rejects(
    awaitProjectListActivation({
      requestPromise: Promise.resolve({ data: [] }),
      commitAfter: Promise.reject(cause)
    }),
    (error) => error.code === PROJECT_LIST_ACTIVATION_FAILED && error.cause === cause
  )
})
