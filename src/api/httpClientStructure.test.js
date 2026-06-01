import assert from 'node:assert/strict'
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { test } from 'node:test'

const readApiSource = (name) => {
  const url = new URL(`./${name}`, import.meta.url)
  assert.ok(existsSync(fileURLToPath(url)), `${name} should exist`)
  return readFileSync(url, 'utf8')
}

const readSource = (relativePath) => {
  const url = new URL(relativePath, import.meta.url)
  assert.ok(existsSync(fileURLToPath(url)), `${relativePath} should exist`)
  return readFileSync(url, 'utf8')
}

test('api layer owns a narrow http client facade over the shared request utilities', () => {
  const httpClientSource = readApiSource('_httpClient.js')

  assert.match(httpClientSource, /import request, \{ getBaseUrl, setBaseUrl \} from '@\/utils\/request\.js'/)
  assert.match(httpClientSource, /import \{ fetchWithAuth \} from '@\/utils\/authFetch\.js'/)
  assert.match(httpClientSource, /export const apiRequest = request/)
  assert.match(httpClientSource, /export const getApiBaseUrl = getBaseUrl/)
  assert.match(httpClientSource, /export const setApiBaseUrl = setBaseUrl/)
  assert.match(httpClientSource, /export const fetchWithApiAuth = fetchWithAuth/)
  assert.doesNotMatch(httpClientSource, /axios\.create/)
})

test('api endpoint modules import http helpers only from the api facade', () => {
  const endpointFiles = readdirSync(new URL('.', import.meta.url))
    .filter((name) => name.endsWith('.js'))
    .filter((name) => !name.endsWith('.test.js'))
    .filter((name) => !['_httpClient.js', 'index.js'].includes(name))

  for (const name of endpointFiles) {
    const source = readApiSource(name)
    assert.doesNotMatch(
      source,
      /import \{[^}]*\b(?:request|getBaseUrl|setBaseUrl|fetchWithAuth)\b[^}]*\} from '@\/utils'/,
      `${name} should not import http helpers from the utils barrel`
    )
    assert.doesNotMatch(
      source,
      /import request(?:, \{[^}]*\})? from '@\/utils/,
      `${name} should not import request from utils directly`
    )
  }

  assert.match(readApiSource('chat.js'), /from '\.\/_httpClient\.js'/)
  assert.match(readApiSource('image.js'), /from '\.\/_httpClient\.js'/)
  assert.match(readApiSource('video.js'), /from '\.\/_httpClient\.js'/)
})

test('api configuration hook sets base url through the api client facade', () => {
  const apiConfigSource = readSource('../hooks/useApiConfig.js')

  assert.match(apiConfigSource, /import \{ setApiBaseUrl as setRequestBaseUrl \} from '@\/api\/_httpClient\.js'/)
  assert.doesNotMatch(apiConfigSource, /setBaseUrl as setRequestBaseUrl/)
})
