import assert from 'node:assert/strict'
import { test } from 'node:test'

import {
  bindNetworkStatusListeners,
  getNavigatorOnlineState
} from './networkStatus.js'

const createWindowHarness = () => {
  const listeners = new Map()

  return {
    addEventListener(type, handler) {
      listeners.set(type, handler)
    },
    removeEventListener(type, handler) {
      if (listeners.get(type) === handler) listeners.delete(type)
    },
    dispatch(type) {
      listeners.get(type)?.()
    },
    listenerCount() {
      return listeners.size
    }
  }
}

test('getNavigatorOnlineState treats missing navigator as online', () => {
  assert.equal(getNavigatorOnlineState(undefined), true)
  assert.equal(getNavigatorOnlineState({ onLine: true }), true)
  assert.equal(getNavigatorOnlineState({ onLine: false }), false)
})

test('bindNetworkStatusListeners toggles state and syncs only on online recovery', () => {
  const windowRef = createWindowHarness()
  const isOnline = { value: true }
  const syncCalls = []

  const stop = bindNetworkStatusListeners({
    isOnline,
    navigatorRef: { onLine: false },
    syncOfflineDrafts: () => syncCalls.push('sync'),
    windowRef
  })

  assert.equal(isOnline.value, false)
  assert.equal(windowRef.listenerCount(), 2)

  windowRef.dispatch('offline')
  assert.equal(isOnline.value, false)
  assert.deepEqual(syncCalls, [])

  windowRef.dispatch('online')
  assert.equal(isOnline.value, true)
  assert.deepEqual(syncCalls, ['sync'])

  stop()
  assert.equal(windowRef.listenerCount(), 0)

  windowRef.dispatch('offline')
  assert.equal(isOnline.value, true)
  assert.deepEqual(syncCalls, ['sync'])
})
