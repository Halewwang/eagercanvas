import assert from 'node:assert/strict'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'

const projectRoot = dirname(fileURLToPath(new URL('../vite.config.js', import.meta.url)))
const srcRoot = join(projectRoot, 'src')
const viteConfigSource = readFileSync(join(projectRoot, 'vite.config.js'), 'utf8')
const packageJson = JSON.parse(readFileSync(join(projectRoot, 'package.json'), 'utf8'))

const walkSourceFiles = (dir) => {
  const files = []
  for (const entry of readdirSync(dir)) {
    const fullPath = join(dir, entry)
    const stat = statSync(fullPath)
    if (stat.isDirectory()) {
      files.push(...walkSourceFiles(fullPath))
    } else if (/\.(vue|js)$/.test(entry) && !entry.endsWith('.test.js')) {
      files.push(fullPath)
    }
  }
  return files
}

test('vite production build strips unused Vue Options API branches', () => {
  assert.match(viteConfigSource, /__VUE_OPTIONS_API__:\s*false/)
  assert.match(viteConfigSource, /__VUE_PROD_DEVTOOLS__:\s*false/)
  assert.match(viteConfigSource, /__VUE_PROD_HYDRATION_MISMATCH_DETAILS__:\s*false/)
})

test('vite production build uses deterministic terser size optimizations', () => {
  assert.ok(packageJson.devDependencies?.terser)
  assert.match(viteConfigSource, /minify:\s*'terser'/)
  assert.match(viteConfigSource, /modulePreload:\s*\{\s*polyfill:\s*false\s*\}/)
  assert.match(viteConfigSource, /terserOptions:\s*\{/)
  assert.match(viteConfigSource, /module:\s*true/)
  assert.match(viteConfigSource, /compress:\s*\{\s*passes:\s*3[\s\S]*pure_funcs:\s*\[\s*'console\.debug'\s*\]/)
  assert.match(viteConfigSource, /mangle:\s*\{\s*toplevel:\s*true\s*\}/)
  assert.match(viteConfigSource, /format:\s*\{\s*comments:\s*false\s*\}/)
  assert.match(viteConfigSource, /hoistTransitiveImports:\s*false/)
})

test('runtime components do not rely on Options API component declarations', () => {
  const offenders = walkSourceFiles(srcRoot).filter((file) => {
    const source = readFileSync(file, 'utf8')
    return /export\s+default\s*\{[\s\S]*?(data\s*\(\)|methods\s*:|computed\s*:|watch\s*:|created\s*\(|mounted\s*\()/m.test(source)
  })

  assert.deepEqual(offenders, [])
})
