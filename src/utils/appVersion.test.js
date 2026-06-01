import assert from 'node:assert/strict'
import { afterEach, test } from 'node:test'
import { checkForAppUpdate } from './appVersion.js'

const originalFetch = globalThis.fetch
const originalConsoleWarn = console.warn

afterEach(() => {
  globalThis.fetch = originalFetch
  console.warn = originalConsoleWarn
})

test('checkForAppUpdate keeps missing local manifests out of warn logs', async () => {
  const warnings = []
  globalThis.fetch = async () => {
    throw new Error('Failed to fetch')
  }
  console.warn = (...args) => {
    warnings.push(args)
  }

  const updateAvailable = await checkForAppUpdate()

  assert.equal(updateAvailable, false)
  assert.deepEqual(warnings, [])
})
