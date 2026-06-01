import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import {
  assessFinalValidationReadiness,
  buildFinalValidationRunbook,
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
const readiness = assessFinalValidationReadiness({
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
const runbook = buildFinalValidationRunbook({ readiness })

console.info(`Final validation runbook (${runbook.summary})`)

if (!runbook.ready) {
  console.info('')
  console.info('Readiness blockers:')
  runbook.blockers.forEach((blocker) => console.info(`  - ${blocker}`))
}

console.info('')
console.info('Steps:')
runbook.steps.forEach((step, index) => {
  console.info(`${index + 1}. ${step.title}`)
  console.info(`   Command: ${step.command}`)
  console.info(`   Evidence: ${step.evidence}`)
})
