import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import crypto from 'node:crypto'
import path from 'node:path'
import { fillGeneratedJwtSecrets } from './final-validation-readiness-core.mjs'

const rootDir = process.cwd()
const backendEnvPath = 'backend/.env.local'
const absoluteBackendEnvPath = path.join(rootDir, backendEnvPath)

if (!existsSync(absoluteBackendEnvPath)) {
  console.error(`${backendEnvPath} is missing. Run npm run prepare:validation-env first.`)
  process.exit(1)
}

const generateSecret = () => crypto.randomBytes(48).toString('base64url')
const currentContent = readFileSync(absoluteBackendEnvPath, 'utf8')
const nextContent = fillGeneratedJwtSecrets(currentContent, { generateSecret })

if (nextContent === currentContent) {
  console.info('JWT secrets already look generated or placeholders are absent; no changes written.')
} else {
  writeFileSync(absoluteBackendEnvPath, nextContent, { mode: 0o600 })
  console.info(`Generated JWT secrets in ${backendEnvPath}.`)
}

console.info('No secret values were printed. Run npm run check:validation-readiness next.')
