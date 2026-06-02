import assert from 'node:assert/strict'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { extname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { test } from 'node:test'

const srcDir = fileURLToPath(new URL('.', import.meta.url))
const styleSource = readFileSync(new URL('./style.css', import.meta.url), 'utf8')
const sourceExtensions = new Set(['.html', '.js', '.ts', '.vue'])

function readSourceFiles(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const filePath = join(dir, entry.name)

    if (entry.isDirectory()) {
      return readSourceFiles(filePath)
    }

    if (!entry.isFile()) {
      return []
    }

    if (entry.name === 'style.css' || entry.name.endsWith('.test.js')) {
      return []
    }

    if (!sourceExtensions.has(extname(entry.name))) {
      return []
    }

    const fileStat = statSync(filePath)
    if (!fileStat.isFile()) {
      return []
    }

    return readFileSync(filePath, 'utf8')
  })
}

test('toolbar button modifier styles have source users', () => {
  const definedModifiers = new Set(
    [...styleSource.matchAll(/\.ui-toolbar-button--[A-Za-z0-9_-]+/g)].map(([selector]) => selector.slice(1))
  )
  const appSource = readSourceFiles(srcDir).join('\n')
  const unusedModifiers = [...definedModifiers].filter((className) => !appSource.includes(className))

  assert.deepEqual(unusedModifiers, [])
})

test('retired legacy global style blocks stay removed', () => {
  const retiredSelectors = [
    'flora-input-shell',
    'flora-pill',
    'ec-modal',
    'ec-modal-header',
    'ec-modal-title',
    'ec-modal-close',
    'ec-modal-body',
    'ec-modal-section',
    'ec-modal-actions',
    'ec-btn',
    'ec-btn-primary',
    'ec-btn-secondary',
    'ec-btn-danger',
    'flora-header',
    'home-logo-ring',
    'home-hero-glow',
    'home-hero-glow-left',
    'custom-modal'
  ]

  for (const selector of retiredSelectors) {
    assert.doesNotMatch(styleSource, new RegExp(`\\.${selector}(?:\\s|\\.|:|\\{)`))
  }
})

test('non-home routes use the Google Sans app font scope', () => {
  assert.match(styleSource, /--font-google-sans:\s*'Google Sans',\s*'Google Sans Text',\s*'Product Sans',\s*'Segoe UI',\s*sans-serif;/)
  assert.match(styleSource, /\.app-route--google-sans\s*\{[^}]*font-family:\s*var\(--font-google-sans\);/s)
  assert.doesNotMatch(styleSource, /\.app-route--home\s*\{[^}]*font-family:\s*var\(--font-google-sans\);/s)
})
