import assert from 'node:assert/strict'
import test from 'node:test'

import { getStoredValue, removeStoredValue, setStoredValue } from './storage.js'

const createMemoryStorage = () => {
  const values = new Map()
  return {
    getItem: (key) => values.get(key) || null,
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: (key) => values.delete(key),
    values
  }
}

test('storage helpers read, write, and remove values', () => {
  const storage = createMemoryStorage()

  setStoredValue('token', 'abc', { storage })

  assert.equal(getStoredValue('token', '', { storage }), 'abc')

  removeStoredValue('token', { storage })

  assert.equal(getStoredValue('token', 'fallback', { storage }), 'fallback')
})

test('setStoredValue removes the key for empty values', () => {
  const storage = createMemoryStorage()
  storage.setItem('token', 'abc')

  setStoredValue('token', '', { storage })

  assert.equal(storage.getItem('token'), null)
})

test('storage helpers return fallback when storage throws', () => {
  const storage = {
    getItem: () => {
      throw new Error('blocked')
    },
    setItem: () => {
      throw new Error('blocked')
    },
    removeItem: () => {
      throw new Error('blocked')
    }
  }

  assert.equal(getStoredValue('token', 'fallback', { storage }), 'fallback')
  assert.doesNotThrow(() => setStoredValue('token', 'abc', { storage }))
  assert.doesNotThrow(() => removeStoredValue('token', { storage }))
})
