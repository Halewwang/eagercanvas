import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const source = readFileSync(new URL('./useImageApi.js', import.meta.url), 'utf8')

test('image generation request forwards source node id for result recovery', () => {
  assert.match(source, /if \(params\.sourceNodeId\) requestData\.sourceNodeId = params\.sourceNodeId/)
})
