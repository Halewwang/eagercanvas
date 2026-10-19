import assert from 'node:assert/strict'
import { parse } from '@vue/compiler-sfc'
import { readFileSync, readdirSync } from 'node:fs'
import { extname, join, relative } from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const SRC_ROOT = new URL('../', import.meta.url)
const SOURCE_ROOT_PATH = fileURLToPath(SRC_ROOT)
const STATIC_VISIBLE_ATTRIBUTE = /\s(?:[\w-]*(?:label|title|caption|note|placeholder|description|message|eyebrow|text))=(['"])(.*?)\1/gis
const STRING_LITERAL = /(['"`])((?:\\.|(?!\1)[\s\S])*?)\1/g
const TECHNICAL_IDENTIFIERS = new Set(['302_usage_log'])
const containsProviderBrand = (value) => /(^|[^\p{L}\p{N}_])302(?=$|[^\p{L}\p{N}_])/iu.test(value)

const walkVueFiles = (directory) => readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
  const path = join(directory, entry.name)
  if (entry.isDirectory()) return walkVueFiles(path)
  return extname(entry.name) === '.vue' ? [path] : []
})

const visibleTemplateStrings = (source) => {
  const template = parse(source).descriptor.template?.content || ''
  const values = []
  for (const match of template.matchAll(STATIC_VISIBLE_ATTRIBUTE)) values.push(match[2])

  const withoutInterpolations = template
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/\{\{[\s\S]*?\}\}/g, '')
  for (const match of withoutInterpolations.matchAll(/>([^<>]+)</g)) {
    const value = match[1].replace(/\s+/g, ' ').trim()
    if (value) values.push(value)
  }
  return values
}

const VISIBLE_JS_FILES = [
  'config/models.js',
  'hooks/useAdminUserActionsCore.js',
  'utils/adminDisplay.js',
  'utils/adminLocalPreview.js'
]

const visibleJavaScriptStrings = (source) => [...source.matchAll(STRING_LITERAL)]
  .map((match) => match[2])
  .filter((value) => !TECHNICAL_IDENTIFIERS.has(value))

test('user-visible frontend copy names the provider generically instead of exposing 302 branding', () => {
  const violations = []
  for (const path of walkVueFiles(SOURCE_ROOT_PATH)) {
    const source = readFileSync(path, 'utf8')
    const descriptor = parse(source).descriptor
    const values = [
      ...visibleTemplateStrings(source),
      ...visibleJavaScriptStrings(descriptor.script?.content || ''),
      ...visibleJavaScriptStrings(descriptor.scriptSetup?.content || '')
    ]
    for (const value of values) {
      if (containsProviderBrand(value)) violations.push(`${relative(SOURCE_ROOT_PATH, path)}: ${value}`)
    }
  }
  for (const path of VISIBLE_JS_FILES) {
    const fullPath = join(SOURCE_ROOT_PATH, path)
    for (const value of visibleJavaScriptStrings(readFileSync(fullPath, 'utf8'))) {
      if (containsProviderBrand(value)) violations.push(`${path}: ${value}`)
    }
  }

  assert.deepEqual(violations, [], `Found user-visible 302 copy:\n${violations.join('\n')}`)
})
