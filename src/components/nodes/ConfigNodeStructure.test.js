import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { test } from 'node:test'

const imageConfigSource = readFileSync(new URL('./ImageConfigNode.vue', import.meta.url), 'utf8')
const videoConfigSource = readFileSync(new URL('./VideoConfigNode.vue', import.meta.url), 'utf8')
const llmConfigSource = readFileSync(new URL('./LLMConfigNode.vue', import.meta.url), 'utf8')

function readConfigComponentSource(name) {
  for (const extension of ['vue', 'js']) {
    const url = new URL(`./config/${name}.${extension}`, import.meta.url)
    const path = fileURLToPath(url)
    if (existsSync(path)) return readFileSync(url, 'utf8')
  }
  return ''
}

test('image and video config nodes delegate connection status pills to a shared component', () => {
  const connectionStatusSource = readConfigComponentSource('ConfigNodeConnectionStatus')

  for (const source of [imageConfigSource, videoConfigSource]) {
    assert.match(source, /import ConfigNodeConnectionStatus from '\.\/config\/ConfigNodeConnectionStatus\.vue'/)
    assert.match(source, /<ConfigNodeConnectionStatus\s+:items="connectionStatusItems"/)
    assert.doesNotMatch(source, /class="flex(?: flex-wrap)? items-center gap-2 text-xs text-\[#8f939e\] py-1 border-t border-\[rgba\(143,143,143,0\.28\)\]"/)
    assert.doesNotMatch(source, /class="px-3 py-1 rounded-full"/)
    assert.doesNotMatch(source, /bg-\[#2a2a2a\] text-\[#f2f3f5\] border border-\[rgba\(255,255,255,0\.62\)\]/)
  }

  assert.match(imageConfigSource, /const connectionStatusItems = computed\(\(\) => \[/)
  assert.match(imageConfigSource, /key: 'prompt'/)
  assert.match(imageConfigSource, /key: 'reference'/)
  assert.match(imageConfigSource, /currentModelConfig\.value\?\.supportImageReference/)
  assert.match(videoConfigSource, /const connectionStatusItems = computed\(\(\) => \{/)
  assert.match(videoConfigSource, /:wrap="true"/)

  assert.match(connectionStatusSource, /defineProps\(\{\s*items:/s)
  assert.match(connectionStatusSource, /wrap: Boolean/)
  assert.match(connectionStatusSource, /v-for="item in items"/)
  assert.match(connectionStatusSource, /class="px-3 py-1 rounded-full"/)
  assert.match(connectionStatusSource, /item\.active \? 'bg-\[#2a2a2a\] text-\[#f2f3f5\] border border-\[rgba\(255,255,255,0\.62\)\]' : 'bg-\[#1a1a1a\] text-\[#818793\] border border-\[rgba\(143,143,143,0\.36\)\]'/)
})

test('config nodes delegate shared header chrome while keeping actions parent-owned', () => {
  const headerSource = readConfigComponentSource('ConfigNodeHeader')

  for (const source of [imageConfigSource, videoConfigSource, llmConfigSource]) {
    assert.match(source, /import ConfigNodeHeader from '\.\/config\/ConfigNodeHeader\.vue'/)
    assert.match(source, /<ConfigNodeHeader\b[^>]*@delete="handleDelete"/)
    assert.doesNotMatch(source, /class="flex items-center justify-between px-3 py-2 border-b border-\[rgba\(143,143,143,0\.28\)\]"/)
    assert.doesNotMatch(source, /@click="handleDelete" class="p-1 hover:bg-\[rgba\(255,255,255,0\.04\)\] rounded transition-colors"/)
  }

  assert.match(imageConfigSource, /<template #actions>/)
  assert.match(imageConfigSource, /<BaseDropdown :options="modelOptions" compact @select="handleModelSelect">/)
  assert.match(llmConfigSource, /<template #icon>/)
  assert.match(headerSource, /defineEmits\(\['delete'\]\)/)
  assert.match(headerSource, /<slot name="icon"/)
  assert.match(headerSource, /<slot name="actions"/)
  assert.match(headerSource, /<ConfigNodeIconButton type="button" @click="\$emit\('delete'\)">/)
  assert.match(headerSource, /TrashOutline/)
})

test('config node header icon buttons use shared compact chrome', () => {
  const headerSource = readConfigComponentSource('ConfigNodeHeader')
  const iconButtonSource = readConfigComponentSource('ConfigNodeIconButton')

  assert.match(headerSource, /import ConfigNodeIconButton from '\.\/ConfigNodeIconButton\.vue'/)
  assert.match(imageConfigSource, /import ConfigNodeIconButton from '\.\/config\/ConfigNodeIconButton\.vue'/)
  assert.match(imageConfigSource, /<ConfigNodeIconButton>\s*<ChevronDownOutline \/>/)
  assert.doesNotMatch(headerSource, /class="p-1 hover:bg-\[rgba\(255,255,255,0\.04\)\] rounded transition-colors"/)
  assert.doesNotMatch(imageConfigSource, /class="p-1 hover:bg-\[rgba\(255,255,255,0\.04\)\] rounded transition-colors"/)

  assert.match(iconButtonSource, /<button class="p-1 hover:bg-\[rgba\(255,255,255,0\.04\)\] rounded transition-colors">/)
  assert.match(iconButtonSource, /<n-icon :size="size">/)
  assert.match(iconButtonSource, /<slot\s*\/>/)
  assert.match(iconButtonSource, /size:/)
})

test('config nodes delegate selected shell chrome to a shared component', () => {
  const shellSource = readConfigComponentSource('ConfigNodeShell')

  assert.match(imageConfigSource, /import ConfigNodeShell from '\.\/config\/ConfigNodeShell\.vue'/)
  assert.match(videoConfigSource, /import ConfigNodeShell from '\.\/config\/ConfigNodeShell\.vue'/)
  assert.match(llmConfigSource, /import ConfigNodeShell from '\.\/config\/ConfigNodeShell\.vue'/)

  assert.match(imageConfigSource, /<ConfigNodeShell :selected="data\.selected" class="image-config-node min-w-\[300px\]">/)
  assert.match(videoConfigSource, /<ConfigNodeShell :selected="data\.selected" class="video-config-node min-w-\[300px\]">/)
  assert.match(llmConfigSource, /<ConfigNodeShell :selected="data\.selected" class="llm-node min-w-\[320px\] max-w-\[400px\] relative">/)

  for (const source of [imageConfigSource, videoConfigSource, llmConfigSource]) {
    assert.doesNotMatch(source, /bg-\[#0f0f0f\] rounded-2xl border/)
    assert.doesNotMatch(source, /:class="data\.selected \? 'border-\[#8f8f8f\]' : 'border-transparent'"/)
  }

  assert.match(shellSource, /<div\s+class="config-node-shell bg-\[#0f0f0f\] rounded-2xl border transition-all duration-200"\s+:class="selected \? 'border-\[#8f8f8f\]' : 'border-transparent'"/)
  assert.match(shellSource, /<slot\s*\/>/)
  assert.match(shellSource, /defineProps\(\{\s*selected:/s)
})

test('dropdown config rows keep option row chrome in a shared component', () => {
  const optionRowSource = readConfigComponentSource('ConfigNodeOptionRow')
  const dropdownRowSource = readConfigComponentSource('ConfigNodeDropdownRow')

  for (const source of [imageConfigSource, videoConfigSource]) {
    assert.doesNotMatch(source, /import ConfigNodeOptionRow from '\.\/config\/ConfigNodeOptionRow\.vue'/)
    assert.doesNotMatch(source, /<ConfigNodeOptionRow\b/)
    assert.doesNotMatch(source, /<div(?: v-if="[^"]+")? class="flex items-center justify-between">/)
    assert.doesNotMatch(source, /<span class="text-xs text-\[#8f939e\]">(Model|Quality|Background|Format|Size|Ratio|Resolution|Mode|Type|Audio|Duration)<\/span>/)
  }

  assert.match(dropdownRowSource, /import ConfigNodeOptionRow from '\.\/ConfigNodeOptionRow\.vue'/)
  assert.match(dropdownRowSource, /<ConfigNodeOptionRow :label="label">/)
  assert.match(optionRowSource, /<div class="flex items-center justify-between">/)
  assert.match(optionRowSource, /<span class="text-xs text-\[#8f939e\]">\{\{ label \}\}<\/span>/)
  assert.match(optionRowSource, /<slot\s*\/>/)
  assert.match(optionRowSource, /defineProps\(\{\s*label:/s)
})

test('image and video config nodes delegate dropdown rows to a shared component', () => {
  const dropdownRowSource = readConfigComponentSource('ConfigNodeDropdownRow')

  for (const source of [imageConfigSource, videoConfigSource]) {
    assert.match(source, /import ConfigNodeDropdownRow from '\.\/config\/ConfigNodeDropdownRow\.vue'/)
    assert.match(source, /<ConfigNodeDropdownRow label="Model" :options="modelOptions" icon="down" @select="handleModelSelect">/)
    assert.doesNotMatch(source, /import ConfigNodeDropdownButton from '\.\/config\/ConfigNodeDropdownButton\.vue'/)
    assert.doesNotMatch(source, /<ConfigNodeOptionRow\b[\s\S]*?<BaseDropdown :options=/)
    assert.doesNotMatch(source, /class="flex items-center gap-1 text-sm text-\[#eceff2\] hover:text-\[#f2f3f5\]"/)
  }

  assert.match(imageConfigSource, /<ConfigNodeDropdownRow label="Model" :options="modelOptions" icon="down" @select="handleModelSelect">\s*\{\{ displayModelName \}\}\s*<\/ConfigNodeDropdownRow>/)
  assert.match(imageConfigSource, /<ConfigNodeDropdownRow v-if="hasQualityOptions" label="Quality" :options="qualityOptions" @select="handleQualitySelect">/)
  assert.match(imageConfigSource, /<ConfigNodeDropdownRow v-if="hasSizeOptions" label="Size" :options="sizeOptions" @select="handleSizeSelect">/)
  assert.match(videoConfigSource, /<ConfigNodeDropdownRow label="Model" :options="modelOptions" icon="down" @select="handleModelSelect">\s*\{\{ displayModelName \}\}\s*<\/ConfigNodeDropdownRow>/)
  assert.match(videoConfigSource, /<ConfigNodeDropdownRow v-if="inputProfile\.allowRatio" label="Ratio" :options="ratioOptions" @select="handleRatioSelect">/)
  assert.match(videoConfigSource, /<ConfigNodeDropdownRow v-if="inputProfile\.allowDuration" label="Duration" :options="durationOptions" @select="handleDurationSelect">/)
  assert.match(dropdownRowSource, /import \{ BaseDropdown \} from '@\/components\/ui'/)
  assert.match(dropdownRowSource, /import ConfigNodeDropdownButton from '\.\/ConfigNodeDropdownButton\.vue'/)
  assert.match(dropdownRowSource, /import ConfigNodeOptionRow from '\.\/ConfigNodeOptionRow\.vue'/)
  assert.match(dropdownRowSource, /<ConfigNodeOptionRow :label="label">/)
  assert.match(dropdownRowSource, /<BaseDropdown :options="options" compact @select="\$emit\('select', \$event\)">/)
  assert.match(dropdownRowSource, /<ConfigNodeDropdownButton :icon="icon">/)
})

test('image config node delegates model tip display to a shared component', () => {
  const tipSource = readConfigComponentSource('ConfigNodeTipMessage')

  assert.match(imageConfigSource, /import ConfigNodeTipMessage from '\.\/config\/ConfigNodeTipMessage\.vue'/)
  assert.match(imageConfigSource, /<ConfigNodeTipMessage v-if="currentModelConfig\?\.tips" :message="currentModelConfig\.tips" \/>/)
  assert.doesNotMatch(imageConfigSource, /<div v-if="currentModelConfig\?\.tips" class="text-xs text-\[#8f939e\] bg-\[#14161a\] rounded px-2 py-1">/)
  assert.doesNotMatch(imageConfigSource, /💡 \{\{ currentModelConfig\.tips \}\}/)

  assert.match(tipSource, /<div v-if="message" class="config-node-tip-message">/)
  assert.match(tipSource, /<span class="config-node-tip-message__icon">💡<\/span>/)
  assert.match(tipSource, /<span>\{\{ message \}\}<\/span>/)
  assert.match(tipSource, /defineProps\(\{\s*message:/s)
  assert.match(tipSource, /\.config-node-tip-message\s*\{[^}]*background:\s*#14161a/s)
  assert.match(tipSource, /\.config-node-tip-message\s*\{[^}]*color:\s*#8f939e/s)
  assert.match(tipSource, /\.config-node-tip-message\s*\{[^}]*border-radius:\s*0\.25rem/s)
})

test('image config node delegates provider size semantics to a pure helper', () => {
  const sizeOptionsSource = readConfigComponentSource('ImageConfigSizeOptions')

  assert.match(imageConfigSource, /from '\.\/config\/ImageConfigSizeOptions\.js'/)
  assert.match(imageConfigSource, /resolveImageConfigSizeSelection\(\{/)
  assert.doesNotMatch(imageConfigSource, /const BASE_SIZE_BY_RATIO = \{/)
  assert.doesNotMatch(imageConfigSource, /const sizeMetaOptions = computed\(\(\) =>/)
  assert.doesNotMatch(imageConfigSource, /const pickNearestSizeKey = \(ratioKey, resolutionKey\) =>/)

  assert.match(sizeOptionsSource, /export const getImageConfigRatioFromSizeKey = \(sizeKey\) =>/)
  assert.match(sizeOptionsSource, /export const getImageConfigResolutionFromSizeKey = \(sizeKey\) =>/)
  assert.match(sizeOptionsSource, /export const resolveImageConfigSizeSelection = \(/)
})

test('config result nodes use grid collision placement for automatic output creation', () => {
  for (const source of [imageConfigSource, videoConfigSource]) {
    assert.match(source, /getAutoPlacementPosition/)
  }

  assert.match(imageConfigSource, /const imageNodeData = \{\s*url: '',\s*loading: true,\s*label: 'Image Result'\s*\}/s)
  assert.match(imageConfigSource, /const imageNodePosition = getAutoPlacementPosition\('image', \{ x: nodeX \+ 400, y: nodeY \+ yOffset \}, imageNodeData\)/)
  assert.match(imageConfigSource, /imageNodeId = addNode\('image', imageNodePosition, imageNodeData\)/)

  assert.match(videoConfigSource, /const videoNodeData = \{\s*url: '',\s*previewUrl: '',\s*loading: true,\s*label: 'Generating video\.\.\.',\s*sourceConfigId: props\.id\s*\}/s)
  assert.match(videoConfigSource, /const videoNodePosition = getAutoPlacementPosition\('video', \{ x: nodeX \+ 350, y: nodeY \}, videoNodeData\)/)
  assert.match(videoConfigSource, /const videoNodeId = addNode\('video', videoNodePosition, videoNodeData\)/)
})

test('image and video config nodes delegate error display to a shared component', () => {
  const errorMessageSource = readConfigComponentSource('ConfigNodeErrorMessage')

  for (const source of [imageConfigSource, videoConfigSource]) {
    assert.match(source, /import ConfigNodeErrorMessage from '\.\/config\/ConfigNodeErrorMessage\.vue'/)
    assert.match(source, /<ConfigNodeErrorMessage :error="error" \/>/)
    assert.doesNotMatch(source, /<div v-if="error" class="text-xs text-red-500 mt-2">\s*\{\{ error\.message \|\| 'Generation failed' \}\}\s*<\/div>/)
  }

  assert.match(errorMessageSource, /<div v-if="error" class="text-xs text-red-500 mt-2">/)
  assert.match(errorMessageSource, /\{\{ error\.message \|\| 'Generation failed' \}\}/)
  assert.match(errorMessageSource, /defineProps\(\{\s*error:/s)
})

test('config nodes delegate hover duplicate actions to a shared component', () => {
  const hoverActionsSource = readConfigComponentSource('ConfigNodeHoverActions')

  for (const source of [imageConfigSource, videoConfigSource, llmConfigSource]) {
    assert.match(source, /import ConfigNodeHoverActions from '\.\/config\/ConfigNodeHoverActions\.vue'/)
    assert.match(source, /<ConfigNodeHoverActions\b[^>]*:visible="showActions"[^>]*@duplicate="handleDuplicate"/)
    assert.doesNotMatch(source, /<NodeActionButton\b/)
    assert.doesNotMatch(source, /class="absolute -top-5 right-(?:0|12) z-\[1000\]"/)
  }

  assert.match(imageConfigSource, /<ConfigNodeHoverActions :visible="showActions" @duplicate="handleDuplicate" \/>/)
  assert.match(videoConfigSource, /<ConfigNodeHoverActions :visible="showActions" wide @duplicate="handleDuplicate" \/>/)
  assert.match(llmConfigSource, /<ConfigNodeHoverActions :visible="showActions" position-class="right-12" wide @duplicate="handleDuplicate" \/>/)

  assert.match(hoverActionsSource, /import NodeActionButton from '@\/components\/nodes\/NodeActionButton\.vue'/)
  assert.match(hoverActionsSource, /defineEmits\(\['duplicate'\]\)/)
  assert.match(hoverActionsSource, /v-show="visible"/)
  assert.match(hoverActionsSource, /positionClass/)
  assert.match(hoverActionsSource, /@click="\$emit\('duplicate'\)"/)
  assert.match(hoverActionsSource, /CopyOutline/)
})

test('config nodes delegate Vue Flow handles to a shared component', () => {
  const handlesSource = readConfigComponentSource('ConfigNodeHandles')

  for (const source of [imageConfigSource, videoConfigSource, llmConfigSource]) {
    assert.match(source, /import ConfigNodeHandles from '\.\/config\/ConfigNodeHandles\.vue'/)
    assert.match(source, /<ConfigNodeHandles \/>/)
    assert.doesNotMatch(source, /<Handle type="target"/)
    assert.doesNotMatch(source, /<Handle type="source"/)
    assert.doesNotMatch(source, /import \{ Handle, Position, useVueFlow \} from '@vue-flow\/core'/)
  }

  assert.match(handlesSource, /import \{ Handle, Position \} from '@vue-flow\/core'/)
  assert.match(handlesSource, /<Handle type="target" :position="Position\.Left" id="left" class="!bg-\[#d6d8de\] !border-2 !border-\[#0f0f0f\]" \/>/)
  assert.match(handlesSource, /<Handle type="source" :position="Position\.Right" id="right" class="!bg-\[#d6d8de\] !border-2 !border-\[#0f0f0f\]" \/>/)
})

test('LLM config node delegates vertical field shells to a shared component', () => {
  const fieldSource = readConfigComponentSource('ConfigNodeField')

  assert.match(llmConfigSource, /import ConfigNodeField from '\.\/config\/ConfigNodeField\.vue'/)
  assert.match(llmConfigSource, /<ConfigNodeField label="System Prompt">/)
  assert.match(llmConfigSource, /<ConfigNodeField label="Model">/)
  assert.match(llmConfigSource, /<ConfigNodeField v-if="outputContent" label="Result" root-class="mt-2">/)
  assert.match(llmConfigSource, /<template #actions>/)
  assert.doesNotMatch(llmConfigSource, /<label class="text-xs text-\[#8f939e\](?: mb-1 block)?">(System Prompt|Model|Result)<\/label>/)

  assert.match(fieldSource, /<div :class="rootClass">/)
  assert.match(fieldSource, /v-if="\$slots\.actions"/)
  assert.match(fieldSource, /<slot name="actions"/)
  assert.match(fieldSource, /<slot\s*\/>/)
  assert.match(fieldSource, /defineProps\(\{\s*label:/s)
  assert.match(fieldSource, /rootClass:/)
})

test('LLM config node delegates inline field action chrome to a shared component', () => {
  const inlineActionSource = readConfigComponentSource('ConfigNodeInlineActionButton')

  assert.match(llmConfigSource, /import ConfigNodeInlineActionButton from '\.\/config\/ConfigNodeInlineActionButton\.vue'/)
  assert.match(llmConfigSource, /<ConfigNodeInlineActionButton\s+@click="handleCopyOutput"\s*>/)
  assert.match(llmConfigSource, /<n-icon :size="12"><CopyOutline \/><\/n-icon>/)
  assert.doesNotMatch(llmConfigSource, /<button\s+[^>]*@click="handleCopyOutput"/)
  assert.doesNotMatch(llmConfigSource, /class="text-xs text-\[#8f939e\] hover:text-\[#f2f3f5\] flex items-center gap-1 transition-colors"/)

  assert.match(inlineActionSource, /<button type="button" class="config-node-inline-action-button">/)
  assert.match(inlineActionSource, /<slot\s*\/>/)
  assert.match(inlineActionSource, /<style scoped>/)
  assert.match(inlineActionSource, /\.config-node-inline-action-button\s*\{[^}]*display:\s*flex/s)
  assert.match(inlineActionSource, /\.config-node-inline-action-button\s*\{[^}]*font-size:\s*0\.75rem/s)
  assert.match(inlineActionSource, /\.config-node-inline-action-button:hover\s*\{[^}]*color:\s*#f2f3f5/s)
})

test('LLM config node delegates textarea chrome to a shared component', () => {
  const textareaSource = readConfigComponentSource('ConfigNodeTextarea')

  assert.match(llmConfigSource, /import ConfigNodeTextarea from '\.\/config\/ConfigNodeTextarea\.vue'/)
  assert.match(llmConfigSource, /<ConfigNodeTextarea\s+v-model="systemPrompt"\s+@blur="updateConfig"\s+placeholder="Set the AI role and behavior\.\.\."\s+\/>/)
  assert.doesNotMatch(llmConfigSource, /<textarea\b/)
  assert.doesNotMatch(llmConfigSource, /class="w-full bg-\[#14161a\] rounded-lg p-2 resize-none outline-none text-xs text-\[#eceff2\]/)
  assert.doesNotMatch(llmConfigSource, /\.llm-node textarea/)

  assert.match(textareaSource, /<textarea/)
  assert.match(textareaSource, /:value="modelValue"/)
  assert.match(textareaSource, /:placeholder="placeholder"/)
  assert.match(textareaSource, /@input="\$emit\('update:modelValue', \$event\.target\.value\)"/)
  assert.match(textareaSource, /@blur="\$emit\('blur'\)"/)
  assert.match(textareaSource, /@wheel\.stop/)
  assert.match(textareaSource, /@mousedown\.stop/)
  assert.match(textareaSource, /class="config-node-textarea"/)
  assert.match(textareaSource, /defineEmits\(\['update:modelValue', 'blur'\]\)/)
  assert.match(textareaSource, /modelValue:/)
  assert.match(textareaSource, /placeholder:/)
  assert.match(textareaSource, /\.config-node-textarea\s*\{[^}]*background:\s*#14161a/s)
  assert.match(textareaSource, /\.config-node-textarea\s*\{[^}]*cursor:\s*text/s)
})

test('LLM config node delegates model select chrome to a shared component', () => {
  const selectSource = readConfigComponentSource('ConfigNodeSelect')

  assert.match(llmConfigSource, /import ConfigNodeSelect from '\.\/config\/ConfigNodeSelect\.vue'/)
  assert.match(llmConfigSource, /<ConfigNodeSelect\s+:model-value="model"\s+:options="modelOptions"\s+@update:modelValue="handleModelUpdate"\s+\/>/)
  assert.match(llmConfigSource, /const handleModelUpdate = \(value\) => \{\s*model\.value = value\s*updateConfig\(\)\s*\}/s)
  assert.doesNotMatch(llmConfigSource, /<n-select\b/)
  assert.doesNotMatch(llmConfigSource, /NSelect/)

  assert.match(selectSource, /import \{ NSelect \} from 'naive-ui'/)
  assert.match(selectSource, /<n-select\s+:value="modelValue"\s+:options="options"\s+size="small"\s+@update:value="\$emit\('update:modelValue', \$event\)"\s+\/>/)
  assert.match(selectSource, /defineEmits\(\['update:modelValue'\]\)/)
  assert.match(selectSource, /modelValue:/)
  assert.match(selectSource, /options:/)
})

test('config nodes delegate full-width primary action chrome to a shared component', () => {
  const primaryActionSource = readConfigComponentSource('ConfigNodePrimaryActionButton')

  assert.match(imageConfigSource, /import ConfigNodePrimaryActionButton from '\.\/config\/ConfigNodePrimaryActionButton\.vue'/)
  assert.match(videoConfigSource, /import ConfigNodePrimaryActionButton from '\.\/config\/ConfigNodePrimaryActionButton\.vue'/)
  assert.match(llmConfigSource, /import ConfigNodePrimaryActionButton from '\.\/config\/ConfigNodePrimaryActionButton\.vue'/)

  assert.match(imageConfigSource, /<ConfigNodePrimaryActionButton v-else @click="handleGenerate\('auto'\)" :disabled="loading \|\| !isConfigured" emphasized>/)
  assert.match(videoConfigSource, /<ConfigNodePrimaryActionButton @click="handleGenerate" :disabled="loading \|\| !isConfigured" emphasized>/)
  assert.match(llmConfigSource, /<ConfigNodePrimaryActionButton\s+@click="handleGenerate"\s+:disabled="isGenerating"\s*>/)

  for (const source of [imageConfigSource, videoConfigSource]) {
    assert.doesNotMatch(source, /class="w-full flex items-center justify-center gap-2 py-2 px-4 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"/)
  }
  assert.doesNotMatch(llmConfigSource, /class="w-full px-4 py-2 text-sm rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"/)

  assert.match(primaryActionSource, /import NodePrimaryButton from '@\/components\/nodes\/NodePrimaryButton\.vue'/)
  assert.match(primaryActionSource, /<NodePrimaryButton\s+class="w-full flex items-center justify-center gap-2 py-2 px-4 rounded-lg text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"\s+:class="\{ 'font-medium': emphasized \}"/)
  assert.match(primaryActionSource, /<slot\s*\/>/)
  assert.match(primaryActionSource, /emphasized: Boolean/)
})

test('image config node delegates split action row chrome to a shared component', () => {
  const splitActionsSource = readConfigComponentSource('ConfigNodeSplitActions')

  assert.match(imageConfigSource, /import ConfigNodeSplitActions from '\.\/config\/ConfigNodeSplitActions\.vue'/)
  assert.match(imageConfigSource, /<ConfigNodeSplitActions\s+v-if="hasConnectedImageWithContent"\s+:disabled="loading \|\| !isConfigured"\s+@primary="handleGenerate\('new'\)"\s+@secondary="handleGenerate\('replace'\)"/)
  assert.match(imageConfigSource, /<template #primary>/)
  assert.match(imageConfigSource, /<template #secondary>/)
  assert.doesNotMatch(imageConfigSource, /<div v-if="hasConnectedImageWithContent" class="flex gap-2">/)
  assert.doesNotMatch(imageConfigSource, /class="flex-1 flex items-center justify-center gap-1\.5 py-2 px-3 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"/)
  assert.doesNotMatch(imageConfigSource, /class="flex-shrink-0 flex items-center justify-center gap-1 py-2 px-2\.5 rounded-lg text-sm disabled:opacity-50 disabled:cursor-not-allowed"/)

  assert.match(splitActionsSource, /import NodePrimaryButton from '@\/components\/nodes\/NodePrimaryButton\.vue'/)
  assert.match(splitActionsSource, /import NodeSecondaryButton from '@\/components\/nodes\/NodeSecondaryButton\.vue'/)
  assert.match(splitActionsSource, /<div class="config-node-split-actions">/)
  assert.match(splitActionsSource, /<NodePrimaryButton\s+class="config-node-split-actions__primary"\s+:disabled="disabled"\s+@click="\$emit\('primary'\)"/)
  assert.match(splitActionsSource, /<slot name="primary"/)
  assert.match(splitActionsSource, /<NodeSecondaryButton\s+class="config-node-split-actions__secondary"\s+:disabled="disabled"\s+@click="\$emit\('secondary'\)"/)
  assert.match(splitActionsSource, /<slot name="secondary"/)
  assert.match(splitActionsSource, /defineEmits\(\['primary', 'secondary'\]\)/)
})

test('LLM config node delegates output preview chrome to a shared component', () => {
  const outputPreviewSource = readConfigComponentSource('ConfigNodeOutputPreview')

  assert.match(llmConfigSource, /import ConfigNodeOutputPreview from '\.\/config\/ConfigNodeOutputPreview\.vue'/)
  assert.match(llmConfigSource, /<ConfigNodeOutputPreview :content="outputContent" \/>/)
  assert.doesNotMatch(llmConfigSource, /<pre class="whitespace-pre-wrap">\{\{ outputContent \}\}<\/pre>/)
  assert.doesNotMatch(llmConfigSource, /class="bg-\[#14161a\] rounded-lg p-2 text-xs text-\[#eceff2\] max-h-\[150px\] overflow-y-auto border border-\[rgba\(143,143,143,0\.32\)\]"/)

  assert.match(outputPreviewSource, /<div\s+class="config-node-output-preview"\s+@wheel\.stop\s+@mousedown\.stop/)
  assert.match(outputPreviewSource, /<pre class="config-node-output-preview__content">\{\{ content \}\}<\/pre>/)
  assert.match(outputPreviewSource, /defineProps\(\{\s*content:/s)
  assert.match(outputPreviewSource, /\.config-node-output-preview\s*\{[^}]*max-height:\s*150px/s)
  assert.match(outputPreviewSource, /\.config-node-output-preview\s*\{[^}]*background:\s*#14161a/s)
  assert.match(outputPreviewSource, /\.config-node-output-preview__content\s*\{[^}]*white-space:\s*pre-wrap/s)
  assert.match(outputPreviewSource, /\.config-node-output-preview__content\s*\{[^}]*user-select:\s*text/s)
})

test('config nodes delegate content spacing to a shared component', () => {
  const contentSource = readConfigComponentSource('ConfigNodeContent')

  for (const source of [imageConfigSource, videoConfigSource, llmConfigSource]) {
    assert.match(source, /import ConfigNodeContent from '\.\/config\/ConfigNodeContent\.vue'/)
    assert.match(source, /<ConfigNodeContent>/)
    assert.match(source, /<\/ConfigNodeContent>/)
    assert.doesNotMatch(source, /<div class="p-3 space-y-3">/)
  }

  assert.match(contentSource, /<div class="p-3 space-y-3">/)
  assert.match(contentSource, /<slot\s*\/>/)
})

test('LLM config node does not keep an unused eager chat hook instance', () => {
  assert.doesNotMatch(llmConfigSource, /const chatHook = computed\(\(\) => \{/)
  assert.doesNotMatch(llmConfigSource, /import \{ ref, watch, computed \} from 'vue'/)
  assert.match(llmConfigSource, /const \{ send \} = useChat\(\{/)
})
