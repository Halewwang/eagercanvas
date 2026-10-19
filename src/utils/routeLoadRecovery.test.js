import assert from 'node:assert/strict'
import test from 'node:test'
import { isRouteAssetLoadError, recoverRouteAssetLoadFailure } from './routeLoadRecovery.js'

test('route recovery recognizes browser chunk loading errors', () => {
  for (const message of [
    'Failed to fetch dynamically imported module: /assets/Home.js',
    'error loading dynamically imported module',
    'Importing a module script failed.',
    'ChunkLoadError',
    'Loading chunk 123 failed'
  ]) {
    assert.equal(isRouteAssetLoadError(new Error(message)), true)
  }
  assert.equal(isRouteAssetLoadError(new Error('API unavailable')), false)
})

test('route recovery reloads once per build and preserves the current location', () => {
  const values = new Map()
  const storage = {
    getItem: (key) => values.get(key),
    setItem: (key, value) => values.set(key, value)
  }
  let reloads = 0
  const options = {
    error: new Error('Failed to fetch dynamically imported module'),
    storage,
    location: { reload: () => { reloads += 1 } },
    buildId: 'build-1'
  }

  assert.equal(recoverRouteAssetLoadFailure(options), true)
  assert.equal(recoverRouteAssetLoadFailure(options), false)
  assert.equal(reloads, 1)
  assert.equal(recoverRouteAssetLoadFailure({ ...options, buildId: 'build-2' }), true)
  assert.equal(reloads, 2)
})

test('route recovery safely skips restricted storage and ordinary errors', () => {
  let reloads = 0
  const options = {
    error: new Error('ChunkLoadError'),
    storage: {
      getItem: () => { throw new Error('storage denied') },
      setItem: () => {}
    },
    location: { reload: () => { reloads += 1 } }
  }

  assert.equal(recoverRouteAssetLoadFailure(options), false)
  assert.equal(recoverRouteAssetLoadFailure({ ...options, storage: null }), false)
  assert.equal(recoverRouteAssetLoadFailure({ ...options, error: new Error('API unavailable') }), false)
  assert.equal(reloads, 0)
})
