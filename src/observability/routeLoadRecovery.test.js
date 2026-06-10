import assert from 'node:assert/strict'
import test from 'node:test'

import {
  isRouteAssetLoadError,
  recoverRouteAssetLoadFailure
} from './routeLoadRecovery.js'

const createStorage = () => {
  const values = new Map()
  return {
    getItem: (key) => values.get(key) || null,
    setItem: (key, value) => {
      values.set(key, String(value))
    }
  }
}

test('route asset load detection matches Vite dynamic import failures', () => {
  assert.equal(isRouteAssetLoadError(new Error('Failed to fetch dynamically imported module: https://www.enbrand.space/assets/Workspace-old.js')), true)
  assert.equal(isRouteAssetLoadError({ name: 'ChunkLoadError', message: 'Loading chunk Workspace failed' }), true)
  assert.equal(isRouteAssetLoadError(new Error('Regular navigation guard failed')), false)
})

test('route asset load recovery reloads once per build', () => {
  const storage = createStorage()
  let reloadCount = 0
  const location = {
    reload: () => {
      reloadCount += 1
    }
  }

  assert.equal(recoverRouteAssetLoadFailure({
    error: new Error('Failed to fetch dynamically imported module: /assets/Workspace-old.js'),
    storage,
    location,
    buildId: 'build-1'
  }), true)
  assert.equal(recoverRouteAssetLoadFailure({
    error: new Error('Failed to fetch dynamically imported module: /assets/Workspace-old.js'),
    storage,
    location,
    buildId: 'build-1'
  }), false)
  assert.equal(reloadCount, 1)
})

test('route asset load recovery ignores unrelated errors', () => {
  let reloadCount = 0

  assert.equal(recoverRouteAssetLoadFailure({
    error: new Error('Navigation aborted'),
    storage: createStorage(),
    location: {
      reload: () => {
        reloadCount += 1
      }
    },
    buildId: 'build-1'
  }), false)
  assert.equal(reloadCount, 0)
})
