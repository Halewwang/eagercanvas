#!/usr/bin/env node
import process from 'node:process'
import { pruneIssueObservability } from '../backend/src/services/issue-retention.service.js'

const hasFlag = (name) => process.argv.includes(`--${name}`)
const readArg = (name, fallback = '') => {
  const prefix = `--${name}=`
  const item = process.argv.find((arg) => arg.startsWith(prefix))
  return item ? item.slice(prefix.length) : fallback
}

const main = async () => {
  const result = await pruneIssueObservability({
    dryRun: hasFlag('dry-run'),
    eventRetentionDays: Number(readArg('event-days', '30')),
    notificationRetentionDays: Number(readArg('notification-days', '180'))
  })

  console.log(JSON.stringify(result, null, 2))
  if (!result.ok) process.exitCode = 1
}

main().catch((error) => {
  console.error(error?.stack || error?.message || error)
  process.exitCode = 1
})
