import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const source = readFileSync(new URL('./AdminDesktopOnlyAction.vue', import.meta.url), 'utf8')

test('desktop-only action explains blocked mobile mutations', () => {
  assert.match(source, /min-width:\s*768px/)
  assert.match(source, /请使用桌面端完成此操作/)
  assert.match(source, /:disabled="!desktopEnabled"/)
})
