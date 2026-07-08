import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const source = readFileSync(new URL('./admin.routes.js', import.meta.url), 'utf8')

test('manual service credential binding is protected by admin service activation permission', () => {
  assert.match(
    source,
    /adminRouter\.post\('\/users\/:userId\/service-access\/manual', requirePermission\(\['admin\.service_access\.activate'\]\)/
  )
})
