import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { test } from 'node:test'

const componentUrl = new URL('./NodePrimaryButton.vue', import.meta.url)
const componentPath = fileURLToPath(componentUrl)
const componentSource = existsSync(componentPath) ? readFileSync(componentUrl, 'utf8') : ''
const configActionUrl = new URL('./config/ConfigNodePrimaryActionButton.vue', import.meta.url)
const configActionPath = fileURLToPath(configActionUrl)
const configActionSource = existsSync(configActionPath) ? readFileSync(configActionUrl, 'utf8') : ''
const globalStyleSource = readFileSync(new URL('../../style.css', import.meta.url), 'utf8')

const configNodeUrls = [
  new URL('./LLMConfigNode.vue', import.meta.url),
  new URL('./ImageConfigNode.vue', import.meta.url),
  new URL('./VideoConfigNode.vue', import.meta.url)
]

test('config node generation controls use the scoped NodePrimaryButton component', () => {
  const configSources = configNodeUrls.map((url) => readFileSync(url, 'utf8'))

  assert.match(componentSource, /<button\s+type="button"\s+class="node-primary-button"/)
  assert.match(componentSource, /<slot\s*\/>/)
  assert.match(componentSource, /<style scoped>/)
  assert.match(componentSource, /\.node-primary-button\s*\{[^}]*background:\s*linear-gradient\(135deg, var\(--button-highlight\), var\(--button-highlight-hover\)\)/s)
  assert.match(componentSource, /\.node-primary-button:hover\s*\{[^}]*transform:\s*translateY\(-1px\)/s)
  assert.doesNotMatch(globalStyleSource, /\.flora-button-primary(?:\s|:|\{)/)
  assert.match(configActionSource, /import NodePrimaryButton from '@\/components\/nodes\/NodePrimaryButton\.vue'/)
  assert.match(configActionSource, /<NodePrimaryButton/)
  assert.match(configActionSource, /<slot\s*\/>/)

  for (const source of configSources) {
    assert.match(source, /(?:import NodePrimaryButton from '\.\/NodePrimaryButton\.vue'|import ConfigNodePrimaryActionButton from '\.\/config\/ConfigNodePrimaryActionButton\.vue')/)
    assert.match(source, /(?:<NodePrimaryButton\b|<ConfigNodePrimaryActionButton\b)/)
    assert.doesNotMatch(source, /class="flora-button-primary\b/)
  }
})
