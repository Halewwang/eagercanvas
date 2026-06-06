#!/usr/bin/env node
import process from 'node:process'
import {
  exportCodexIssues,
  getDefaultCodexIssueOutputDir
} from '../backend/src/services/issue-codex-export.service.js'

const readArg = (name, fallback = '') => {
  const prefix = `--${name}=`
  const item = process.argv.find((arg) => arg.startsWith(prefix))
  return item ? item.slice(prefix.length) : fallback
}

const main = async () => {
  const outputDir = readArg('out', getDefaultCodexIssueOutputDir())
  const result = await exportCodexIssues({
    outputDir,
    filters: {
      status: readArg('status', 'open'),
      severity: readArg('severity', ''),
      sourceLayer: readArg('source-layer', ''),
      limit: Number(readArg('limit', '50'))
    }
  })

  console.log(JSON.stringify({
    ok: true,
    schema: result.table.schema,
    issueCount: result.issueCount,
    jsonPath: result.jsonPath,
    markdownPath: result.markdownPath
  }, null, 2))
}

main().catch((error) => {
  console.error(error?.stack || error?.message || error)
  process.exitCode = 1
})
