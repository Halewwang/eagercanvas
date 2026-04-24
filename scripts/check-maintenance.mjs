import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'

const rootDir = process.cwd()
const srcDir = path.join(rootDir, 'src')
const sourceExtensions = new Set(['.js', '.vue', '.css'])
const forbiddenPatterns = [
  { name: 'console.log', pattern: /\bconsole\.log\s*\(/ },
  { name: 'debugger', pattern: /\bdebugger\b/ },
  { name: 'TODO', pattern: /\bTODO\b/ },
  { name: 'FIXME', pattern: /\bFIXME\b/ }
]

const walk = async (dir) => {
  const entries = await readdir(dir, { withFileTypes: true })
  const files = []

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      files.push(...await walk(fullPath))
    } else if (sourceExtensions.has(path.extname(entry.name))) {
      files.push(fullPath)
    }
  }

  return files
}

const toRelative = (filePath) => path.relative(rootDir, filePath)

const files = await walk(srcDir)
const failures = []
const upwardRelativeImports = []
const forbiddenProjectStateExport = path.join(srcDir, 'stores', 'projects.js')

for (const file of files) {
  const relativePath = toRelative(file)
  if (/(^|\/)[^/]+ 2\.[^/]+$/.test(relativePath)) {
    failures.push(`${relativePath}: duplicate Finder-style copy file`)
  }

  const content = await readFile(file, 'utf8')
  if (file === forbiddenProjectStateExport && /export\s+const\s+currentProjectId\s*=/.test(content)) {
    failures.push(`${relativePath}: project id state must live in src/stores/canvas.js only`)
  }

  const lines = content.split(/\r?\n/)

  lines.forEach((line, index) => {
    forbiddenPatterns.forEach(({ name, pattern }) => {
      if (pattern.test(line)) failures.push(`${relativePath}:${index + 1}: ${name}`)
    })

    if (/from\s+['"]\.\.\//.test(line) || /import\s*\(\s*['"]\.\.\//.test(line)) {
      upwardRelativeImports.push(`${relativePath}:${index + 1}: ${line.trim()}`)
    }
  })
}

if (upwardRelativeImports.length > 0) {
  failures.push(`Use @/ aliases instead of upward relative imports (${upwardRelativeImports.length} found).`)
  upwardRelativeImports.slice(0, 10).forEach((item) => failures.push(item))
  if (upwardRelativeImports.length > 10) {
    failures.push(`...and ${upwardRelativeImports.length - 10} more upward relative imports`)
  }
}

if (failures.length > 0) {
  console.error('Maintenance check failed:')
  failures.forEach((failure) => console.error(`  ${failure}`))
  process.exit(1)
}

console.info('Maintenance check passed.')
