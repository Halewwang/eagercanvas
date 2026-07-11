import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import {
  PROJECT_LIST_ACTIVATION_FAILED,
  awaitProjectListActivation,
  captureProjectListActivation
} from './projectListActivation.js'

const projectsStoreSource = readFileSync(new URL('./projects.js', import.meta.url), 'utf8')

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

test('captured activation observes an early rejection without an unhandled rejection window', async () => {
  const cause = new Error('selection failed early')
  const unhandledRejections = []
  const onUnhandledRejection = (reason) => unhandledRejections.push(reason)
  process.on('unhandledRejection', onUnhandledRejection)

  try {
    const captured = captureProjectListActivation({
      requestPromise: Promise.resolve({ data: [] }),
      commitAfter: Promise.reject(cause)
    })

    await new Promise((resolve) => setImmediate(resolve))
    assert.deepEqual(unhandledRejections, [])

    const result = await captured
    assert.equal(result.response, null)
    assert.equal(result.error?.code, PROJECT_LIST_ACTIVATION_FAILED)
    assert.equal(result.error?.cause, cause)
  } finally {
    process.off('unhandledRejection', onUnhandledRejection)
  }
})

test('captured project response cannot commit before activation', async () => {
  let activate
  const commitAfter = new Promise((resolve) => { activate = resolve })
  let committedProjects = null
  const captured = captureProjectListActivation({
    requestPromise: Promise.resolve({ data: [{ id: 'p1' }] }),
    commitAfter
  }).then((result) => {
    if (result.error) throw result.error
    committedProjects = result.response.data
  })

  await Promise.resolve()
  assert.equal(committedProjects, null)
  activate()
  await captured
  assert.deepEqual(committedProjects, [{ id: 'p1' }])
})

test('projects store starts and captures the remote request before cache hydration', () => {
  const activationIndex = projectsStoreSource.indexOf('captureProjectListActivation({')
  const hydrationIndex = projectsStoreSource.indexOf('await hydrateCanvasDraftCache()', activationIndex)
  const localCacheIndex = projectsStoreSource.indexOf('await loadLocalCache()', activationIndex)

  assert.notEqual(activationIndex, -1)
  assert.ok(activationIndex < hydrationIndex)
  assert.ok(activationIndex < localCacheIndex)
})
