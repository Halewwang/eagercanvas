import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test, { after } from 'node:test'
import { fileURLToPath } from 'node:url'
import { createSSRApp, h } from 'vue'
import { renderToString } from '@vue/server-renderer'
import { createServer } from 'vite'
import vue from '@vitejs/plugin-vue'

const server = await createServer({
  configFile: false,
  plugins: [vue()],
  resolve: { alias: { '@': fileURLToPath(new URL('../../', import.meta.url)) } },
  server: { middlewareMode: true, hmr: false },
  css: { postcss: { plugins: [] } },
  ssr: { noExternal: ['naive-ui', 'vueuc'] },
  optimizeDeps: { noDiscovery: true },
  appType: 'custom'
})
after(() => server.close())
const { default: ControlField } = await server.ssrLoadModule('/src/components/admin/AdminControlField.vue')
const { default: RoleSelect } = await server.ssrLoadModule('/src/components/admin/features/AdminRoleMultiSelect.vue')
const { default: UserFilters } = await server.ssrLoadModule('/src/components/admin/features/AdminUserServiceFilters.vue')

test('admin inputs preserve text and number styling and native input attributes', async () => {
  const html = await renderToString(createSSRApp({
    render: () => h(ControlField, { value: 'fixture@example.invalid', placeholder: '按邮箱搜索', 'aria-label': '搜索用户', disabled: true })
  }))
  assert.match(html, /<input[^>]*ui-text-input/)
  assert.match(html, /value="fixture@example.invalid"/)
  assert.match(html, /placeholder="按邮箱搜索"/)
  assert.match(html, /aria-label="搜索用户"/)
  assert.match(html, /disabled/)
  const number = await renderToString(createSSRApp({
    render: () => h(ControlField, { variant: 'number', type: 'number', value: 2, min: 1 })
  }))
  assert.match(number, /<input[^>]*ui-number-input[^>]*type="number"[^>]*value="2"[^>]*min="1"/)
  const source = readFileSync(new URL('./AdminControlField.vue', import.meta.url), 'utf8')
  assert.doesNotMatch(source, /ui-select-input|:deep\(option\)|:is="tag"/)
})

test('admin filters use shared selects with readable labels and selected values', async () => {
  const app = createSSRApp({
    render: () => h(UserFilters, { roleFilter: 'support', serviceStatusFilter: 'active', statusFilter: 'suspended' })
  })
  app.provide('@css-render/vue3-ssr', { styles: [], ids: new Set() })
  const html = await renderToString(app)
  assert.doesNotMatch(html, /<select\b|<option\b/)
  for (const selected of ['已启用', '客服', '已暂停']) assert.ok(html.includes(selected))
  const source = readFileSync(new URL('./features/AdminUserServiceFilters.vue', import.meta.url), 'utf8')
  for (const label of ['服务状态', '角色', '状态筛选']) assert.ok(source.includes(`aria-label="${label}"`))
  assert.equal([...source.matchAll(/<BaseSelect\b/g)].length, 3)
  assert.doesNotMatch(source, /tag="select"|<option\b/)
})

const roleState = async (props = {}) => {
  const events = []
  let state
  await renderToString(createSSRApp({
    setup() {
      state = RoleSelect.setup({ disabled: false, isSuperAdminOperator: false, modelValue: ['user'], ...props }, {
        emit: (...args) => events.push(args),
        expose() {}
      })
      return () => h('div')
    }
  }))
  return { events, state }
}

test('role choices preserve selection and reserve the super administrator control', async () => {
  const html = await renderToString(createSSRApp({
    render: () => h(RoleSelect, { modelValue: ['support', 'user'] })
  }))
  const choices = [...html.matchAll(/<[^>]*role="checkbox"([^>]*)>/g)].map(([, attributes]) => attributes)
  assert.equal(choices.length, 5)
  assert.match(choices[0], /aria-disabled="true"/)
  assert.ok(choices.slice(1).every((attributes) => !attributes.includes('aria-disabled="true"')))
  assert.deepEqual(choices.map((attributes) => attributes.includes('aria-checked="true"')), [false, false, false, true, true])
  assert.doesNotMatch(html, /<input\b[^>]*type="checkbox"/)
})

test('read-only role choices disable every input without hiding assigned roles', async () => {
  const html = await renderToString(createSSRApp({
    render: () => h(RoleSelect, { disabled: true, isSuperAdminOperator: true, modelValue: ['super_admin', 'user'] })
  }))
  assert.match(html, /<fieldset[^>]*disabled/)
  const choices = [...html.matchAll(/<[^>]*role="checkbox"([^>]*)>/g)].map(([, attributes]) => attributes)
  assert.equal(choices.length, 5)
  assert.ok(choices.every((attributes) => attributes.includes('aria-disabled="true"')))
  assert.deepEqual(choices.map((attributes) => attributes.includes('aria-checked="true"')), [true, false, false, false, true])
})

test('role changes maintain fixed order and retain at least one assigned role', async () => {
  const { state, events } = await roleState({ modelValue: ['user', 'support'] })
  state.toggleRole('admin', true)
  assert.deepEqual(events, [['update:modelValue', ['admin', 'support', 'user']]])
  const last = await roleState()
  last.state.toggleRole('user', false)
  assert.deepEqual(last.events, [])
})

test('disabled and unauthorized role controls cannot emit changes', async () => {
  const disabled = await roleState({ disabled: true, isSuperAdminOperator: true })
  disabled.state.toggleRole('admin', true)
  disabled.state.toggleRole('super_admin', true)
  disabled.state.toggleRole('user', false)
  assert.deepEqual(disabled.events, [])
  const unauthorized = await roleState()
  unauthorized.state.toggleRole('super_admin', true)
  assert.deepEqual(unauthorized.events, [])
  const authorized = await roleState({ isSuperAdminOperator: true })
  authorized.state.toggleRole('super_admin', true)
  assert.deepEqual(authorized.events, [['update:modelValue', ['super_admin', 'user']]])
})
