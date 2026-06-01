import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { test } from 'node:test'

const componentUrl = new URL('./NodeSecondaryButton.vue', import.meta.url)
const componentPath = fileURLToPath(componentUrl)
const componentSource = existsSync(componentPath) ? readFileSync(componentUrl, 'utf8') : ''
const splitActionsUrl = new URL('./config/ConfigNodeSplitActions.vue', import.meta.url)
const splitActionsPath = fileURLToPath(splitActionsUrl)
const splitActionsSource = existsSync(splitActionsPath) ? readFileSync(splitActionsUrl, 'utf8') : ''
const imageConfigSource = readFileSync(new URL('./ImageConfigNode.vue', import.meta.url), 'utf8')

test('config node secondary actions use the scoped NodeSecondaryButton component', () => {
  assert.match(componentSource, /<button\s+type="button"\s+class="node-secondary-button"/)
  assert.match(componentSource, /<slot\s*\/>/)
  assert.match(componentSource, /<style scoped>/)
  assert.match(componentSource, /\.node-secondary-button\s*\{[^}]*border:\s*1px solid rgba\(143,\s*143,\s*143,\s*0\.32\)/s)
  assert.match(componentSource, /\.node-secondary-button:hover\s*\{[^}]*border-color:\s*rgba\(226,\s*229,\s*235,\s*0\.72\)/s)
  assert.match(componentSource, /\.node-secondary-button:hover\s*\{[^}]*color:\s*#f2f3f5/s)

  assert.match(imageConfigSource, /import ConfigNodeSplitActions from '\.\/config\/ConfigNodeSplitActions\.vue'/)
  assert.match(imageConfigSource, /<ConfigNodeSplitActions\b[^>]*@secondary="handleGenerate\('replace'\)"/)
  assert.match(splitActionsSource, /import NodeSecondaryButton from '@\/components\/nodes\/NodeSecondaryButton\.vue'/)
  assert.match(splitActionsSource, /<NodeSecondaryButton\s+class="config-node-split-actions__secondary"\s+:disabled="disabled"\s+@click="\$emit\('secondary'\)"/)
  assert.doesNotMatch(imageConfigSource, /<button @click="handleGenerate\('replace'\)"/)
  assert.doesNotMatch(imageConfigSource, /hover:border-\[rgba\(226,229,235,0\.72\)\]/)
})
