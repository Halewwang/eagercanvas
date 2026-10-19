import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'

const requestSource = readFileSync(new URL('./request.js', import.meta.url), 'utf8')

test('request interceptor retains 401 refresh and retry handling', () => {
  assert.match(requestSource, /if \(status === 401\)/)
  assert.match(requestSource, /const refreshRes = await instance\.post\('\/auth\/refresh'\)/)
  assert.match(requestSource, /flushQueue\(null, nextToken\)/)
  assert.match(requestSource, /return instance\(originalRequest\)/)
  assert.match(requestSource, /flushQueue\(refreshError, ''\)/)
})

test('request interceptor normalizes backend business error copy before toast', () => {
  assert.match(requestSource, /import \{ getErrorMessage \} from '\.\/error\.js'/)
  assert.match(requestSource, /const rawMessage = data\?\.message \|\| data\?\.error\?\.message \|\| error\.message/)
  assert.match(requestSource, /const message = getErrorMessage\(\{[\s\S]+response,[\s\S]+message: rawMessage[\s\S]+\}, rawMessage \|\| '请求失败'\)/)
})
