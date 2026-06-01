import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const routeSource = readFileSync(new URL('./index.js', import.meta.url), 'utf8')

test('chat completions compatibility route returns SSE for stream requests without bypassing run creation', () => {
  assert.match(routeSource, /import \{[^}]*streamChatCompletion[^}]*\} from '\.\.\/services\/runs\.service\.js'/)
  assert.match(routeSource, /if \(req\.body\?\.stream\)/)
  assert.doesNotMatch(routeSource, /createChatCompletion\(req\.user\.id, \{ \.\.\.req\.body, stream: false \}\)/)
  assert.match(routeSource, /res\.setHeader\('Content-Type', 'text\/event-stream'\)/)
  assert.match(routeSource, /await streamChatCompletion\(req\.user\.id, req\.body, \{/)
  assert.match(routeSource, /onEvent: \(event\) => res\.write\(event\)/)
})
