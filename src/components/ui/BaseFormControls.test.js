import assert from 'node:assert/strict'
import { after } from 'node:test'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import { createSSRApp, h } from 'vue'
import { renderToString } from '@vue/server-renderer'
import { createServer } from 'vite'
import vue from '@vitejs/plugin-vue'

const server = await createServer({
  configFile: false,
  plugins: [vue()],
  resolve: { alias: { '@': fileURLToPath(new URL('../../', import.meta.url)) } },
  server: { middlewareMode: true },
  ssr: { noExternal: ['naive-ui', 'vueuc'] },
  optimizeDeps: { noDiscovery: true },
  appType: 'custom'
})
after(() => server.close())
const { default: BaseSelect } = await server.ssrLoadModule('/src/components/ui/BaseSelect.vue')
const { default: BaseCheckbox } = await server.ssrLoadModule('/src/components/ui/BaseCheckbox.vue')

const render = async (component, props = {}, label) => {
  const vnode = h(component, props, label ? () => label : undefined)
  const app = createSSRApp({ render: () => vnode })
  app.provide('@css-render/vue3-ssr', { styles: [], ids: new Set() })
  const html = await renderToString(app)
  return { html, state: vnode.component.setupState }
}

test('select uses the project surface and type scale without a native select', async () => {
  const { html, state } = await render(BaseSelect, {
    modelValue: 'active',
    options: [{ label: '已开通', value: 'active' }],
    'aria-label': '服务状态',
    class: 'admin-filter'
  })
  assert.doesNotMatch(html, /<select\b|<option\b/)
  assert.match(html, /class="[^"]*admin-filter[^"]*base-select/)
  assert.match(html, /已开通/)
  assert.match(html, /--n-height:38px/)
  assert.match(html, /--n-color:var\(--surface-2\)/)
  assert.match(html, /--n-border-active:1px solid var\(--text-muted\)/)
  assert.equal(state.menuProps.role, 'listbox')
  assert.equal(state.menuProps.style.maxWidth, 'calc(100vw - 24px)')
  assert.equal(state.themeOverrides.peers.InternalSelectMenu.optionCheckColor, 'var(--text)')
})

test('select keeps string and numeric values and blocks events while disabled', async () => {
  const updates = []
  const active = await render(BaseSelect, { 'onUpdate:modelValue': (value) => updates.push(value) })
  active.state.updateValue('member')
  active.state.updateValue(3)
  active.state.updateValue(null)
  assert.deepEqual(updates, ['member', 3, null])
  const disabled = await render(BaseSelect, { disabled: true, 'onUpdate:modelValue': (value) => updates.push(value) })
  disabled.state.updateValue('blocked')
  assert.deepEqual(updates, ['member', 3, null])
})

test('select forwards its accessible name and state to the actual keyboard trigger', async () => {
  const { state } = await render(BaseSelect, { id: 'service-filter', 'aria-label': '服务状态', disabled: true })
  const attributes = new Map([['aria-label', 'old name']])
  const trigger = {
    setAttribute: (key, value) => attributes.set(key, value),
    removeAttribute: (key) => attributes.delete(key)
  }
  const element = { querySelector: (selector) => selector === '.n-base-selection-label' ? trigger : null }
  state.vComboboxAttributes.mounted(element, { value: state.comboboxAttributes })
  assert.equal(attributes.get('id'), 'service-filter')
  assert.equal(attributes.get('role'), 'combobox')
  assert.equal(attributes.get('aria-label'), '服务状态')
  assert.equal(attributes.get('aria-disabled'), 'true')
  assert.equal(attributes.get('aria-expanded'), 'false')
  assert.equal(attributes.get('aria-controls'), state.menuProps.id)
  state.vComboboxAttributes.updated(element, {
    oldValue: state.comboboxAttributes,
    value: { role: 'combobox', 'aria-labelledby': 'service-filter-label', 'aria-expanded': 'true' }
  })
  assert.equal(attributes.has('aria-label'), false)
  assert.equal(attributes.get('aria-labelledby'), 'service-filter-label')
  assert.equal(attributes.get('aria-expanded'), 'true')
})

test('select exposes selected and disabled option states', async () => {
  const { state } = await render(BaseSelect, { modelValue: 2 })
  assert.deepEqual(state.optionAttributes({ value: 2 }), { role: 'option', 'aria-selected': true, 'aria-disabled': false })
  assert.deepEqual(state.optionAttributes({ value: '2', disabled: true }), { role: 'option', 'aria-selected': false, 'aria-disabled': true })
})

test('Escape closes only an open select menu and leaves the selected value unchanged', async () => {
  const updates = []
  const { state } = await render(BaseSelect, { modelValue: 'member', 'onUpdate:modelValue': (value) => updates.push(value) })
  const events = []
  const event = { key: 'Escape', stopPropagation: () => events.push('stop'), preventDefault: () => events.push('prevent') }
  state.selectRef = { focus: () => events.push('focus') }
  state.menuOpen = true
  state.handleEscape(event)
  assert.equal(state.menuOpen, false)
  assert.deepEqual(events, ['stop', 'prevent', 'focus'])
  assert.deepEqual(updates, [])
  state.handleEscape(event)
  assert.deepEqual(events, ['stop', 'prevent', 'focus'])
  state.menuOpen = true
  state.handleEscape({ ...event, key: 'Enter' })
  assert.equal(state.menuOpen, true)
  assert.deepEqual(events, ['stop', 'prevent', 'focus'])
})

test('checkbox uses a themed keyboard control with name, mixed state and caller classes', async () => {
  const { html } = await render(BaseCheckbox, {
    modelValue: true,
    indeterminate: true,
    'aria-label': '选择所有项目',
    class: 'project-selection'
  }, '当前列表')
  assert.doesNotMatch(html, /<input\b/)
  assert.match(html, /role="checkbox"/)
  assert.match(html, /aria-label="选择所有项目"/)
  assert.doesNotMatch(html, /aria-labelledby=/)
  assert.match(html, /aria-checked="mixed"/)
  assert.match(html, /tabindex="0"/)
  assert.match(html, /class="[^"]*project-selection[^"]*base-checkbox/)
  assert.match(html, /--n-color-checked:var\(--primary\)/)
  assert.match(html, /--n-check-mark-color:var\(--primary-foreground\)/)
  assert.match(html, /当前列表/)
})

test('disabled checkbox is removed from keyboard order and cannot emit changes', async () => {
  const updates = []
  const active = await render(BaseCheckbox, { 'onUpdate:modelValue': (value) => updates.push(value) })
  active.state.updateValue(true)
  active.state.updateValue(false)
  const disabled = await render(BaseCheckbox, { disabled: true, 'onUpdate:modelValue': (value) => updates.push(value) })
  disabled.state.updateValue(true)
  assert.deepEqual(updates, [true, false])
  assert.match(disabled.html, /aria-disabled="true"/)
  assert.doesNotMatch(disabled.html, /tabindex="0"/)
})
