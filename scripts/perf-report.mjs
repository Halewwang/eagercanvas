#!/usr/bin/env node

import { spawnSync } from 'child_process'
import fs from 'fs'
import path from 'path'

const scenarioFile = String(process.env.PERF_SCENARIO_FILE || '').trim()
const scenarioName = String(process.env.PERF_SCENARIO_NAME || '').trim()
const reportsDir = path.resolve(process.env.PERF_REPORTS_DIR || 'perf-reports')

if (!scenarioFile && !scenarioName) {
  console.error('[perf-report] set PERF_SCENARIO_FILE or PERF_SCENARIO_NAME')
  process.exit(1)
}

const resolvedScenarioFile = scenarioFile
  ? scenarioFile
  : `scripts/perf-scenarios/${scenarioName}.json`

const safeName = path.basename(resolvedScenarioFile).replace(/\.json$/i, '').replace(/[^a-zA-Z0-9_-]+/g, '-')
const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
const outputFile = path.join(reportsDir, `${timestamp}-${safeName}.json`)

fs.mkdirSync(reportsDir, { recursive: true })

const env = {
  ...process.env,
  PERF_SCENARIO_FILE: resolvedScenarioFile,
  PERF_OUTPUT_FILE: outputFile
}

const result = spawnSync(process.execPath, ['scripts/perf-baseline.mjs'], {
  cwd: process.cwd(),
  env,
  stdio: 'inherit'
})

if (result.status !== 0) {
  process.exit(result.status || 1)
}

console.log(`[perf-report] saved ${outputFile}`)
