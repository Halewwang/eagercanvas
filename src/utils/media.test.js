import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const mediaSource = () => readFileSync(new URL('./media.js', import.meta.url), 'utf8')

test('signed upload XHR has a hard timeout instead of waiting forever at 98 percent', () => {
  const source = mediaSource()

  assert.match(source, /SIGNED_UPLOAD_TIMEOUT_MS/)
  assert.match(source, /xhr\.timeout\s*=/)
  assert.match(source, /xhr\.ontimeout\s*=/)
  assert.match(source, /Upload timed out/)
})
