import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const source = readFileSync(new URL('./AdminPageHeader.vue', import.meta.url), 'utf8')

test('admin page header provides an action slot with the existing home action as fallback', () => {
  assert.match(source, /<slot name="actions">/)
  assert.match(source, /<AdminHeaderActionButton @click="\$emit\('go-home'\)">返回首页<\/AdminHeaderActionButton>/)
})
