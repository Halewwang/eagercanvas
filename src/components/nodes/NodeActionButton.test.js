import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { test } from 'node:test'

const componentUrl = new URL('./NodeActionButton.vue', import.meta.url)
const componentPath = fileURLToPath(componentUrl)
const componentSource = existsSync(componentPath) ? readFileSync(componentUrl, 'utf8') : ''
const globalStyleSource = readFileSync(new URL('../../style.css', import.meta.url), 'utf8')
const hoverActionsUrl = new URL('./config/ConfigNodeHoverActions.vue', import.meta.url)
const hoverActionsPath = fileURLToPath(hoverActionsUrl)
const hoverActionsSource = existsSync(hoverActionsPath) ? readFileSync(hoverActionsUrl, 'utf8') : ''

const configNodeUrls = [
  new URL('./LLMConfigNode.vue', import.meta.url),
  new URL('./ImageConfigNode.vue', import.meta.url),
  new URL('./VideoConfigNode.vue', import.meta.url)
]

test('config node hover actions use the scoped NodeActionButton component', () => {
  const configSources = configNodeUrls.map((url) => readFileSync(url, 'utf8'))

  assert.match(componentSource, /<button\s+type="button"\s+class="node-action-btn"/)
  assert.match(componentSource, /<slot\s*\/>/)
  assert.match(componentSource, /<style scoped>/)
  assert.match(componentSource, /\.node-action-btn\s*\{[^}]*background:\s*color-mix\(in srgb, var\(--bg-secondary\) 88%, transparent\)/s)
  assert.match(componentSource, /\.node-action-btn\s*\{[^}]*backdrop-filter:\s*var\(--surface-blur\)/s)
  assert.doesNotMatch(globalStyleSource, /\.action-btn\s*\{/)
  assert.match(hoverActionsSource, /import NodeActionButton from '@\/components\/nodes\/NodeActionButton\.vue'/)
  assert.match(hoverActionsSource, /<NodeActionButton\b/)

  for (const source of configSources) {
    assert.match(source, /import ConfigNodeHoverActions from '\.\/config\/ConfigNodeHoverActions\.vue'/)
    assert.match(source, /<ConfigNodeHoverActions\b/)
    assert.doesNotMatch(source, /import NodeActionButton from '\.\/NodeActionButton\.vue'/)
    assert.doesNotMatch(source, /<NodeActionButton\b/)
    assert.doesNotMatch(source, /class="action-btn\b/)
  }
})
