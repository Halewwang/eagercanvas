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

test('request interceptor normalizes backend business error copy before toast', () => {
  assert.match(requestSource, /import \{ getErrorMessage \} from '\.\/error\.js'/)
  assert.match(requestSource, /const rawMessage = data\?\.message \|\| data\?\.error\?\.message \|\| error\.message/)
  assert.match(requestSource, /const message = getErrorMessage\(\{[\s\S]+response,[\s\S]+message: rawMessage[\s\S]+\}, rawMessage \|\| '请求失败'\)/)
})
