import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const source = readFileSync(new URL('./run-task-records.js', import.meta.url), 'utf8')

test('image task ownership records source node id for media recovery', () => {
  assert.match(source, /export const bindImageTaskOwnership = async \(\{ userId, runId, taskId, model = '', sourceNodeId = '' \}\)/)
  assert.match(source, /const safeSourceNodeId = String\(sourceNodeId \|\| ''\)\.trim\(\)/)
  assert.match(source, /\.\.\.\(safeSourceNodeId \? \{ source_node_id: safeSourceNodeId \} : \{\}\)/)
  assert.match(source, /sourceNodeId: metadata\?\.source_node_id \? String\(metadata\.source_node_id\) : ''/)
})
