import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import { extname, join, relative } from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const SERVICES_ROOT = fileURLToPath(new URL('./', import.meta.url))
const STRING_LITERAL = /(['"`])((?:\\.|(?!\1)[\s\S])*?)\1/g

const walkProductionJavaScript = (directory) => readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
  const path = join(directory, entry.name)
  if (entry.isDirectory()) return walkProductionJavaScript(path)
  return extname(entry.name) === '.js' && !entry.name.endsWith('.test.js') ? [path] : []
})

const isTechnicalProviderValue = (value) => {
  const text = String(value || '').trim()
  return !text ||
    text.startsWith('[') ||
    text.startsWith('/') ||
    /^[A-Za-z0-9_./:-]*302[A-Za-z0-9_./:-]*$/.test(text)
}

const hasUserVisibleProviderBrand = (value) => String(value || '')
  .replace(/\b[A-Z][A-Z0-9_]*302[A-Z0-9_]*\b/g, '')
  .includes('302')

test('backend service messages exposed through HttpError use the generic provider name', () => {
  const violations = []
  for (const path of walkProductionJavaScript(SERVICES_ROOT)) {
    const source = readFileSync(path, 'utf8')
    for (const match of source.matchAll(STRING_LITERAL)) {
      const value = match[2]
      if (hasUserVisibleProviderBrand(value) && !isTechnicalProviderValue(value)) {
        violations.push(`${relative(SERVICES_ROOT, path)}: ${value}`)
      }
    }
  }

  assert.deepEqual(violations, [], `Found provider-branded backend copy:\n${violations.join('\n')}`)
})
