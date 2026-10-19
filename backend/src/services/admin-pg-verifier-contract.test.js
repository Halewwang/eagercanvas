import assert from 'node:assert/strict'
import { readFileSync, statSync } from 'node:fs'
import test from 'node:test'

const scriptUrl = new URL('../../../scripts/verify-admin-lifecycle-pg16.sh', import.meta.url)

test('release verifier is executable and covers the required PostgreSQL lifecycle gates', () => {
  const source = readFileSync(scriptUrl, 'utf8')
  const mode = statSync(scriptUrl).mode
  assert.notEqual(mode & 0o111, 0)
  for (const marker of [
    'PostgreSQL 16',
    'permission matrix',
    'migration rerun',
    'atomic audit rollback',
    'response loss',
    'restore epoch',
    'suspension saga',
    'role concurrency',
    'status concurrency',
    'archive concurrency'
  ]) assert.match(source, new RegExp(marker, 'i'))
})
