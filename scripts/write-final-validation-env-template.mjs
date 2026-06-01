import { existsSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { buildFinalValidationEnvTemplates } from './final-validation-readiness-core.mjs'

const rootDir = process.cwd()
const shouldForce = process.argv.includes('--force')
const templates = buildFinalValidationEnvTemplates()

const writeTemplate = (relativePath, content) => {
  const absolutePath = path.join(rootDir, relativePath)
  if (existsSync(absolutePath) && !shouldForce) {
    console.info(`Skipped ${relativePath}; file already exists. Use --force to overwrite.`)
    return
  }
  writeFileSync(absolutePath, content, { mode: 0o600 })
  console.info(`Wrote ${relativePath}`)
}

writeTemplate(templates.frontendPath, templates.frontendContent)
writeTemplate(templates.backendPath, templates.backendContent)

console.info('Fill placeholder secrets locally, then run npm run check:validation-readiness.')
