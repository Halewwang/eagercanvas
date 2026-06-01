import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import {
  assessFinalValidationReadiness,
  parseEnvContent
} from './final-validation-readiness-core.mjs'

const rootDir = process.cwd()

const readEnvFiles = (relativePaths = []) => {
  const existingFiles = []
  const values = {}

  for (const relativePath of relativePaths) {
    const absolutePath = path.join(rootDir, relativePath)
    if (!existsSync(absolutePath)) continue
    existingFiles.push(relativePath)
    Object.assign(values, parseEnvContent(readFileSync(absolutePath, 'utf8')))
  }

  return { existingFiles, values }
}

const frontend = readEnvFiles(['.env', '.env.local'])
const backend = readEnvFiles(['backend/.env', 'backend/.env.local'])
const result = assessFinalValidationReadiness({
  frontendEnvFiles: frontend.existingFiles,
  backendEnvFiles: backend.existingFiles,
  frontendEnv: {
    ...process.env,
    ...frontend.values
  },
  backendEnv: {
    ...process.env,
    ...backend.values
  }
})

console.info('Final validation readiness:')
result.checks.forEach((check) => {
  const marker = check.status === 'pass' ? 'PASS' : 'FAIL'
  const suffix = check.reason ? ` - ${check.reason}` : ''
  console.info(`  [${marker}] ${check.label}${suffix}`)
})
console.info(`Summary: ${result.summary.totalChecks - result.summary.failedChecks}/${result.summary.totalChecks} ready`)

if (!result.ready) {
  process.exit(1)
}
