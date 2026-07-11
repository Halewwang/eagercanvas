import assert from 'node:assert/strict'
import test from 'node:test'
import { createWorkspaceSelectionCoordinator } from './workspaceSelection.js'

const deferred = () => {
  let resolve
  let reject
  const promise = new Promise((resolvePromise, rejectPromise) => {
    resolve = resolvePromise
    reject = rejectPromise
  })
  return { promise, reject, resolve }
}

const flushPromises = () => new Promise((resolve) => setImmediate(resolve))

const createHarness = () => {
  const availableWorkspaces = ['A', 'B', 'C'].map((id) => ({ id }))
  const requests = { B: deferred(), C: deferred() }
  const requestOrder = []
  let currentWorkspace = availableWorkspaces[0]
  const coordinator = createWorkspaceSelectionCoordinator({
    applyResponse: (response) => { currentWorkspace = response.data.activeWorkspace },
    findWorkspace: (workspaceId) => availableWorkspaces.find((workspace) => workspace.id === workspaceId),
    getConfirmedFromResponse: (response) => response.data.activeWorkspace,
    getCurrentWorkspace: () => currentWorkspace,
    requestSelection: (workspaceId) => {
      requestOrder.push(workspaceId)
      return requests[workspaceId].promise
    },
    setCurrentWorkspace: (workspace) => { currentWorkspace = workspace }
  })
  coordinator.confirm(currentWorkspace)
  return {
    coordinator,
    getCurrentWorkspace: () => currentWorkspace,
    requestOrder,
    requests
  }
}

test('stale success stays hidden but becomes the rollback target for the latest failure', async () => {
  const harness = createHarness()
  const selectB = harness.coordinator.select('B')
  const selectC = harness.coordinator.select('C')

  assert.equal(harness.getCurrentWorkspace().id, 'C')
  await flushPromises()
  assert.deepEqual(harness.requestOrder, ['B'])

  harness.requests.B.resolve({ data: { activeWorkspace: { id: 'B' } } })
  await selectB
  assert.equal(harness.getCurrentWorkspace().id, 'C')
  await flushPromises()
  assert.deepEqual(harness.requestOrder, ['B', 'C'])

  const failure = new Error('C failed')
  harness.requests.C.reject(failure)
  await assert.rejects(selectC, failure)
  assert.equal(harness.getCurrentWorkspace().id, 'B')
})

test('consecutive selection failures roll back to the last server-confirmed workspace', async () => {
  const harness = createHarness()
  const failureB = new Error('B failed')
  const failureC = new Error('C failed')
  const selectB = assert.rejects(harness.coordinator.select('B'), failureB)
  const selectC = assert.rejects(harness.coordinator.select('C'), failureC)

  assert.equal(harness.getCurrentWorkspace().id, 'C')
  await flushPromises()
  harness.requests.B.reject(failureB)
  await selectB
  await flushPromises()
  harness.requests.C.reject(failureC)
  await selectC

  assert.deepEqual(harness.requestOrder, ['B', 'C'])
  assert.equal(harness.getCurrentWorkspace().id, 'A')
})
