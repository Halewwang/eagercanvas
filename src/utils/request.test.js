import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'

const requestSource = readFileSync(new URL('./request.js', import.meta.url), 'utf8')

test('request interceptor delays 401 issue reporting until refresh cannot recover', () => {
  const responseHandlerStart = requestSource.indexOf('async (error) => {')
  const unauthorizedBranch = requestSource.indexOf('if (status === 401)', responseHandlerStart)
  const firstIssueReport = requestSource.indexOf('reportRequestIssue()', responseHandlerStart)

  assert.match(requestSource, /const reportRequestIssue = \(\) => \{/)
  assert.ok(unauthorizedBranch > responseHandlerStart)
  assert.ok(firstIssueReport > unauthorizedBranch)
  assert.match(requestSource, /return instance\(originalRequest\)/)
})
