import assert from 'node:assert/strict'
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { extname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { test } from 'node:test'

const srcDir = fileURLToPath(new URL('../../', import.meta.url))
const modalActionsPath = fileURLToPath(new URL('./BaseModalActions.vue', import.meta.url))
const modalCopyPath = fileURLToPath(new URL('./BaseModalCopy.vue', import.meta.url))
const globalStyleSource = readFileSync(new URL('../../style.css', import.meta.url), 'utf8')
const sourceExtensions = new Set(['.html', '.js', '.ts', '.vue'])

function readSourceFiles(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const filePath = join(dir, entry.name)

    if (entry.isDirectory()) {
      return readSourceFiles(filePath)
    }

    if (!entry.isFile() || !sourceExtensions.has(extname(entry.name))) {
      return []
    }

    if (filePath === modalActionsPath || filePath === modalCopyPath || entry.name.endsWith('.test.js')) {
      return []
    }

    const fileStat = statSync(filePath)
    if (!fileStat.isFile()) {
      return []
    }

    return {
      filePath,
      source: readFileSync(filePath, 'utf8')
    }
  })
}

test('modal footer actions use the shared BaseModalActions component', () => {
  const componentSource = existsSync(modalActionsPath) ? readFileSync(modalActionsPath, 'utf8') : ''
  const uiIndexSource = readFileSync(new URL('./index.js', import.meta.url), 'utf8')
  const appSources = readSourceFiles(srcDir)
  const directActionWrappers = appSources
    .filter(({ source }) => /<div\s+class="ui-modal-actions/.test(source))
    .map(({ filePath }) => filePath.replace(`${srcDir}/`, ''))

  assert.match(componentSource, /class="ui-modal-actions"/)
  assert.match(componentSource, /<style scoped>/)
  assert.match(componentSource, /\.ui-modal-actions\s*\{[^}]*display:\s*flex/s)
  assert.match(componentSource, /\.ui-modal-actions\s*\{[^}]*justify-content:\s*flex-end/s)
  assert.doesNotMatch(globalStyleSource, /\.ui-modal-actions\s*\{/)
  assert.match(uiIndexSource, /BaseModalActions/)
  assert.deepEqual(directActionWrappers, [])
})

test('modal body copy uses the shared BaseModalCopy component', () => {
  const componentSource = existsSync(modalCopyPath) ? readFileSync(modalCopyPath, 'utf8') : ''
  const uiIndexSource = readFileSync(new URL('./index.js', import.meta.url), 'utf8')
  const appSources = readSourceFiles(srcDir)
  const directCopyBlocks = appSources
    .filter(({ source }) => /class="[^"]*ui-modal-copy/.test(source))
    .map(({ filePath }) => filePath.replace(`${srcDir}/`, ''))

  assert.match(componentSource, /class="ui-body ui-modal-copy"/)
  assert.match(componentSource, /<style scoped>/)
  assert.match(componentSource, /\.ui-modal-copy\s*\{[^}]*color:\s*var\(--text-muted\)/s)
  assert.doesNotMatch(globalStyleSource, /\.ui-modal-copy\s*\{/)
  assert.match(uiIndexSource, /BaseModalCopy/)
  assert.deepEqual(directCopyBlocks, [])
})
